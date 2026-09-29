import { getISOWeek, getISOWeekYear } from "date-fns";
import { cycleContains } from "../shared/progress";

/**
 * Returns the timezone if the runtime recognises it, otherwise UTC.
 *
 * @param timeZone - an IANA timezone name, or null.
 * @returns a usable timezone name.
 */
export function safeTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone) {
    return "UTC";
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return timeZone;
  } catch {
    return "UTC";
  }
}

type LocalParts = {
  /** Calendar date, YYYY-MM-DD. */
  day: string;
  /** 0 is Sunday, 1 is Monday, through 6 for Saturday. */
  weekday: number;
  /** 0 to 23. */
  hour: number;
};

const Weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * The wall clock date, weekday and hour at a moment in a timezone.
 *
 * @param date - the moment.
 * @param timeZone - an IANA timezone name, falls back to UTC if unknown.
 * @returns the local parts.
 */
export function localParts(date: Date, timeZone: string): LocalParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    day: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: Weekdays.indexOf(get("weekday")),
    hour: Number(get("hour")) % 24,
  };
}

/**
 * The calendar date at a moment in a timezone.
 *
 * @param date - the moment.
 * @param timeZone - an IANA timezone name.
 * @returns the date as YYYY-MM-DD.
 */
export function dayInTimeZone(date: Date, timeZone: string): string {
  return localParts(date, timeZone).day;
}

/**
 * Adds whole days to a calendar date.
 *
 * @param day - the date as YYYY-MM-DD.
 * @param amount - days to add, may be negative.
 * @returns the new date as YYYY-MM-DD.
 */
export function addDaysToDay(day: string, amount: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

/**
 * The ISO week a calendar date falls in, such as "2026-W40".
 *
 * @param day - the date as YYYY-MM-DD.
 * @returns the ISO week key.
 */
export function isoWeekKey(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  // Built from local calendar fields so the result does not depend on the
  // server's own timezone.
  const local = new Date(year, month - 1, date);
  const week = String(getISOWeek(local)).padStart(2, "0");
  return `${getISOWeekYear(local)}-W${week}`;
}

/**
 * Chooses the cycle to show when none is requested: the one containing today,
 * else the next to start, else the one that ended most recently.
 *
 * @param cycles - every cycle in the workspace.
 * @param today - the date as YYYY-MM-DD.
 * @returns the chosen cycle, or null when there are none.
 */
export function pickCurrentCycle<
  C extends { startsAt: string; endsAt: string },
>(cycles: C[], today: string): C | null {
  const byStartDesc = [...cycles].sort((a, b) =>
    b.startsAt.localeCompare(a.startsAt)
  );
  const current = byStartDesc.find((cycle) => cycleContains(cycle, today));
  if (current) {
    return current;
  }
  const upcoming = byStartDesc
    .filter((cycle) => cycle.startsAt > today)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  if (upcoming) {
    return upcoming;
  }
  const past = byStartDesc
    .filter((cycle) => cycle.endsAt < today)
    .sort((a, b) => b.endsAt.localeCompare(a.endsAt))[0];
  return past ?? null;
}
