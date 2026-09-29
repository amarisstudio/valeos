import type { Group, User } from "@server/models";
import {
  keyResultProgress,
  meanProgress,
  worstStatus,
} from "../shared/progress";
import type {
  GoalCheckInJSON,
  GoalCycleJSON,
  GoalGroupJSON,
  GoalKeyResultJSON,
  GoalObjectiveJSON,
  GoalUserJSON,
} from "../shared/types";
import type {
  GoalCheckIn,
  GoalCycle,
  GoalKeyResult,
  GoalObjective,
} from "./models";
import {
  canCheckIn,
  canCreateKeyResult,
  canDeleteCheckIn,
  canDeleteKeyResult,
  canDeleteObjective,
  canManageCycles,
  canUpdateKeyResult,
  canUpdateObjective,
} from "./policies";

/**
 * Formats a DATEONLY value as YYYY-MM-DD.
 *
 * @param value - the value as stored, a string or a Date.
 * @returns the calendar date.
 */
function toDay(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
}

/**
 * Formats a timestamp as an ISO string.
 *
 * @param value - the timestamp.
 * @returns the ISO string.
 */
function toISO(value: Date | string): string {
  return new Date(value).toISOString();
}

/**
 * Presents a cycle for the acting user.
 *
 * @param cycle - the cycle.
 * @param user - the acting user.
 * @returns the cycle JSON.
 */
export function presentCycle(cycle: GoalCycle, user: User): GoalCycleJSON {
  const manage = canManageCycles(user) && cycle.teamId === user.teamId;
  return {
    id: cycle.id,
    name: cycle.name,
    startsAt: toDay(cycle.startsAt),
    endsAt: toDay(cycle.endsAt),
    createdAt: toISO(cycle.createdAt),
    updatedAt: toISO(cycle.updatedAt),
    abilities: { update: manage, delete: manage },
  };
}

/**
 * Progress of a key result from its stored values.
 *
 * @param keyResult - the key result.
 * @returns a fraction from 0 to 1.
 */
export function progressOf(keyResult: GoalKeyResult): number {
  return keyResultProgress({
    type: keyResult.type,
    startValue: Number(keyResult.startValue),
    targetValue: Number(keyResult.targetValue),
    currentValue: Number(keyResult.currentValue),
  });
}

/**
 * Presents an objective for the acting user.
 *
 * @param objective - the objective.
 * @param keyResults - the objective's key results, used for progress and status.
 * @param user - the acting user.
 * @returns the objective JSON.
 */
export function presentObjective(
  objective: GoalObjective,
  keyResults: GoalKeyResult[],
  user: User
): GoalObjectiveJSON {
  const own = keyResults.filter((kr) => kr.objectiveId === objective.id);
  return {
    id: objective.id,
    cycleId: objective.cycleId,
    level: objective.level,
    title: objective.title,
    description: objective.description ?? null,
    ownerId: objective.ownerId,
    groupId: objective.groupId ?? null,
    parentId: objective.parentId ?? null,
    createdById: objective.createdById,
    createdAt: toISO(objective.createdAt),
    updatedAt: toISO(objective.updatedAt),
    progress: meanProgress(own.map(progressOf)),
    status: worstStatus(own.map((kr) => kr.status)),
    abilities: {
      update: canUpdateObjective(user, objective),
      delete: canDeleteObjective(user, objective),
      createKeyResult: canCreateKeyResult(user, objective),
    },
  };
}

/**
 * Presents a key result for the acting user.
 *
 * @param keyResult - the key result.
 * @param objective - the objective it belongs to, used for abilities.
 * @param user - the acting user.
 * @returns the key result JSON.
 */
export function presentKeyResult(
  keyResult: GoalKeyResult,
  objective: GoalObjective,
  user: User
): GoalKeyResultJSON {
  return {
    id: keyResult.id,
    objectiveId: keyResult.objectiveId,
    title: keyResult.title,
    type: keyResult.type,
    startValue: Number(keyResult.startValue),
    targetValue: Number(keyResult.targetValue),
    currentValue: Number(keyResult.currentValue),
    unit: keyResult.unit ?? null,
    ownerId: keyResult.ownerId,
    status: keyResult.status ?? null,
    lastCheckInAt: keyResult.lastCheckInAt
      ? toISO(keyResult.lastCheckInAt)
      : null,
    createdAt: toISO(keyResult.createdAt),
    updatedAt: toISO(keyResult.updatedAt),
    progress: progressOf(keyResult),
    abilities: {
      update: canUpdateKeyResult(user, keyResult, objective),
      delete: canDeleteKeyResult(user, keyResult, objective),
      checkIn: canCheckIn(user, keyResult, objective),
    },
  };
}

/**
 * Presents a check-in for the acting user.
 *
 * @param checkIn - the check-in.
 * @param user - the acting user.
 * @returns the check-in JSON.
 */
export function presentCheckIn(
  checkIn: GoalCheckIn,
  user: User
): GoalCheckInJSON {
  return {
    id: checkIn.id,
    keyResultId: checkIn.keyResultId,
    userId: checkIn.userId,
    value: Number(checkIn.value),
    status: checkIn.status,
    note: checkIn.note ?? null,
    createdAt: toISO(checkIn.createdAt),
    abilities: { delete: canDeleteCheckIn(user, checkIn) },
  };
}

/**
 * Presents a user for display in goals.
 *
 * @param user - the user.
 * @returns the user JSON.
 */
export function presentGoalUser(user: User): GoalUserJSON {
  return {
    id: user.id,
    name: user.name,
    avatarUrl: user.avatarUrl ?? null,
    color: user.color,
  };
}

/**
 * Presents a group for display in goals.
 *
 * @param group - the group.
 * @returns the group JSON.
 */
export function presentGoalGroup(group: Group): GoalGroupJSON {
  return { id: group.id, name: group.name };
}
