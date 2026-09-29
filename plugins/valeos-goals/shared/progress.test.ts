import {
  canAlign,
  cycleContains,
  cycleDaysLeft,
  cycleElapsed,
  keyResultProgress,
  meanProgress,
  needsCheckIn,
  worstStatus,
} from "./progress";
import { GoalLevel, GoalStatus, KeyResultType } from "./types";

const metric = (
  startValue: number,
  targetValue: number,
  currentValue: number
) =>
  keyResultProgress({
    type: KeyResultType.Metric,
    startValue,
    targetValue,
    currentValue,
  });

describe("keyResultProgress", () => {
  it("measures a metric between start and target", () => {
    expect(metric(0, 100, 25)).toBe(0.25);
    expect(metric(100, 200, 150)).toBe(0.5);
  });

  it("handles decreasing targets", () => {
    expect(metric(20, 5, 20)).toBe(0);
    expect(metric(20, 5, 10)).toBeCloseTo(2 / 3);
    expect(metric(20, 5, 5)).toBe(1);
  });

  it("clamps to 0..1", () => {
    expect(metric(0, 10, -5)).toBe(0);
    expect(metric(0, 10, 50)).toBe(1);
    expect(metric(20, 5, 30)).toBe(0);
    expect(metric(20, 5, 0)).toBe(1);
  });

  it("treats a zero span as done only at the target", () => {
    expect(metric(5, 5, 5)).toBe(1);
    expect(metric(5, 5, 4)).toBe(0);
  });

  it("treats milestones as done or not", () => {
    const milestone = (currentValue: number) =>
      keyResultProgress({
        type: KeyResultType.Milestone,
        startValue: 0,
        targetValue: 1,
        currentValue,
      });
    expect(milestone(0)).toBe(0);
    expect(milestone(0.9)).toBe(0);
    expect(milestone(1)).toBe(1);
    expect(milestone(2)).toBe(1);
  });
});

describe("meanProgress", () => {
  it("is 0 with nothing to average", () => {
    expect(meanProgress([])).toBe(0);
  });

  it("averages", () => {
    expect(meanProgress([0, 0.5, 1])).toBe(0.5);
  });
});

describe("worstStatus", () => {
  it("is null when nothing has checked in", () => {
    expect(worstStatus([])).toBeNull();
    expect(worstStatus([null, undefined])).toBeNull();
  });

  it("picks the worst status", () => {
    expect(worstStatus([GoalStatus.OnTrack, null])).toBe(GoalStatus.OnTrack);
    expect(worstStatus([GoalStatus.OnTrack, GoalStatus.AtRisk])).toBe(
      GoalStatus.AtRisk
    );
    expect(
      worstStatus([GoalStatus.AtRisk, GoalStatus.OffTrack, GoalStatus.OnTrack])
    ).toBe(GoalStatus.OffTrack);
  });
});

describe("cycleElapsed", () => {
  const cycle = { startsAt: "2026-10-01", endsAt: "2026-10-10" };

  it("is 0 before the start and 1 after the end", () => {
    expect(cycleElapsed(cycle, new Date("2026-09-20T12:00:00Z"))).toBe(0);
    expect(cycleElapsed(cycle, new Date("2026-10-11T00:00:00Z"))).toBe(1);
    expect(cycleElapsed(cycle, new Date("2026-12-01T00:00:00Z"))).toBe(1);
  });

  it("counts the end date as a full day", () => {
    expect(cycleElapsed(cycle, new Date("2026-10-06T00:00:00Z"))).toBe(0.5);
    expect(cycleElapsed(cycle, new Date("2026-10-10T12:00:00Z"))).toBe(0.95);
  });

  it("handles a single-day cycle", () => {
    const day = { startsAt: "2026-10-01", endsAt: "2026-10-01" };
    expect(cycleElapsed(day, new Date("2026-10-01T12:00:00Z"))).toBe(0.5);
  });
});

describe("cycleDaysLeft", () => {
  it("counts today", () => {
    const cycle = { endsAt: "2026-10-10" };
    expect(cycleDaysLeft(cycle, new Date("2026-10-10T08:00:00Z"))).toBe(1);
    expect(cycleDaysLeft(cycle, new Date("2026-10-08T08:00:00Z"))).toBe(3);
    expect(cycleDaysLeft(cycle, new Date("2026-10-11T08:00:00Z"))).toBe(0);
  });
});

describe("cycleContains", () => {
  const cycle = { startsAt: "2026-10-01", endsAt: "2026-10-10" };

  it("includes both ends", () => {
    expect(cycleContains(cycle, "2026-10-01")).toBe(true);
    expect(cycleContains(cycle, "2026-10-10")).toBe(true);
    expect(cycleContains(cycle, "2026-09-30")).toBe(false);
    expect(cycleContains(cycle, "2026-10-11")).toBe(false);
  });
});

describe("canAlign", () => {
  it("only allows alignment upwards", () => {
    expect(canAlign(GoalLevel.Team, GoalLevel.Church)).toBe(true);
    expect(canAlign(GoalLevel.Personal, GoalLevel.Church)).toBe(true);
    expect(canAlign(GoalLevel.Personal, GoalLevel.Team)).toBe(true);
    expect(canAlign(GoalLevel.Church, GoalLevel.Church)).toBe(false);
    expect(canAlign(GoalLevel.Church, GoalLevel.Team)).toBe(false);
    expect(canAlign(GoalLevel.Team, GoalLevel.Team)).toBe(false);
    expect(canAlign(GoalLevel.Team, GoalLevel.Personal)).toBe(false);
    expect(canAlign(GoalLevel.Personal, GoalLevel.Personal)).toBe(false);
  });
});

describe("needsCheckIn", () => {
  const now = new Date("2026-10-12T08:30:00Z");

  it("is false once a key result is finished", () => {
    expect(needsCheckIn({ progress: 1, lastCheckInAt: null }, 7, now)).toBe(
      false
    );
  });

  it("is true when never checked in", () => {
    expect(needsCheckIn({ progress: 0.2, lastCheckInAt: null }, 7, now)).toBe(
      true
    );
  });

  it("compares the last check-in with the stale window", () => {
    expect(
      needsCheckIn(
        { progress: 0.2, lastCheckInAt: "2026-10-06T08:00:00Z" },
        7,
        now
      )
    ).toBe(false);
    expect(
      needsCheckIn(
        { progress: 0.2, lastCheckInAt: new Date("2026-10-05T08:00:00Z") },
        7,
        now
      )
    ).toBe(true);
  });
});
