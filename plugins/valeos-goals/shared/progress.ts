import type { GoalLevel, GoalStatus } from "./types";
import { GoalStatusSeverity, KeyResultType } from "./types";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * How far a key result is towards its target.
 *
 * @param kr - the key result's type and values.
 * @returns a fraction from 0 to 1.
 */
export function keyResultProgress(kr: {
  type: KeyResultType;
  startValue: number;
  targetValue: number;
  currentValue: number;
}): number {
  if (kr.type === KeyResultType.Milestone) {
    return kr.currentValue >= 1 ? 1 : 0;
  }
  const span = kr.targetValue - kr.startValue;
  if (span === 0) {
    return kr.currentValue === kr.targetValue ? 1 : 0;
  }
  return clamp01((kr.currentValue - kr.startValue) / span);
}

/**
 * The mean progress of a set of key results.
 *
 * @param progresses - each key result's progress.
 * @returns a fraction from 0 to 1, 0 when empty.
 */
export function meanProgress(progresses: number[]): number {
  if (progresses.length === 0) {
    return 0;
  }
  return progresses.reduce((sum, p) => sum + p, 0) / progresses.length;
}

/**
 * The worst status in a set, so one struggling key result flags its objective.
 *
 * @param statuses - statuses, where null means no check-in yet.
 * @returns the worst status, or null when none have checked in.
 */
export function worstStatus(
  statuses: Array<GoalStatus | null | undefined>
): GoalStatus | null {
  for (const status of GoalStatusSeverity) {
    if (statuses.includes(status)) {
      return status;
    }
  }
  return null;
}

/** Parses a YYYY-MM-DD date as midnight UTC. */
function parseDay(day: string): number {
  return Date.parse(`${day}T00:00:00Z`);
}

const DayMs = 24 * 60 * 60 * 1000;

/**
 * How much of a cycle has passed, counting the end date as a full day.
 *
 * @param cycle - start and end dates as YYYY-MM-DD.
 * @param now - the moment to measure at.
 * @returns a fraction from 0 to 1.
 */
export function cycleElapsed(
  cycle: { startsAt: string; endsAt: string },
  now: Date = new Date()
): number {
  const start = parseDay(cycle.startsAt);
  const end = parseDay(cycle.endsAt) + DayMs;
  if (end <= start) {
    return 1;
  }
  return clamp01((now.getTime() - start) / (end - start));
}

/**
 * Whole days left in a cycle, including today.
 *
 * @param cycle - the cycle's end date as YYYY-MM-DD.
 * @param now - the moment to measure at.
 * @returns days remaining, 0 once the cycle has ended.
 */
export function cycleDaysLeft(
  cycle: { endsAt: string },
  now: Date = new Date()
): number {
  const end = parseDay(cycle.endsAt) + DayMs;
  return Math.max(0, Math.ceil((end - now.getTime()) / DayMs));
}

/**
 * Whether a date falls inside a cycle.
 *
 * @param cycle - start and end dates as YYYY-MM-DD.
 * @param day - the date to test as YYYY-MM-DD.
 * @returns true when start <= day <= end.
 */
export function cycleContains(
  cycle: { startsAt: string; endsAt: string },
  day: string
): boolean {
  return cycle.startsAt <= day && day <= cycle.endsAt;
}

/**
 * Whether alignment from one level to another is allowed: always upwards.
 *
 * @param child - the aligning objective's level.
 * @param parent - the level of the objective it aligns to.
 * @returns true when the parent is at a higher level.
 */
export function canAlign(child: GoalLevel, parent: GoalLevel): boolean {
  const rank = { church: 0, team: 1, personal: 2 } as const;
  return rank[parent] < rank[child];
}

/**
 * Whether a key result is waiting for a check-in.
 *
 * @param kr - its progress and last check-in time.
 * @param staleAfterDays - days before a check-in counts as old.
 * @param now - the moment to measure at.
 * @returns true when unfinished and not checked in recently.
 */
export function needsCheckIn(
  kr: { progress: number; lastCheckInAt: string | Date | null },
  staleAfterDays: number,
  now: Date = new Date()
): boolean {
  if (kr.progress >= 1) {
    return false;
  }
  if (!kr.lastCheckInAt) {
    return true;
  }
  const last = new Date(kr.lastCheckInAt).getTime();
  return now.getTime() - last > staleAfterDays * DayMs;
}
