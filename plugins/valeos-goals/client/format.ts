import type { TFunction } from "i18next";
import type { GoalKeyResultJSON } from "../shared/types";
import { GoalStatus, KeyResultType } from "../shared/types";

/**
 * Parses a YYYY-MM-DD calendar date into a local Date at midnight.
 *
 * @param day - the calendar date.
 * @returns a local Date.
 */
export function parseDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Formats a local Date as a YYYY-MM-DD calendar date.
 *
 * @param date - the date to format.
 * @returns the calendar date string.
 */
export function toDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Formats a cycle's date range, dropping the year when both ends share the
 * current one.
 *
 * @param startsAt - the first day as YYYY-MM-DD.
 * @param endsAt - the last day as YYYY-MM-DD.
 * @param t - the translation function.
 * @returns a range such as "6 Oct to 18 Dec".
 */
export function formatRange(startsAt: string, endsAt: string, t: TFunction) {
  const start = parseDay(startsAt);
  const end = parseDay(endsAt);
  const thisYear = new Date().getFullYear();
  const sameYear =
    start.getFullYear() === thisYear && end.getFullYear() === thisYear;
  const fmt = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: sameYear ? undefined : "numeric",
  });
  return t("{{ start }} to {{ end }}", {
    start: fmt.format(start),
    end: fmt.format(end),
  });
}

const numberFormat = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

/**
 * Formats a single value with its unit. Currency-like and percent units
 * attach directly; word units follow with a space.
 *
 * @param value - the number.
 * @param unit - the key result's unit, if any.
 * @returns the formatted value.
 */
export function formatValue(value: number, unit: string | null): string {
  const n = numberFormat.format(value);
  if (!unit) {
    return n;
  }
  if (unit === "%") {
    return `${n}%`;
  }
  if (/^[$£€¥]$/.test(unit)) {
    return `${unit}${n}`;
  }
  return `${n} ${unit}`;
}

/**
 * Describes where a key result stands, in words.
 *
 * @param kr - the key result.
 * @param t - the translation function.
 * @returns text such as "412 of 450 people" or "Done".
 */
export function formatKeyResultValue(
  kr: Pick<
    GoalKeyResultJSON,
    "type" | "currentValue" | "targetValue" | "startValue" | "unit"
  >,
  t: TFunction
): string {
  if (kr.type === KeyResultType.Milestone) {
    return kr.currentValue >= 1 ? t("Done") : t("Not done yet");
  }
  const unitIsWord = kr.unit && !/^[$£€¥%]$/.test(kr.unit);
  const current = unitIsWord
    ? numberFormat.format(kr.currentValue)
    : formatValue(kr.currentValue, kr.unit);
  const target = formatValue(kr.targetValue, kr.unit);
  if (kr.targetValue < kr.startValue) {
    return t("{{ current }}, down to {{ target }}", { current, target });
  }
  return t("{{ current }} of {{ target }}", { current, target });
}

/**
 * The display label for a status.
 *
 * @param status - the status, or null before any check-in.
 * @param t - the translation function.
 * @returns a short label.
 */
export function statusLabel(status: GoalStatus | null, t: TFunction): string {
  switch (status) {
    case GoalStatus.OnTrack:
      return t("On track");
    case GoalStatus.AtRisk:
      return t("At risk");
    case GoalStatus.OffTrack:
      return t("Off track");
    default:
      return t("No check-in yet");
  }
}

/**
 * Formats a 0 to 1 fraction as a whole percentage.
 *
 * @param fraction - the progress fraction.
 * @returns text such as "48%".
 */
export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}
