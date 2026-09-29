import Router from "koa-router";
import { uniq } from "es-toolkit/compat";
import { Op } from "sequelize";
import type { Transaction } from "sequelize";
import { UserRole } from "@shared/types";
import { NotFoundError, ValidationError } from "@server/errors";
import auth from "@server/middlewares/authentication";
import { transaction } from "@server/middlewares/transaction";
import validate from "@server/middlewares/validate";
import { Group, User } from "@server/models";
import type { APIContext } from "@server/types";
import { canAlign } from "../../shared/progress";
import { GoalLevel, KeyResultType } from "../../shared/types";
import {
  GoalCheckIn,
  GoalCycle,
  GoalKeyResult,
  GoalObjective,
} from "../models";
import {
  authorize,
  canCheckIn,
  canCreateKeyResult,
  canCreateObjective,
  canDeleteCheckIn,
  canDeleteKeyResult,
  canDeleteObjective,
  canManageCycles,
  canReadGoals,
  canUpdateKeyResult,
  canUpdateObjective,
} from "../policies";
import {
  presentCheckIn,
  presentCycle,
  presentGoalGroup,
  presentGoalUser,
  presentKeyResult,
  presentObjective,
} from "../presenters";
import { dayInTimeZone, pickCurrentCycle, safeTimeZone } from "../time";
import * as T from "./schema";

const router = new Router();

/** Every goals endpoint needs a signed in user of at least viewer role. */
const goalsAuth = () => auth({ role: UserRole.Viewer });

/** Most recent check-ins returned by goalCheckIns.list. */
const CheckInListLimit = 50;

interface CycleDates {
  startsAt: string;
  endsAt: string;
}

const cycleDates = (cycle: GoalCycle): CycleDates => ({
  startsAt: String(cycle.startsAt).slice(0, 10),
  endsAt: String(cycle.endsAt).slice(0, 10),
});

function assertCycleDates({ startsAt, endsAt }: CycleDates) {
  if (endsAt < startsAt) {
    throw ValidationError("End date must be on or after the start date");
  }
}

async function findCycle(
  id: string,
  user: User,
  transaction?: Transaction,
  lock = false
) {
  const cycle = await GoalCycle.findOne({
    where: { id, teamId: user.teamId },
    transaction,
    lock: lock && transaction ? transaction.LOCK.UPDATE : undefined,
  });
  if (!cycle) {
    throw NotFoundError("Cycle not found");
  }
  return cycle;
}

async function findObjective(
  id: string,
  user: User,
  transaction?: Transaction,
  lock = false
) {
  const objective = await GoalObjective.findOne({
    where: { id, teamId: user.teamId },
    transaction,
    lock: lock && transaction ? transaction.LOCK.UPDATE : undefined,
  });
  if (!objective) {
    throw NotFoundError("Objective not found");
  }
  return objective;
}

async function findKeyResult(
  id: string,
  user: User,
  transaction?: Transaction,
  lock = false
) {
  const keyResult = await GoalKeyResult.findOne({
    where: { id, teamId: user.teamId },
    transaction,
    lock: lock && transaction ? transaction.LOCK.UPDATE : undefined,
  });
  if (!keyResult) {
    throw NotFoundError("Key result not found");
  }
  const objective = await findObjective(
    keyResult.objectiveId,
    user,
    transaction
  );
  return { keyResult, objective };
}

/**
 * Checks that a user can own goals: in the same workspace, not suspended and
 * not a guest.
 */
async function assertActiveOwner(
  ownerId: string,
  user: User,
  transaction: Transaction
) {
  const owner = await User.findOne({
    where: { id: ownerId, teamId: user.teamId },
    transaction,
  });
  if (!owner || owner.suspendedAt || owner.isGuest) {
    throw ValidationError("Owner must be an active member of the workspace");
  }
}

/**
 * Validates the group for an objective's level: team objectives need a group
 * in the workspace, other levels must not have one.
 *
 * @returns the group id to store.
 */
async function resolveGroup(
  level: GoalLevel,
  groupId: string | null | undefined,
  user: User,
  transaction: Transaction
): Promise<string | null> {
  if (level !== GoalLevel.Team) {
    if (groupId) {
      throw ValidationError("Only team objectives can belong to a group");
    }
    return null;
  }
  if (!groupId) {
    throw ValidationError("A team objective needs a group");
  }
  const group = await Group.findOne({
    where: { id: groupId, teamId: user.teamId },
    transaction,
  });
  if (!group) {
    throw ValidationError("The group must belong to this workspace");
  }
  return group.id;
}

/**
 * Describes why an objective cannot align to a parent.
 *
 * @returns a message, or null when the alignment is allowed.
 */
async function alignmentProblem(
  options: {
    level: GoalLevel;
    cycleId: string;
    parentId: string;
    selfId?: string;
  },
  user: User,
  transaction: Transaction
): Promise<string | null> {
  const { level, cycleId, parentId, selfId } = options;
  if (level === GoalLevel.Church) {
    return "Church objectives cannot align to another objective";
  }
  if (parentId === selfId) {
    return "An objective cannot align to itself";
  }
  const parent = await GoalObjective.findOne({
    where: { id: parentId, teamId: user.teamId },
    transaction,
  });
  if (!parent) {
    return "The objective to align to does not exist";
  }
  if (parent.cycleId !== cycleId) {
    return "Objectives can only align to an objective in the same cycle";
  }
  if (!canAlign(level, parent.level)) {
    return level === GoalLevel.Team
      ? "Team objectives can only align to a church objective"
      : "Personal objectives can only align to a team or church objective";
  }
  return null;
}

/**
 * Works out a key result's start and target. Milestones always run from 0 to
 * 1; metrics need a target different from the start.
 */
function resolveValues(
  type: KeyResultType,
  startValue: number | undefined,
  targetValue: number | undefined
) {
  if (type === KeyResultType.Milestone) {
    return { startValue: 0, targetValue: 1 };
  }
  const start = startValue ?? 0;
  if (targetValue === undefined) {
    throw ValidationError("A metric key result needs a target value");
  }
  if (targetValue === start) {
    throw ValidationError(
      "Target value must be different from the start value"
    );
  }
  return { startValue: start, targetValue };
}

/** Milestone values are stored as 1 (done) or 0 (not done). */
const normaliseValue = (type: KeyResultType, value: number) =>
  type === KeyResultType.Milestone ? (value >= 1 ? 1 : 0) : value;

router.post(
  "goals.overview",
  goalsAuth(),
  validate(T.GoalsOverviewSchema),
  async (ctx: APIContext<T.GoalsOverviewReq>) => {
    const { cycleId } = ctx.input.body;
    const { user } = ctx.state.auth;
    authorize(canReadGoals(user));

    const cycles = await GoalCycle.findAll({
      where: { teamId: user.teamId },
      order: [
        ["startsAt", "DESC"],
        ["createdAt", "DESC"],
      ],
    });

    let cycle: GoalCycle | null;
    if (cycleId) {
      cycle = cycles.find((c) => c.id === cycleId) ?? null;
      if (!cycle) {
        throw NotFoundError("Cycle not found");
      }
    } else {
      const today = dayInTimeZone(new Date(), safeTimeZone(user.timezone));
      const picked = pickCurrentCycle(
        cycles.map((c) => ({ ...cycleDates(c), cycle: c })),
        today
      );
      cycle = picked?.cycle ?? null;
    }

    const objectives = cycle
      ? await GoalObjective.findAll({
          where: { teamId: user.teamId, cycleId: cycle.id },
          order: [
            ["createdAt", "ASC"],
            ["id", "ASC"],
          ],
        })
      : [];

    const keyResults = objectives.length
      ? await GoalKeyResult.findAll({
          where: {
            teamId: user.teamId,
            objectiveId: objectives.map((o) => o.id),
          },
          order: [
            ["createdAt", "ASC"],
            ["id", "ASC"],
          ],
        })
      : [];

    const [users, groups] = await Promise.all([
      User.findAll({
        where: {
          teamId: user.teamId,
          suspendedAt: { [Op.is]: null },
          role: { [Op.ne]: UserRole.Guest },
        },
        order: [["name", "ASC"]],
      }),
      Group.findAll({
        where: { teamId: user.teamId },
        order: [["name", "ASC"]],
      }),
    ]);

    const objectivesById = new Map(objectives.map((o) => [o.id, o]));
    const keyResultsByObjective = new Map<string, GoalKeyResult[]>();
    for (const kr of keyResults) {
      const list = keyResultsByObjective.get(kr.objectiveId) ?? [];
      list.push(kr);
      keyResultsByObjective.set(kr.objectiveId, list);
    }

    ctx.body = {
      data: {
        cycles: cycles.map((c) => presentCycle(c, user)),
        cycle: cycle ? presentCycle(cycle, user) : null,
        objectives: objectives.map((o) =>
          presentObjective(o, keyResultsByObjective.get(o.id) ?? [], user)
        ),
        keyResults: keyResults.flatMap((kr) => {
          const objective = objectivesById.get(kr.objectiveId);
          return objective ? [presentKeyResult(kr, objective, user)] : [];
        }),
        users: users.map(presentGoalUser),
        groups: groups.map(presentGoalGroup),
        abilities: {
          createCycle: canManageCycles(user),
          createObjective: {
            [GoalLevel.Church]: canCreateObjective(user, GoalLevel.Church),
            [GoalLevel.Team]: canCreateObjective(user, GoalLevel.Team),
            [GoalLevel.Personal]: canCreateObjective(
              user,
              GoalLevel.Personal,
              user.id
            ),
          },
        },
      },
    };
  }
);

router.post(
  "goalCycles.create",
  goalsAuth(),
  validate(T.GoalCyclesCreateSchema),
  transaction(),
  async (ctx: APIContext<T.GoalCyclesCreateReq>) => {
    const { name, startsAt, endsAt } = ctx.input.body;
    const { user } = ctx.state.auth;
    const { transaction } = ctx.state;
    authorize(canManageCycles(user), "Only admins can manage cycles");
    assertCycleDates({ startsAt, endsAt });

    const cycle = await GoalCycle.create(
      {
        name,
        startsAt,
        endsAt,
        teamId: user.teamId,
        createdById: user.id,
      },
      { transaction }
    );

    ctx.body = { data: presentCycle(cycle, user) };
  }
);

router.post(
  "goalCycles.update",
  goalsAuth(),
  validate(T.GoalCyclesUpdateSchema),
  transaction(),
  async (ctx: APIContext<T.GoalCyclesUpdateReq>) => {
    const { id, name, startsAt, endsAt } = ctx.input.body;
    const { user } = ctx.state.auth;
    const { transaction } = ctx.state;

    const cycle = await findCycle(id, user, transaction, true);
    authorize(canManageCycles(user), "Only admins can manage cycles");

    const dates = {
      startsAt: startsAt ?? cycleDates(cycle).startsAt,
      endsAt: endsAt ?? cycleDates(cycle).endsAt,
    };
    assertCycleDates(dates);

    if (name !== undefined) {
      cycle.name = name;
    }
    cycle.startsAt = dates.startsAt;
    cycle.endsAt = dates.endsAt;
    await cycle.save({ transaction });

    ctx.body = { data: presentCycle(cycle, user) };
  }
);

router.post(
  "goalCycles.delete",
  goalsAuth(),
  validate(T.GoalCyclesDeleteSchema),
  transaction(),
  async (ctx: APIContext<T.GoalCyclesDeleteReq>) => {
    const { id } = ctx.input.body;
    const { user } = ctx.state.auth;
    const { transaction } = ctx.state;

    const cycle = await findCycle(id, user, transaction, true);
    authorize(canManageCycles(user), "Only admins can manage cycles");

    // Objectives, key results and check-ins are removed by the database.
    await cycle.destroy({ transaction });

    ctx.body = { success: true };
  }
);

router.post(
  "goalObjectives.create",
  goalsAuth(),
  validate(T.GoalObjectivesCreateSchema),
  transaction(),
  async (ctx: APIContext<T.GoalObjectivesCreateReq>) => {
    const { cycleId, level, title, description, groupId, parentId } =
      ctx.input.body;
    const { user } = ctx.state.auth;
    const { transaction } = ctx.state;
    const ownerId = ctx.input.body.ownerId ?? user.id;

    authorize(
      canCreateObjective(user, level, ownerId),
      "You do not have permission to create this objective"
    );

    const cycle = await findCycle(cycleId, user, transaction);
    await assertActiveOwner(ownerId, user, transaction);
    const resolvedGroupId = await resolveGroup(
      level,
      groupId,
      user,
      transaction
    );

    if (parentId) {
      const problem = await alignmentProblem(
        { level, cycleId: cycle.id, parentId },
        user,
        transaction
      );
      if (problem) {
        throw ValidationError(problem);
      }
    }

    const objective = await GoalObjective.create(
      {
        cycleId: cycle.id,
        level,
        title,
        description: description ?? null,
        ownerId,
        groupId: resolvedGroupId,
        parentId: parentId ?? null,
        teamId: user.teamId,
        createdById: user.id,
      },
      { transaction }
    );

    ctx.body = { data: presentObjective(objective, [], user) };
  }
);

router.post(
  "goalObjectives.update",
  goalsAuth(),
  validate(T.GoalObjectivesUpdateSchema),
  transaction(),
  async (ctx: APIContext<T.GoalObjectivesUpdateReq>) => {
    const { id, title, description } = ctx.input.body;
    const { user } = ctx.state.auth;
    const { transaction } = ctx.state;

    const objective = await findObjective(id, user, transaction, true);
    authorize(canUpdateObjective(user, objective));

    const level = ctx.input.body.level ?? objective.level;
    const ownerId = ctx.input.body.ownerId ?? objective.ownerId;
    const cycleId = ctx.input.body.cycleId ?? objective.cycleId;
    const levelChanged = level !== objective.level;
    const cycleChanged = cycleId !== objective.cycleId;

    // Moving to another level or owner is only allowed where the user could
    // have created the objective that way in the first place.
    if (levelChanged || ownerId !== objective.ownerId) {
      authorize(
        canCreateObjective(user, level, ownerId),
        "You do not have permission to make this change"
      );
    }
    if (cycleChanged) {
      await findCycle(cycleId, user, transaction);
    }
    if (ownerId !== objective.ownerId) {
      await assertActiveOwner(ownerId, user, transaction);
    }

    // Group: validated when it or the level changes, cleared when the
    // objective stops being a team objective.
    const requestedGroupId =
      ctx.input.body.groupId !== undefined
        ? ctx.input.body.groupId
        : level === GoalLevel.Team
          ? objective.groupId
          : null;
    const groupId =
      !levelChanged && requestedGroupId === objective.groupId
        ? objective.groupId
        : await resolveGroup(level, requestedGroupId, user, transaction);

    // Alignment: an explicit parent must be valid. An existing parent that no
    // longer fits after a level or cycle change is dropped.
    let parentId = objective.parentId;
    if (ctx.input.body.parentId !== undefined) {
      parentId = ctx.input.body.parentId;
      if (parentId) {
        const problem = await alignmentProblem(
          { level, cycleId, parentId, selfId: objective.id },
          user,
          transaction
        );
        if (problem) {
          throw ValidationError(problem);
        }
      }
    } else if (parentId && (levelChanged || cycleChanged)) {
      const problem = await alignmentProblem(
        { level, cycleId, parentId, selfId: objective.id },
        user,
        transaction
      );
      if (problem) {
        parentId = null;
      }
    }

    // Objectives aligned to this one are unaligned if they no longer fit.
    if (levelChanged || cycleChanged) {
      const children = await GoalObjective.findAll({
        where: { parentId: objective.id, teamId: user.teamId },
        transaction,
      });
      const invalid = children.filter(
        (child) => child.cycleId !== cycleId || !canAlign(child.level, level)
      );
      if (invalid.length) {
        await GoalObjective.update(
          { parentId: null },
          { where: { id: invalid.map((c) => c.id) }, transaction }
        );
      }
    }

    if (title !== undefined) {
      objective.title = title;
    }
    if (description !== undefined) {
      objective.description = description;
    }
    objective.level = level;
    objective.ownerId = ownerId;
    objective.cycleId = cycleId;
    objective.groupId = groupId;
    objective.parentId = parentId;
    await objective.save({ transaction });

    const keyResults = await GoalKeyResult.findAll({
      where: { objectiveId: objective.id },
      transaction,
    });

    ctx.body = { data: presentObjective(objective, keyResults, user) };
  }
);

router.post(
  "goalObjectives.delete",
  goalsAuth(),
  validate(T.GoalObjectivesDeleteSchema),
  transaction(),
  async (ctx: APIContext<T.GoalObjectivesDeleteReq>) => {
    const { id } = ctx.input.body;
    const { user } = ctx.state.auth;
    const { transaction } = ctx.state;

    const objective = await findObjective(id, user, transaction, true);
    authorize(canDeleteObjective(user, objective));

    // Key results and check-ins cascade, aligned objectives become unaligned.
    await objective.destroy({ transaction });

    ctx.body = { success: true };
  }
);

router.post(
  "goalKeyResults.create",
  goalsAuth(),
  validate(T.GoalKeyResultsCreateSchema),
  transaction(),
  async (ctx: APIContext<T.GoalKeyResultsCreateReq>) => {
    const { objectiveId, title, type, unit } = ctx.input.body;
    const { user } = ctx.state.auth;
    const { transaction } = ctx.state;
    const ownerId = ctx.input.body.ownerId ?? user.id;

    const objective = await findObjective(objectiveId, user, transaction);
    authorize(canCreateKeyResult(user, objective));
    await assertActiveOwner(ownerId, user, transaction);

    const { startValue, targetValue } = resolveValues(
      type,
      ctx.input.body.startValue,
      ctx.input.body.targetValue
    );

    const keyResult = await GoalKeyResult.create(
      {
        objectiveId: objective.id,
        title,
        type,
        startValue,
        targetValue,
        currentValue: startValue,
        unit: unit ?? null,
        ownerId,
        status: null,
        lastCheckInAt: null,
        teamId: user.teamId,
        createdById: user.id,
      },
      { transaction }
    );

    ctx.body = { data: presentKeyResult(keyResult, objective, user) };
  }
);

router.post(
  "goalKeyResults.update",
  goalsAuth(),
  validate(T.GoalKeyResultsUpdateSchema),
  transaction(),
  async (ctx: APIContext<T.GoalKeyResultsUpdateReq>) => {
    const { id, title, unit, ownerId } = ctx.input.body;
    const { user } = ctx.state.auth;
    const { transaction } = ctx.state;

    const { keyResult, objective } = await findKeyResult(
      id,
      user,
      transaction,
      true
    );
    authorize(canUpdateKeyResult(user, keyResult, objective));

    if (ownerId !== undefined && ownerId !== keyResult.ownerId) {
      await assertActiveOwner(ownerId, user, transaction);
      keyResult.ownerId = ownerId;
    }

    const { type: nextType, startValue, targetValue } = ctx.input.body;
    if (
      nextType !== undefined ||
      startValue !== undefined ||
      targetValue !== undefined
    ) {
      const type = nextType ?? keyResult.type;
      const values = resolveValues(
        type,
        startValue ?? Number(keyResult.startValue),
        targetValue ?? Number(keyResult.targetValue)
      );
      keyResult.type = type;
      keyResult.startValue = values.startValue;
      keyResult.targetValue = values.targetValue;

      // Check-ins are left alone. Without any, the current value follows the
      // start value.
      if (!keyResult.lastCheckInAt) {
        keyResult.currentValue = values.startValue;
      }
    }

    if (title !== undefined) {
      keyResult.title = title;
    }
    if (unit !== undefined) {
      keyResult.unit = unit;
    }
    await keyResult.save({ transaction });

    ctx.body = { data: presentKeyResult(keyResult, objective, user) };
  }
);

router.post(
  "goalKeyResults.delete",
  goalsAuth(),
  validate(T.GoalKeyResultsDeleteSchema),
  transaction(),
  async (ctx: APIContext<T.GoalKeyResultsDeleteReq>) => {
    const { id } = ctx.input.body;
    const { user } = ctx.state.auth;
    const { transaction } = ctx.state;

    const { keyResult, objective } = await findKeyResult(
      id,
      user,
      transaction,
      true
    );
    authorize(canDeleteKeyResult(user, keyResult, objective));

    await keyResult.destroy({ transaction });

    ctx.body = { success: true };
  }
);

router.post(
  "goalCheckIns.list",
  goalsAuth(),
  validate(T.GoalCheckInsListSchema),
  async (ctx: APIContext<T.GoalCheckInsListReq>) => {
    const { keyResultId } = ctx.input.body;
    const { user } = ctx.state.auth;
    authorize(canReadGoals(user));

    const { keyResult } = await findKeyResult(keyResultId, user);

    const checkIns = await GoalCheckIn.findAll({
      where: { keyResultId: keyResult.id, teamId: user.teamId },
      order: [
        ["createdAt", "DESC"],
        ["id", "DESC"],
      ],
      limit: CheckInListLimit,
    });

    const userIds = uniq(checkIns.map((checkIn) => checkIn.userId));
    const users = userIds.length
      ? await User.findAll({
          where: { id: userIds, teamId: user.teamId },
          paranoid: false,
        })
      : [];

    ctx.body = {
      data: checkIns.map((checkIn) => presentCheckIn(checkIn, user)),
      users: users.map(presentGoalUser),
    };
  }
);

router.post(
  "goalCheckIns.create",
  goalsAuth(),
  validate(T.GoalCheckInsCreateSchema),
  transaction(),
  async (ctx: APIContext<T.GoalCheckInsCreateReq>) => {
    const { keyResultId, status, note } = ctx.input.body;
    const { user } = ctx.state.auth;
    const { transaction } = ctx.state;

    const { keyResult, objective } = await findKeyResult(
      keyResultId,
      user,
      transaction,
      true
    );
    authorize(
      canCheckIn(user, keyResult, objective),
      "You do not have permission to check in on this key result"
    );

    const value = normaliseValue(keyResult.type, ctx.input.body.value);
    const checkIn = await GoalCheckIn.create(
      {
        keyResultId: keyResult.id,
        userId: user.id,
        value,
        status,
        note: note ?? null,
        teamId: user.teamId,
      },
      { transaction }
    );

    keyResult.currentValue = value;
    keyResult.status = status;
    keyResult.lastCheckInAt = checkIn.createdAt;
    await keyResult.save({ transaction });

    const keyResults = await GoalKeyResult.findAll({
      where: { objectiveId: objective.id },
      transaction,
    });

    ctx.body = {
      data: presentCheckIn(checkIn, user),
      keyResult: presentKeyResult(keyResult, objective, user),
      objective: presentObjective(objective, keyResults, user),
    };
  }
);

router.post(
  "goalCheckIns.delete",
  goalsAuth(),
  validate(T.GoalCheckInsDeleteSchema),
  transaction(),
  async (ctx: APIContext<T.GoalCheckInsDeleteReq>) => {
    const { id } = ctx.input.body;
    const { user } = ctx.state.auth;
    const { transaction } = ctx.state;

    const checkIn = await GoalCheckIn.findOne({
      where: { id, teamId: user.teamId },
      transaction,
    });
    if (!checkIn) {
      throw NotFoundError("Check-in not found");
    }
    authorize(canDeleteCheckIn(user, checkIn));

    const { keyResult } = await findKeyResult(
      checkIn.keyResultId,
      user,
      transaction,
      true
    );
    await checkIn.destroy({ transaction });

    // Restore the key result from the newest remaining check-in, or reset it.
    const latest = await GoalCheckIn.findOne({
      where: { keyResultId: keyResult.id },
      order: [
        ["createdAt", "DESC"],
        ["id", "DESC"],
      ],
      transaction,
    });
    if (latest) {
      keyResult.currentValue = latest.value;
      keyResult.status = latest.status;
      keyResult.lastCheckInAt = latest.createdAt;
    } else {
      keyResult.currentValue = keyResult.startValue;
      keyResult.status = null;
      keyResult.lastCheckInAt = null;
    }
    await keyResult.save({ transaction });

    ctx.body = { success: true };
  }
);

export default router;
