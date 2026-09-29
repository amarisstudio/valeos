import type { User } from "@server/models";
import {
  buildAdmin,
  buildGroup,
  buildGuestUser,
  buildTeam,
  buildUser,
  buildViewer,
} from "@server/test/factories";
import { getTestServer } from "@server/test/support";
import {
  GoalLevel,
  GoalStatus,
  KeyResultType,
  type GoalCheckInJSON,
  type GoalKeyResultJSON,
  type GoalObjectiveJSON,
  type GoalsOverviewJSON,
} from "../../shared/types";
import {
  GoalCheckIn,
  GoalCycle,
  GoalKeyResult,
  GoalObjective,
} from "../models";
import { addDaysToDay, dayInTimeZone } from "../time";

const server = getTestServer();

type Body = Record<string, unknown>;

async function post(path: string, user: User | undefined, body: Body = {}) {
  const res = user
    ? await server.post(`/api/${path}`, user, { body })
    : await server.post(`/api/${path}`, { body });
  return { status: res.status, body: await res.json() };
}

const today = () => dayInTimeZone(new Date(), "UTC");

async function setup() {
  const team = await buildTeam();
  const admin = await buildAdmin({ teamId: team.id });
  const member = await buildUser({ teamId: team.id });
  const otherMember = await buildUser({ teamId: team.id });
  const viewer = await buildViewer({ teamId: team.id });
  const guest = await buildGuestUser({ teamId: team.id });
  const group = await buildGroup({ teamId: team.id, userId: admin.id });
  const cycle = await GoalCycle.create({
    teamId: team.id,
    name: "Term 4",
    startsAt: addDaysToDay(today(), -10),
    endsAt: addDaysToDay(today(), 30),
    createdById: admin.id,
  });
  return { team, admin, member, otherMember, viewer, guest, group, cycle };
}

type Ctx = Awaited<ReturnType<typeof setup>>;

function buildObjective(
  ctx: Ctx,
  overrides: Partial<GoalObjective> & { ownerId: string }
) {
  return GoalObjective.create({
    teamId: ctx.team.id,
    cycleId: ctx.cycle.id,
    level: GoalLevel.Church,
    title: "Reach our city",
    createdById: ctx.admin.id,
    ...overrides,
  });
}

function buildKeyResult(
  ctx: Ctx,
  objective: GoalObjective,
  overrides: Partial<GoalKeyResult> & { ownerId: string }
) {
  return GoalKeyResult.create({
    teamId: ctx.team.id,
    objectiveId: objective.id,
    title: "Average attendance reaches 450",
    type: KeyResultType.Metric,
    startValue: 400,
    targetValue: 450,
    currentValue: 400,
    unit: "people",
    createdById: ctx.admin.id,
    ...overrides,
  });
}

describe("models", () => {
  it("registers plugin models with associations to core models", async () => {
    const ctx = await setup();
    const objective = await buildObjective(ctx, { ownerId: ctx.member.id });
    const loaded = await GoalObjective.findByPk(objective.id, {
      include: ["owner", "cycle", "team"],
      rejectOnEmpty: true,
    });
    expect(loaded.owner.id).toEqual(ctx.member.id);
    expect(loaded.cycle.id).toEqual(ctx.cycle.id);
    expect(loaded.team.id).toEqual(ctx.team.id);
  });
});

describe("#goals.overview", () => {
  it("requires authentication", async () => {
    const res = await post("goals.overview", undefined);
    expect(res.status).toEqual(401);
  });

  it("rejects guests", async () => {
    const ctx = await setup();
    const res = await post("goals.overview", ctx.guest);
    expect(res.status).toEqual(403);
  });

  it("returns an empty overview when there are no cycles", async () => {
    const team = await buildTeam();
    const admin = await buildAdmin({ teamId: team.id });
    const res = await post("goals.overview", admin);
    const data: GoalsOverviewJSON = res.body.data;

    expect(res.status).toEqual(200);
    expect(data.cycles).toEqual([]);
    expect(data.cycle).toBeNull();
    expect(data.objectives).toEqual([]);
    expect(data.keyResults).toEqual([]);
    expect(data.abilities).toEqual({
      createCycle: true,
      createObjective: { church: true, team: true, personal: true },
    });
  });

  it("returns the current cycle with objectives, key results, users and groups", async () => {
    const ctx = await setup();
    const suspended = await buildUser({
      teamId: ctx.team.id,
      suspendedAt: new Date(),
    });
    const objective = await buildObjective(ctx, { ownerId: ctx.member.id });
    await buildKeyResult(ctx, objective, {
      ownerId: ctx.member.id,
      currentValue: 425,
      status: GoalStatus.AtRisk,
      lastCheckInAt: new Date(),
    });
    await buildKeyResult(ctx, objective, {
      ownerId: ctx.viewer.id,
      type: KeyResultType.Milestone,
      startValue: 0,
      targetValue: 1,
      currentValue: 1,
      status: GoalStatus.OnTrack,
    });

    // Another workspace's data is never included.
    const other = await setup();
    await buildObjective(other, { ownerId: other.admin.id });

    const res = await post("goals.overview", ctx.member);
    const data: GoalsOverviewJSON = res.body.data;

    expect(res.status).toEqual(200);
    expect(data.cycles.map((c) => c.id)).toEqual([ctx.cycle.id]);
    expect(data.cycle?.id).toEqual(ctx.cycle.id);
    expect(data.cycle?.startsAt).toEqual(addDaysToDay(today(), -10));
    expect(data.cycle?.abilities).toEqual({ update: false, delete: false });
    expect(data.objectives).toHaveLength(1);
    expect(data.objectives[0].progress).toBeCloseTo(0.75);
    expect(data.objectives[0].status).toEqual(GoalStatus.AtRisk);
    expect(data.objectives[0].abilities).toEqual({
      update: true,
      delete: true,
      createKeyResult: true,
    });
    expect(data.keyResults).toHaveLength(2);
    expect(data.keyResults[0].progress).toBeCloseTo(0.5);
    expect(data.keyResults[0].unit).toEqual("people");
    expect(data.keyResults[1].progress).toEqual(1);

    const userIds = data.users.map((u) => u.id);
    expect(userIds).toEqual(
      expect.arrayContaining([
        ctx.admin.id,
        ctx.member.id,
        ctx.otherMember.id,
        ctx.viewer.id,
      ])
    );
    expect(userIds).not.toContain(ctx.guest.id);
    expect(userIds).not.toContain(suspended.id);
    expect(userIds).not.toContain(other.admin.id);
    expect(data.users[0]).toEqual({
      id: expect.any(String),
      name: expect.any(String),
      avatarUrl: null,
      color: expect.any(String),
    });
    expect(data.groups).toEqual([{ id: ctx.group.id, name: ctx.group.name }]);
    expect(data.abilities).toEqual({
      createCycle: false,
      createObjective: { church: false, team: true, personal: true },
    });
  });

  it("gives viewers read access and no create abilities", async () => {
    const ctx = await setup();
    const objective = await buildObjective(ctx, { ownerId: ctx.admin.id });
    await buildKeyResult(ctx, objective, { ownerId: ctx.viewer.id });

    const res = await post("goals.overview", ctx.viewer);
    const data: GoalsOverviewJSON = res.body.data;

    expect(res.status).toEqual(200);
    expect(data.abilities).toEqual({
      createCycle: false,
      createObjective: { church: false, team: false, personal: false },
    });
    expect(data.objectives[0].abilities.update).toEqual(false);
    expect(data.keyResults[0].abilities).toEqual({
      update: false,
      delete: false,
      checkIn: true,
    });
  });

  describe("cycle selection", () => {
    async function withCycles(ranges: Array<[number, number]>) {
      const team = await buildTeam();
      const admin = await buildAdmin({ teamId: team.id });
      const cycles = [];
      for (const [start, end] of ranges) {
        cycles.push(
          await GoalCycle.create({
            teamId: team.id,
            name: `Cycle ${start}`,
            startsAt: addDaysToDay(today(), start),
            endsAt: addDaysToDay(today(), end),
            createdById: admin.id,
          })
        );
      }
      return { admin, cycles };
    }

    it("picks the cycle containing today", async () => {
      const { admin, cycles } = await withCycles([
        [-60, -30],
        [-5, 5],
        [10, 40],
      ]);
      const res = await post("goals.overview", admin);
      expect(res.body.data.cycle.id).toEqual(cycles[1].id);
      expect(res.body.data.cycles.map((c: { id: string }) => c.id)).toEqual([
        cycles[2].id,
        cycles[1].id,
        cycles[0].id,
      ]);
    });

    it("counts a cycle ending today as current", async () => {
      const { admin, cycles } = await withCycles([
        [-30, 0],
        [1, 30],
      ]);
      const res = await post("goals.overview", admin);
      expect(res.body.data.cycle.id).toEqual(cycles[0].id);
    });

    it("picks the next upcoming cycle when none contains today", async () => {
      const { admin, cycles } = await withCycles([
        [-60, -30],
        [40, 70],
        [10, 30],
      ]);
      const res = await post("goals.overview", admin);
      expect(res.body.data.cycle.id).toEqual(cycles[2].id);
    });

    it("picks the most recent cycle when all have ended", async () => {
      const { admin, cycles } = await withCycles([
        [-90, -60],
        [-50, -20],
      ]);
      const res = await post("goals.overview", admin);
      expect(res.body.data.cycle.id).toEqual(cycles[1].id);
    });

    it("returns the requested cycle", async () => {
      const { admin, cycles } = await withCycles([
        [-90, -60],
        [-5, 5],
      ]);
      const res = await post("goals.overview", admin, {
        cycleId: cycles[0].id,
      });
      expect(res.body.data.cycle.id).toEqual(cycles[0].id);
    });

    it("returns 404 for another workspace's cycle", async () => {
      const ctx = await setup();
      const other = await setup();
      const res = await post("goals.overview", ctx.admin, {
        cycleId: other.cycle.id,
      });
      expect(res.status).toEqual(404);
    });
  });
});

describe("#goalCycles.create", () => {
  it("lets admins create a cycle", async () => {
    const ctx = await setup();
    const res = await post("goalCycles.create", ctx.admin, {
      name: "Term 1 2027",
      startsAt: "2027-02-01",
      endsAt: "2027-04-10",
    });
    expect(res.status).toEqual(200);
    expect(res.body.data).toMatchObject({
      name: "Term 1 2027",
      startsAt: "2027-02-01",
      endsAt: "2027-04-10",
      abilities: { update: true, delete: true },
    });
    const cycle = await GoalCycle.findByPk(res.body.data.id);
    expect(cycle?.teamId).toEqual(ctx.team.id);
    expect(cycle?.createdById).toEqual(ctx.admin.id);
  });

  it.each(["member", "viewer", "guest"] as const)(
    "does not let a %s create a cycle",
    async (role) => {
      const ctx = await setup();
      const res = await post("goalCycles.create", ctx[role], {
        name: "Term 1 2027",
        startsAt: "2027-02-01",
        endsAt: "2027-04-10",
      });
      expect(res.status).toEqual(403);
    }
  );

  it("rejects an end date before the start date", async () => {
    const ctx = await setup();
    const res = await post("goalCycles.create", ctx.admin, {
      name: "Backwards",
      startsAt: "2027-02-01",
      endsAt: "2027-01-31",
    });
    expect(res.status).toEqual(400);
    expect(res.body.message).toEqual(
      "End date must be on or after the start date"
    );
  });

  it("allows a single-day cycle", async () => {
    const ctx = await setup();
    const res = await post("goalCycles.create", ctx.admin, {
      name: "Retreat",
      startsAt: "2027-02-01",
      endsAt: "2027-02-01",
    });
    expect(res.status).toEqual(200);
  });

  it("validates the input", async () => {
    const ctx = await setup();
    const badDate = await post("goalCycles.create", ctx.admin, {
      name: "Term",
      startsAt: "01/02/2027",
      endsAt: "2027-04-10",
    });
    expect(badDate.status).toEqual(400);

    const noName = await post("goalCycles.create", ctx.admin, {
      name: "  ",
      startsAt: "2027-02-01",
      endsAt: "2027-04-10",
    });
    expect(noName.status).toEqual(400);
  });
});

describe("#goalCycles.update", () => {
  it("lets admins update a cycle", async () => {
    const ctx = await setup();
    const res = await post("goalCycles.update", ctx.admin, {
      id: ctx.cycle.id,
      name: "Renamed",
      endsAt: addDaysToDay(today(), 60),
    });
    expect(res.status).toEqual(200);
    expect(res.body.data.name).toEqual("Renamed");
    expect(res.body.data.endsAt).toEqual(addDaysToDay(today(), 60));
    expect(res.body.data.startsAt).toEqual(addDaysToDay(today(), -10));
  });

  it("checks the dates against the stored ones", async () => {
    const ctx = await setup();
    const res = await post("goalCycles.update", ctx.admin, {
      id: ctx.cycle.id,
      startsAt: addDaysToDay(today(), 31),
    });
    expect(res.status).toEqual(400);
  });

  it("does not let members update a cycle", async () => {
    const ctx = await setup();
    const res = await post("goalCycles.update", ctx.member, {
      id: ctx.cycle.id,
      name: "Nope",
    });
    expect(res.status).toEqual(403);
  });

  it("returns 404 for another workspace's cycle", async () => {
    const ctx = await setup();
    const other = await setup();
    const res = await post("goalCycles.update", ctx.admin, {
      id: other.cycle.id,
      name: "Nope",
    });
    expect(res.status).toEqual(404);
  });
});

describe("#goalCycles.delete", () => {
  it("lets admins delete a cycle and everything in it", async () => {
    const ctx = await setup();
    const church = await buildObjective(ctx, { ownerId: ctx.admin.id });
    const team = await buildObjective(ctx, {
      ownerId: ctx.member.id,
      level: GoalLevel.Team,
      groupId: ctx.group.id,
      parentId: church.id,
    });
    const kr = await buildKeyResult(ctx, team, { ownerId: ctx.member.id });
    await GoalCheckIn.create({
      teamId: ctx.team.id,
      keyResultId: kr.id,
      userId: ctx.member.id,
      value: 410,
      status: GoalStatus.OnTrack,
    });

    const res = await post("goalCycles.delete", ctx.admin, {
      id: ctx.cycle.id,
    });
    expect(res.status).toEqual(200);
    expect(res.body.success).toEqual(true);
    expect(await GoalCycle.count({ where: { id: ctx.cycle.id } })).toEqual(0);
    expect(
      await GoalObjective.count({ where: { cycleId: ctx.cycle.id } })
    ).toEqual(0);
    expect(await GoalKeyResult.count({ where: { id: kr.id } })).toEqual(0);
    expect(await GoalCheckIn.count({ where: { keyResultId: kr.id } })).toEqual(
      0
    );
  });

  it("does not let members delete a cycle", async () => {
    const ctx = await setup();
    const res = await post("goalCycles.delete", ctx.member, {
      id: ctx.cycle.id,
    });
    expect(res.status).toEqual(403);
  });
});

describe("#goalObjectives.create", () => {
  it("lets admins create a church objective", async () => {
    const ctx = await setup();
    const res = await post("goalObjectives.create", ctx.admin, {
      cycleId: ctx.cycle.id,
      level: GoalLevel.Church,
      title: "Reach our city with the hope of Jesus",
      description: "",
    });
    const data: GoalObjectiveJSON = res.body.data;
    expect(res.status).toEqual(200);
    expect(data).toMatchObject({
      level: GoalLevel.Church,
      ownerId: ctx.admin.id,
      createdById: ctx.admin.id,
      description: null,
      groupId: null,
      parentId: null,
      progress: 0,
      status: null,
      abilities: { update: true, delete: true, createKeyResult: true },
    });
  });

  it("does not let members create a church objective", async () => {
    const ctx = await setup();
    const res = await post("goalObjectives.create", ctx.member, {
      cycleId: ctx.cycle.id,
      level: GoalLevel.Church,
      title: "Church goal",
    });
    expect(res.status).toEqual(403);
  });

  it("lets members create team objectives for a group", async () => {
    const ctx = await setup();
    const res = await post("goalObjectives.create", ctx.member, {
      cycleId: ctx.cycle.id,
      level: GoalLevel.Team,
      title: "Build a volunteer bench",
      groupId: ctx.group.id,
      ownerId: ctx.otherMember.id,
    });
    expect(res.status).toEqual(200);
    expect(res.body.data).toMatchObject({
      groupId: ctx.group.id,
      ownerId: ctx.otherMember.id,
      createdById: ctx.member.id,
    });
  });

  it("lets members create personal objectives for themselves only", async () => {
    const ctx = await setup();
    const own = await post("goalObjectives.create", ctx.member, {
      cycleId: ctx.cycle.id,
      level: GoalLevel.Personal,
      title: "Read more",
    });
    expect(own.status).toEqual(200);
    expect(own.body.data.ownerId).toEqual(ctx.member.id);

    const forSomeoneElse = await post("goalObjectives.create", ctx.member, {
      cycleId: ctx.cycle.id,
      level: GoalLevel.Personal,
      title: "Read more",
      ownerId: ctx.otherMember.id,
    });
    expect(forSomeoneElse.status).toEqual(403);
  });

  it("lets admins create personal objectives for others", async () => {
    const ctx = await setup();
    const res = await post("goalObjectives.create", ctx.admin, {
      cycleId: ctx.cycle.id,
      level: GoalLevel.Personal,
      title: "Grow as a leader",
      ownerId: ctx.member.id,
    });
    expect(res.status).toEqual(200);
    expect(res.body.data.ownerId).toEqual(ctx.member.id);
  });

  it.each([GoalLevel.Church, GoalLevel.Team, GoalLevel.Personal])(
    "does not let viewers create %s objectives",
    async (level) => {
      const ctx = await setup();
      const res = await post("goalObjectives.create", ctx.viewer, {
        cycleId: ctx.cycle.id,
        level,
        title: "Nope",
        groupId: level === GoalLevel.Team ? ctx.group.id : undefined,
      });
      expect(res.status).toEqual(403);
    }
  );

  it("does not let guests create objectives", async () => {
    const ctx = await setup();
    const res = await post("goalObjectives.create", ctx.guest, {
      cycleId: ctx.cycle.id,
      level: GoalLevel.Personal,
      title: "Nope",
    });
    expect(res.status).toEqual(403);
  });

  describe("groups", () => {
    it("requires a group for team objectives", async () => {
      const ctx = await setup();
      const res = await post("goalObjectives.create", ctx.member, {
        cycleId: ctx.cycle.id,
        level: GoalLevel.Team,
        title: "No group",
      });
      expect(res.status).toEqual(400);
      expect(res.body.message).toEqual("A team objective needs a group");
    });

    it("requires the group to belong to the workspace", async () => {
      const ctx = await setup();
      const other = await setup();
      const res = await post("goalObjectives.create", ctx.member, {
        cycleId: ctx.cycle.id,
        level: GoalLevel.Team,
        title: "Wrong group",
        groupId: other.group.id,
      });
      expect(res.status).toEqual(400);
    });

    it.each([GoalLevel.Church, GoalLevel.Personal])(
      "rejects a group on %s objectives",
      async (level) => {
        const ctx = await setup();
        const res = await post("goalObjectives.create", ctx.admin, {
          cycleId: ctx.cycle.id,
          level,
          title: "With group",
          groupId: ctx.group.id,
        });
        expect(res.status).toEqual(400);
      }
    );
  });

  describe("owners", () => {
    it("rejects suspended, guest and other workspace owners", async () => {
      const ctx = await setup();
      const other = await setup();
      const suspended = await buildUser({
        teamId: ctx.team.id,
        suspendedAt: new Date(),
      });
      for (const owner of [suspended, ctx.guest, other.member]) {
        const res = await post("goalObjectives.create", ctx.admin, {
          cycleId: ctx.cycle.id,
          level: GoalLevel.Personal,
          title: "Owned",
          ownerId: owner.id,
        });
        expect(res.status).toEqual(400);
        expect(res.body.message).toEqual(
          "Owner must be an active member of the workspace"
        );
      }
    });

    it("allows viewers as owners", async () => {
      const ctx = await setup();
      const res = await post("goalObjectives.create", ctx.admin, {
        cycleId: ctx.cycle.id,
        level: GoalLevel.Personal,
        title: "Owned by a viewer",
        ownerId: ctx.viewer.id,
      });
      expect(res.status).toEqual(200);
    });
  });

  describe("alignment", () => {
    async function withParents() {
      const ctx = await setup();
      const church = await buildObjective(ctx, { ownerId: ctx.admin.id });
      const team = await buildObjective(ctx, {
        ownerId: ctx.admin.id,
        level: GoalLevel.Team,
        groupId: ctx.group.id,
      });
      const personal = await buildObjective(ctx, {
        ownerId: ctx.member.id,
        level: GoalLevel.Personal,
      });
      return { ctx, church, team, personal };
    }

    it("allows aligning upwards", async () => {
      const { ctx, church, team } = await withParents();
      const cases = [
        { level: GoalLevel.Team, parentId: church.id, groupId: ctx.group.id },
        { level: GoalLevel.Personal, parentId: church.id },
        { level: GoalLevel.Personal, parentId: team.id },
      ];
      for (const input of cases) {
        const res = await post("goalObjectives.create", ctx.member, {
          cycleId: ctx.cycle.id,
          title: "Aligned",
          ...input,
        });
        expect(res.status).toEqual(200);
        expect(res.body.data.parentId).toEqual(input.parentId);
      }
    });

    it("rejects aligning sideways, downwards or from church", async () => {
      const { ctx, church, team, personal } = await withParents();
      const cases = [
        { level: GoalLevel.Church, parentId: church.id },
        { level: GoalLevel.Team, parentId: team.id, groupId: ctx.group.id },
        {
          level: GoalLevel.Team,
          parentId: personal.id,
          groupId: ctx.group.id,
        },
        { level: GoalLevel.Personal, parentId: personal.id },
      ];
      for (const input of cases) {
        const res = await post("goalObjectives.create", ctx.admin, {
          cycleId: ctx.cycle.id,
          title: "Misaligned",
          ...input,
        });
        expect(res.status).toEqual(400);
      }
    });

    it("rejects aligning to an objective in another cycle", async () => {
      const { ctx, church } = await withParents();
      const nextCycle = await GoalCycle.create({
        teamId: ctx.team.id,
        name: "Next",
        startsAt: addDaysToDay(today(), 40),
        endsAt: addDaysToDay(today(), 80),
        createdById: ctx.admin.id,
      });
      const res = await post("goalObjectives.create", ctx.member, {
        cycleId: nextCycle.id,
        level: GoalLevel.Personal,
        title: "Cross cycle",
        parentId: church.id,
      });
      expect(res.status).toEqual(400);
      expect(res.body.message).toEqual(
        "Objectives can only align to an objective in the same cycle"
      );
    });
  });
});

describe("#goalObjectives.update", () => {
  it("lets the owner, the creator and admins edit", async () => {
    const ctx = await setup();
    const objective = await buildObjective(ctx, {
      level: GoalLevel.Team,
      groupId: ctx.group.id,
      ownerId: ctx.member.id,
      createdById: ctx.otherMember.id,
    });
    for (const user of [ctx.member, ctx.otherMember, ctx.admin]) {
      const res = await post("goalObjectives.update", user, {
        id: objective.id,
        title: `Edited by ${user.id}`,
      });
      expect(res.status).toEqual(200);
      expect(res.body.data.title).toEqual(`Edited by ${user.id}`);
    }
  });

  it("does not let other members, viewers or guests edit", async () => {
    const ctx = await setup();
    const third = await buildUser({ teamId: ctx.team.id });
    const objective = await buildObjective(ctx, {
      level: GoalLevel.Team,
      groupId: ctx.group.id,
      ownerId: ctx.member.id,
      createdById: ctx.member.id,
    });
    for (const user of [third, ctx.viewer, ctx.guest]) {
      const res = await post("goalObjectives.update", user, {
        id: objective.id,
        title: "Nope",
      });
      expect(res.status).toEqual(403);
    }
  });

  it("does not let a viewer who owns an objective edit it", async () => {
    const ctx = await setup();
    const objective = await buildObjective(ctx, {
      level: GoalLevel.Personal,
      ownerId: ctx.viewer.id,
    });
    const res = await post("goalObjectives.update", ctx.viewer, {
      id: objective.id,
      title: "Nope",
    });
    expect(res.status).toEqual(403);
  });

  it("does not let members promote an objective to church level", async () => {
    const ctx = await setup();
    const objective = await buildObjective(ctx, {
      level: GoalLevel.Personal,
      ownerId: ctx.member.id,
      createdById: ctx.member.id,
    });
    const res = await post("goalObjectives.update", ctx.member, {
      id: objective.id,
      level: GoalLevel.Church,
    });
    expect(res.status).toEqual(403);
  });

  it("does not let members hand a personal objective to someone else", async () => {
    const ctx = await setup();
    const objective = await buildObjective(ctx, {
      level: GoalLevel.Personal,
      ownerId: ctx.member.id,
      createdById: ctx.member.id,
    });
    const res = await post("goalObjectives.update", ctx.member, {
      id: objective.id,
      ownerId: ctx.otherMember.id,
    });
    expect(res.status).toEqual(403);
  });

  it("clears the group and fixes alignment when the level changes", async () => {
    const ctx = await setup();
    const church = await buildObjective(ctx, { ownerId: ctx.admin.id });
    const team = await buildObjective(ctx, {
      level: GoalLevel.Team,
      groupId: ctx.group.id,
      parentId: church.id,
      ownerId: ctx.member.id,
      createdById: ctx.member.id,
    });
    const child = await buildObjective(ctx, {
      level: GoalLevel.Personal,
      parentId: team.id,
      ownerId: ctx.otherMember.id,
    });

    const res = await post("goalObjectives.update", ctx.member, {
      id: team.id,
      level: GoalLevel.Personal,
    });
    expect(res.status).toEqual(200);
    expect(res.body.data).toMatchObject({
      level: GoalLevel.Personal,
      groupId: null,
      parentId: church.id,
    });

    // A personal objective can no longer align to it.
    await child.reload();
    expect(child.parentId).toBeNull();
  });

  it("requires a group when changing to team level", async () => {
    const ctx = await setup();
    const objective = await buildObjective(ctx, {
      level: GoalLevel.Personal,
      ownerId: ctx.member.id,
      createdById: ctx.member.id,
    });
    const missing = await post("goalObjectives.update", ctx.member, {
      id: objective.id,
      level: GoalLevel.Team,
    });
    expect(missing.status).toEqual(400);

    const withGroup = await post("goalObjectives.update", ctx.member, {
      id: objective.id,
      level: GoalLevel.Team,
      groupId: ctx.group.id,
    });
    expect(withGroup.status).toEqual(200);
    expect(withGroup.body.data.groupId).toEqual(ctx.group.id);
  });

  it("validates an explicit parent and allows clearing it", async () => {
    const ctx = await setup();
    const church = await buildObjective(ctx, { ownerId: ctx.admin.id });
    const personal = await buildObjective(ctx, {
      level: GoalLevel.Personal,
      ownerId: ctx.member.id,
      createdById: ctx.member.id,
    });
    const other = await buildObjective(ctx, {
      level: GoalLevel.Personal,
      ownerId: ctx.otherMember.id,
    });

    const invalid = await post("goalObjectives.update", ctx.member, {
      id: personal.id,
      parentId: other.id,
    });
    expect(invalid.status).toEqual(400);

    const self = await post("goalObjectives.update", ctx.member, {
      id: personal.id,
      parentId: personal.id,
    });
    expect(self.status).toEqual(400);

    const aligned = await post("goalObjectives.update", ctx.member, {
      id: personal.id,
      parentId: church.id,
    });
    expect(aligned.status).toEqual(200);
    expect(aligned.body.data.parentId).toEqual(church.id);

    const cleared = await post("goalObjectives.update", ctx.member, {
      id: personal.id,
      parentId: null,
    });
    expect(cleared.status).toEqual(200);
    expect(cleared.body.data.parentId).toBeNull();
  });
});

describe("#goalObjectives.delete", () => {
  it("deletes key results and unaligns children", async () => {
    const ctx = await setup();
    const church = await buildObjective(ctx, {
      ownerId: ctx.member.id,
      createdById: ctx.admin.id,
    });
    const child = await buildObjective(ctx, {
      level: GoalLevel.Personal,
      parentId: church.id,
      ownerId: ctx.otherMember.id,
    });
    const kr = await buildKeyResult(ctx, church, { ownerId: ctx.member.id });

    const res = await post("goalObjectives.delete", ctx.member, {
      id: church.id,
    });
    expect(res.status).toEqual(200);
    expect(res.body.success).toEqual(true);
    expect(await GoalObjective.count({ where: { id: church.id } })).toEqual(0);
    expect(await GoalKeyResult.count({ where: { id: kr.id } })).toEqual(0);
    await child.reload();
    expect(child.parentId).toBeNull();
  });

  it("does not let other members or viewers delete", async () => {
    const ctx = await setup();
    const objective = await buildObjective(ctx, {
      level: GoalLevel.Personal,
      ownerId: ctx.member.id,
      createdById: ctx.member.id,
    });
    for (const user of [ctx.otherMember, ctx.viewer]) {
      const res = await post("goalObjectives.delete", user, {
        id: objective.id,
      });
      expect(res.status).toEqual(403);
    }
  });
});

describe("#goalKeyResults.create", () => {
  it("creates a metric key result owned by the creator by default", async () => {
    const ctx = await setup();
    const objective = await buildObjective(ctx, {
      level: GoalLevel.Personal,
      ownerId: ctx.member.id,
      createdById: ctx.member.id,
    });
    const res = await post("goalKeyResults.create", ctx.member, {
      objectiveId: objective.id,
      title: "Read 12 books",
      type: KeyResultType.Metric,
      targetValue: 12,
      unit: "books",
    });
    const data: GoalKeyResultJSON = res.body.data;
    expect(res.status).toEqual(200);
    expect(data).toMatchObject({
      objectiveId: objective.id,
      ownerId: ctx.member.id,
      startValue: 0,
      targetValue: 12,
      currentValue: 0,
      unit: "books",
      status: null,
      lastCheckInAt: null,
      progress: 0,
      abilities: { update: true, delete: true, checkIn: true },
    });
  });

  it("allows decreasing targets", async () => {
    const ctx = await setup();
    const objective = await buildObjective(ctx, { ownerId: ctx.admin.id });
    const res = await post("goalKeyResults.create", ctx.admin, {
      objectiveId: objective.id,
      title: "Reduce waiting list",
      type: KeyResultType.Metric,
      startValue: 20,
      targetValue: 5,
    });
    expect(res.status).toEqual(200);
    expect(res.body.data.currentValue).toEqual(20);
  });

  it("forces milestones to run from 0 to 1", async () => {
    const ctx = await setup();
    const objective = await buildObjective(ctx, { ownerId: ctx.admin.id });
    const res = await post("goalKeyResults.create", ctx.admin, {
      objectiveId: objective.id,
      title: "Launch Alpha",
      type: KeyResultType.Milestone,
      startValue: 5,
      targetValue: 50,
      ownerId: ctx.viewer.id,
    });
    expect(res.status).toEqual(200);
    expect(res.body.data).toMatchObject({
      startValue: 0,
      targetValue: 1,
      currentValue: 0,
      ownerId: ctx.viewer.id,
    });
  });

  it("validates metric values", async () => {
    const ctx = await setup();
    const objective = await buildObjective(ctx, { ownerId: ctx.admin.id });
    const same = await post("goalKeyResults.create", ctx.admin, {
      objectiveId: objective.id,
      title: "Flat",
      type: KeyResultType.Metric,
      startValue: 10,
      targetValue: 10,
    });
    expect(same.status).toEqual(400);
    expect(same.body.message).toEqual(
      "Target value must be different from the start value"
    );

    const noTarget = await post("goalKeyResults.create", ctx.admin, {
      objectiveId: objective.id,
      title: "No target",
      type: KeyResultType.Metric,
    });
    expect(noTarget.status).toEqual(400);
  });

  it("only lets those who can edit the objective add key results", async () => {
    const ctx = await setup();
    const objective = await buildObjective(ctx, {
      level: GoalLevel.Team,
      groupId: ctx.group.id,
      ownerId: ctx.member.id,
      createdById: ctx.admin.id,
    });
    for (const user of [ctx.otherMember, ctx.viewer, ctx.guest]) {
      const res = await post("goalKeyResults.create", user, {
        objectiveId: objective.id,
        title: "Nope",
        type: KeyResultType.Milestone,
      });
      expect(res.status).toEqual(403);
    }
  });

  it("returns 404 for another workspace's objective", async () => {
    const ctx = await setup();
    const other = await setup();
    const objective = await buildObjective(other, { ownerId: other.admin.id });
    const res = await post("goalKeyResults.create", ctx.admin, {
      objectiveId: objective.id,
      title: "Nope",
      type: KeyResultType.Milestone,
    });
    expect(res.status).toEqual(404);
  });
});

describe("#goalKeyResults.update", () => {
  it("lets the key result owner edit it", async () => {
    const ctx = await setup();
    const objective = await buildObjective(ctx, { ownerId: ctx.admin.id });
    const kr = await buildKeyResult(ctx, objective, {
      ownerId: ctx.otherMember.id,
    });
    const res = await post("goalKeyResults.update", ctx.otherMember, {
      id: kr.id,
      title: "Attendance reaches 460",
      targetValue: 460,
    });
    expect(res.status).toEqual(200);
    expect(res.body.data).toMatchObject({
      title: "Attendance reaches 460",
      targetValue: 460,
      abilities: { update: true, delete: false, checkIn: true },
    });
  });

  it("does not let other members or viewers edit", async () => {
    const ctx = await setup();
    const objective = await buildObjective(ctx, { ownerId: ctx.admin.id });
    const kr = await buildKeyResult(ctx, objective, { ownerId: ctx.viewer.id });
    for (const user of [ctx.member, ctx.viewer]) {
      const res = await post("goalKeyResults.update", user, {
        id: kr.id,
        title: "Nope",
      });
      expect(res.status).toEqual(403);
    }
  });

  it("moves the current value with the start value until the first check-in", async () => {
    const ctx = await setup();
    const objective = await buildObjective(ctx, { ownerId: ctx.admin.id });
    const kr = await buildKeyResult(ctx, objective, { ownerId: ctx.admin.id });
    const res = await post("goalKeyResults.update", ctx.admin, {
      id: kr.id,
      startValue: 380,
    });
    expect(res.status).toEqual(200);
    expect(res.body.data.currentValue).toEqual(380);
  });

  it("leaves check-ins alone when the start or target changes", async () => {
    const ctx = await setup();
    const objective = await buildObjective(ctx, { ownerId: ctx.admin.id });
    const kr = await buildKeyResult(ctx, objective, { ownerId: ctx.admin.id });
    const checkIn = await post("goalCheckIns.create", ctx.admin, {
      keyResultId: kr.id,
      value: 420,
      status: GoalStatus.OnTrack,
    });
    expect(checkIn.status).toEqual(200);

    const res = await post("goalKeyResults.update", ctx.admin, {
      id: kr.id,
      startValue: 300,
      targetValue: 500,
    });
    expect(res.status).toEqual(200);
    expect(res.body.data).toMatchObject({
      startValue: 300,
      targetValue: 500,
      currentValue: 420,
      status: GoalStatus.OnTrack,
    });
    expect(res.body.data.progress).toBeCloseTo(0.6);
    const stored = await GoalCheckIn.findAll({ where: { keyResultId: kr.id } });
    expect(stored.map((c) => c.value)).toEqual([420]);
  });

  it("rejects a target equal to the start", async () => {
    const ctx = await setup();
    const objective = await buildObjective(ctx, { ownerId: ctx.admin.id });
    const kr = await buildKeyResult(ctx, objective, { ownerId: ctx.admin.id });
    const res = await post("goalKeyResults.update", ctx.admin, {
      id: kr.id,
      targetValue: 400,
    });
    expect(res.status).toEqual(400);
  });
});

describe("#goalKeyResults.delete", () => {
  it("lets admins and the objective's owner or creator delete", async () => {
    const ctx = await setup();
    const objective = await buildObjective(ctx, {
      level: GoalLevel.Team,
      groupId: ctx.group.id,
      ownerId: ctx.member.id,
      createdById: ctx.otherMember.id,
    });
    for (const user of [ctx.member, ctx.otherMember, ctx.admin]) {
      const kr = await buildKeyResult(ctx, objective, {
        ownerId: ctx.viewer.id,
      });
      const res = await post("goalKeyResults.delete", user, { id: kr.id });
      expect(res.status).toEqual(200);
      expect(await GoalKeyResult.count({ where: { id: kr.id } })).toEqual(0);
    }
  });

  it("does not let the key result owner delete it", async () => {
    const ctx = await setup();
    const objective = await buildObjective(ctx, { ownerId: ctx.admin.id });
    const kr = await buildKeyResult(ctx, objective, {
      ownerId: ctx.member.id,
    });
    const res = await post("goalKeyResults.delete", ctx.member, { id: kr.id });
    expect(res.status).toEqual(403);
  });
});

describe("#goalCheckIns.create", () => {
  it("updates the key result and returns it with its objective", async () => {
    const ctx = await setup();
    const objective = await buildObjective(ctx, { ownerId: ctx.admin.id });
    const kr = await buildKeyResult(ctx, objective, {
      ownerId: ctx.member.id,
    });
    const res = await post("goalCheckIns.create", ctx.member, {
      keyResultId: kr.id,
      value: 425,
      status: GoalStatus.AtRisk,
      note: "Summer dip",
    });
    const checkIn: GoalCheckInJSON = res.body.data;
    expect(res.status).toEqual(200);
    expect(checkIn).toMatchObject({
      keyResultId: kr.id,
      userId: ctx.member.id,
      value: 425,
      status: GoalStatus.AtRisk,
      note: "Summer dip",
      abilities: { delete: true },
    });
    expect(res.body.keyResult).toMatchObject({
      id: kr.id,
      currentValue: 425,
      status: GoalStatus.AtRisk,
      lastCheckInAt: checkIn.createdAt,
      progress: 0.5,
    });
    expect(res.body.objective).toMatchObject({
      id: objective.id,
      progress: 0.5,
      status: GoalStatus.AtRisk,
    });

    await kr.reload();
    expect(kr.currentValue).toEqual(425);
    expect(kr.lastCheckInAt?.toISOString()).toEqual(checkIn.createdAt);
  });

  it("stores milestone values as done or not done", async () => {
    const ctx = await setup();
    const objective = await buildObjective(ctx, { ownerId: ctx.admin.id });
    const kr = await buildKeyResult(ctx, objective, {
      ownerId: ctx.admin.id,
      type: KeyResultType.Milestone,
      startValue: 0,
      targetValue: 1,
      currentValue: 0,
    });
    const res = await post("goalCheckIns.create", ctx.admin, {
      keyResultId: kr.id,
      value: 7,
      status: GoalStatus.OnTrack,
    });
    expect(res.status).toEqual(200);
    expect(res.body.data.value).toEqual(1);
    expect(res.body.keyResult.progress).toEqual(1);
  });

  it("lets admins, the key result owner and the objective owner check in", async () => {
    const ctx = await setup();
    const objective = await buildObjective(ctx, {
      level: GoalLevel.Team,
      groupId: ctx.group.id,
      ownerId: ctx.otherMember.id,
    });
    const kr = await buildKeyResult(ctx, objective, {
      ownerId: ctx.viewer.id,
    });
    for (const user of [ctx.admin, ctx.viewer, ctx.otherMember]) {
      const res = await post("goalCheckIns.create", user, {
        keyResultId: kr.id,
        value: 410,
        status: GoalStatus.OnTrack,
      });
      expect(res.status).toEqual(200);
    }
  });

  it("does not let others check in", async () => {
    const ctx = await setup();
    const objective = await buildObjective(ctx, {
      level: GoalLevel.Personal,
      ownerId: ctx.viewer.id,
      createdById: ctx.member.id,
    });
    const kr = await buildKeyResult(ctx, objective, {
      ownerId: ctx.otherMember.id,
    });
    // The objective's creator, a viewer who owns the objective but not the
    // key result, and a guest.
    for (const user of [ctx.member, ctx.viewer, ctx.guest]) {
      const res = await post("goalCheckIns.create", user, {
        keyResultId: kr.id,
        value: 410,
        status: GoalStatus.OnTrack,
      });
      expect(res.status).toEqual(403);
    }
  });

  it("validates the status and note", async () => {
    const ctx = await setup();
    const objective = await buildObjective(ctx, { ownerId: ctx.admin.id });
    const kr = await buildKeyResult(ctx, objective, { ownerId: ctx.admin.id });
    const badStatus = await post("goalCheckIns.create", ctx.admin, {
      keyResultId: kr.id,
      value: 410,
      status: "great",
    });
    expect(badStatus.status).toEqual(400);

    const longNote = await post("goalCheckIns.create", ctx.admin, {
      keyResultId: kr.id,
      value: 410,
      status: GoalStatus.OnTrack,
      note: "x".repeat(2001),
    });
    expect(longNote.status).toEqual(400);
  });
});

describe("#goalCheckIns.list", () => {
  it("returns check-ins newest first with their authors", async () => {
    const ctx = await setup();
    const objective = await buildObjective(ctx, { ownerId: ctx.admin.id });
    const kr = await buildKeyResult(ctx, objective, {
      ownerId: ctx.member.id,
    });
    const first = await GoalCheckIn.create({
      teamId: ctx.team.id,
      keyResultId: kr.id,
      userId: ctx.member.id,
      value: 405,
      status: GoalStatus.OnTrack,
      createdAt: new Date(Date.now() - 14 * 86400000),
    });
    const second = await GoalCheckIn.create({
      teamId: ctx.team.id,
      keyResultId: kr.id,
      userId: ctx.admin.id,
      value: 415,
      status: GoalStatus.AtRisk,
      createdAt: new Date(Date.now() - 7 * 86400000),
    });

    const res = await post("goalCheckIns.list", ctx.viewer, {
      keyResultId: kr.id,
    });
    expect(res.status).toEqual(200);
    expect(res.body.data.map((c: GoalCheckInJSON) => c.id)).toEqual([
      second.id,
      first.id,
    ]);
    expect(res.body.data[0].abilities).toEqual({ delete: false });
    expect(res.body.users.map((u: { id: string }) => u.id).sort()).toEqual(
      [ctx.member.id, ctx.admin.id].sort()
    );
  });

  it("rejects guests and other workspaces", async () => {
    const ctx = await setup();
    const other = await setup();
    const objective = await buildObjective(ctx, { ownerId: ctx.admin.id });
    const kr = await buildKeyResult(ctx, objective, { ownerId: ctx.admin.id });

    const guest = await post("goalCheckIns.list", ctx.guest, {
      keyResultId: kr.id,
    });
    expect(guest.status).toEqual(403);

    const outsider = await post("goalCheckIns.list", other.admin, {
      keyResultId: kr.id,
    });
    expect(outsider.status).toEqual(404);
  });
});

describe("#goalCheckIns.delete", () => {
  async function withCheckIns() {
    const ctx = await setup();
    const objective = await buildObjective(ctx, { ownerId: ctx.admin.id });
    const kr = await buildKeyResult(ctx, objective, {
      ownerId: ctx.viewer.id,
    });
    const older = await post("goalCheckIns.create", ctx.viewer, {
      keyResultId: kr.id,
      value: 410,
      status: GoalStatus.OnTrack,
    });
    const newer = await post("goalCheckIns.create", ctx.viewer, {
      keyResultId: kr.id,
      value: 430,
      status: GoalStatus.OffTrack,
    });
    return {
      ctx,
      kr,
      older: older.body.data as GoalCheckInJSON,
      newer: newer.body.data as GoalCheckInJSON,
    };
  }

  it("restores the key result from the newest remaining check-in", async () => {
    const { ctx, kr, older, newer } = await withCheckIns();
    const res = await post("goalCheckIns.delete", ctx.viewer, {
      id: newer.id,
    });
    expect(res.status).toEqual(200);
    expect(res.body.success).toEqual(true);

    await kr.reload();
    expect(kr.currentValue).toEqual(410);
    expect(kr.status).toEqual(GoalStatus.OnTrack);
    expect(kr.lastCheckInAt?.toISOString()).toEqual(older.createdAt);
  });

  it("resets the key result when the last check-in is deleted", async () => {
    const { ctx, kr, older, newer } = await withCheckIns();
    await post("goalCheckIns.delete", ctx.admin, { id: newer.id });
    const res = await post("goalCheckIns.delete", ctx.admin, { id: older.id });
    expect(res.status).toEqual(200);

    await kr.reload();
    expect(kr.currentValue).toEqual(400);
    expect(kr.status).toBeNull();
    expect(kr.lastCheckInAt).toBeNull();
  });

  it("only lets admins and the author delete", async () => {
    const { ctx, newer } = await withCheckIns();
    for (const user of [ctx.member, ctx.otherMember, ctx.guest]) {
      const res = await post("goalCheckIns.delete", user, { id: newer.id });
      expect(res.status).toEqual(403);
    }
  });

  it("returns 404 for another workspace's check-in", async () => {
    const { newer } = await withCheckIns();
    const other = await setup();
    const res = await post("goalCheckIns.delete", other.admin, {
      id: newer.id,
    });
    expect(res.status).toEqual(404);
  });
});
