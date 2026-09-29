import type { TFunction } from "i18next";
import { KeyResultType } from "../shared/types";
import { formatKeyResultValue, formatValue, parseDay, toDay } from "./format";

const t = ((key: string, vars?: Record<string, string>) =>
  key.replace(
    /\{\{ (\w+) \}\}/g,
    (_, name: string) => vars?.[name] ?? ""
  )) as TFunction;

describe("formatValue", () => {
  it("attaches percent and currency units", () => {
    expect(formatValue(42, "%")).toBe("42%");
    expect(formatValue(1200, "$")).toBe("$1,200");
  });

  it("puts word units after a space", () => {
    expect(formatValue(450, "people")).toBe("450 people");
  });

  it("shows bare numbers without a unit", () => {
    expect(formatValue(3.5, null)).toBe("3.5");
  });
});

describe("formatKeyResultValue", () => {
  const base = { startValue: 0, unit: "people" };

  it("reads as current of target for increasing metrics", () => {
    expect(
      formatKeyResultValue(
        {
          ...base,
          type: KeyResultType.Metric,
          currentValue: 412,
          targetValue: 450,
        },
        t
      )
    ).toBe("412 of 450 people");
  });

  it("reads as down to target for decreasing metrics", () => {
    expect(
      formatKeyResultValue(
        {
          type: KeyResultType.Metric,
          startValue: 20,
          currentValue: 12,
          targetValue: 5,
          unit: "hours",
        },
        t
      )
    ).toBe("12, down to 5 hours");
  });

  it("describes milestones as done or not", () => {
    const milestone = {
      ...base,
      type: KeyResultType.Milestone,
      targetValue: 1,
    };
    expect(formatKeyResultValue({ ...milestone, currentValue: 1 }, t)).toBe(
      "Done"
    );
    expect(formatKeyResultValue({ ...milestone, currentValue: 0 }, t)).toBe(
      "Not done yet"
    );
  });
});

describe("calendar days", () => {
  it("round-trips YYYY-MM-DD without shifting timezones", () => {
    expect(toDay(parseDay("2026-10-06"))).toBe("2026-10-06");
  });
});
