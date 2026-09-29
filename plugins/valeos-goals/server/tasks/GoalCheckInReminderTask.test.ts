import { subDays } from "date-fns";
import { renderToStaticMarkup } from "react-dom/server";
import mailer from "@server/emails/mailer";
import type { User } from "@server/models";
import { initI18n } from "@server/utils/i18n";
import {
  buildAdmin,
  buildGuestUser,
  buildTeam,
  buildUser,
} from "@server/test/factories";
import { GoalLevel, GoalStatus, KeyResultType } from "../../shared/types";
import {
  GoalCheckInReminderEmail,
  type ReminderKeyResult,
} from "../emails/GoalCheckInReminderEmail";
import { GoalCycle, GoalKeyResult, GoalObjective } from "../models";
import {
  GoalCheckInReminderTask,
  isReminderWindow,
} from "./GoalCheckInReminderTask";

// 3 June 2030 is a Monday. Dates far from the present keep other test files'
// goals out of the cycles this task considers.
const mondayMorningUTC = new Date("2030-06-03T08:15:00Z");
// 08:30 on Monday in Melbourne (UTC+10 in June) is still Sunday in UTC.
const mondayMorningMelbourne = new Date("2030-06-02T22:30:00Z");

type Sent = { to: string | null; keyResults: ReminderKeyResult[] };

let schedule: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  schedule = vi
    .spyOn(GoalCheckInReminderEmail.prototype, "schedule")
    .mockResolvedValue(undefined);
});

afterEach(() => {
  schedule.mockRestore();
});

/** The emails scheduled so far, read from each email instance's props. */
function sent(): Sent[] {
  return schedule.mock.contexts.map((email: GoalCheckInReminderEmail) => {
    const props = email["props"] as Sent;
    return { to: props.to, keyResults: props.keyResults };
  });
}

function sentTo(user: User) {
  return sent().filter((email) => email.to === user.email);
}

async function run(now: Date) {
  const task = new GoalCheckInReminderTask();
  await task.perform({
    limit: 10000,
    partition: { partitionIndex: 0, partitionCount: 1 },
    scheduledAt: now.getTime(),
  });
}

async function setup(
  cycleDates = { startsAt: "2030-05-01", endsAt: "2030-07-31" }
) {
  const team = await buildTeam();
  const admin = await buildAdmin({ teamId: team.id });
  const cycle = await GoalCycle.create({
    teamId: team.id,
    name: "Winter 2030",
    ...cycleDates,
    createdById: admin.id,
  });
  const objective = await GoalObjective.create({
    teamId: team.id,
    cycleId: cycle.id,
    level: GoalLevel.Church,
    title: "Reach our city",
    ownerId: admin.id,
    createdById: admin.id,
  });
  return { team, admin, cycle, objective };
}

type Ctx = Awaited<ReturnType<typeof setup>>;

function buildKeyResult(
  ctx: Ctx,
  overrides: Partial<GoalKeyResult> & { ownerId: string }
) {
  return GoalKeyResult.create({
    teamId: ctx.team.id,
    objectiveId: ctx.objective.id,
    title: "Average attendance reaches 450",
    type: KeyResultType.Metric,
    startValue: 400,
    targetValue: 450,
    currentValue: 412,
    unit: "people",
    createdById: ctx.admin.id,
    ...overrides,
  });
}

describe("isReminderWindow", () => {
  it("is only Monday from 8:00 to 8:59 in the timezone", () => {
    expect(isReminderWindow(new Date("2030-06-03T08:00:00Z"), "UTC")).toBe(
      true
    );
    expect(isReminderWindow(new Date("2030-06-03T08:59:59Z"), "UTC")).toBe(
      true
    );
    expect(isReminderWindow(new Date("2030-06-03T07:59:59Z"), "UTC")).toBe(
      false
    );
    expect(isReminderWindow(new Date("2030-06-03T09:00:00Z"), "UTC")).toBe(
      false
    );
    expect(isReminderWindow(new Date("2030-06-04T08:30:00Z"), "UTC")).toBe(
      false
    );
    expect(
      isReminderWindow(mondayMorningMelbourne, "Australia/Melbourne")
    ).toBe(true);
    expect(isReminderWindow(mondayMorningMelbourne, "UTC")).toBe(false);
    expect(
      isReminderWindow(new Date("2030-06-03T12:30:00Z"), "America/New_York")
    ).toBe(true);
  });
});

describe("GoalCheckInReminderTask", () => {
  it("emails owners of key results waiting for a check-in", async () => {
    const ctx = await setup();
    const owner = await buildUser({ teamId: ctx.team.id });
    await buildKeyResult(ctx, { ownerId: owner.id, title: "Never checked in" });
    await buildKeyResult(ctx, {
      ownerId: owner.id,
      title: "Checked in last week",
      lastCheckInAt: subDays(mondayMorningUTC, 8),
      status: GoalStatus.OnTrack,
    });
    await buildKeyResult(ctx, {
      ownerId: owner.id,
      title: "Launch Alpha",
      type: KeyResultType.Milestone,
      startValue: 0,
      targetValue: 1,
      currentValue: 0,
      unit: null,
    });

    await run(mondayMorningUTC);

    const emails = sentTo(owner);
    expect(emails).toHaveLength(1);
    expect(emails[0].keyResults).toEqual([
      {
        title: "Never checked in",
        objectiveTitle: "Reach our city",
        type: KeyResultType.Metric,
        currentValue: 412,
        targetValue: 450,
        unit: "people",
      },
      expect.objectContaining({ title: "Checked in last week" }),
      expect.objectContaining({
        title: "Launch Alpha",
        type: KeyResultType.Milestone,
      }),
    ]);
  });

  it("skips finished key results and recent check-ins", async () => {
    const ctx = await setup();
    const owner = await buildUser({ teamId: ctx.team.id });
    await buildKeyResult(ctx, {
      ownerId: owner.id,
      title: "Finished",
      currentValue: 450,
    });
    await buildKeyResult(ctx, {
      ownerId: owner.id,
      title: "Milestone done",
      type: KeyResultType.Milestone,
      startValue: 0,
      targetValue: 1,
      currentValue: 1,
    });
    await buildKeyResult(ctx, {
      ownerId: owner.id,
      title: "Checked in recently",
      lastCheckInAt: subDays(mondayMorningUTC, 2),
      status: GoalStatus.AtRisk,
    });

    await run(mondayMorningUTC);

    expect(sentTo(owner)).toHaveLength(0);
  });

  it("only sends on Monday at 8am in the owner's timezone", async () => {
    const ctx = await setup();
    const melbourne = await buildUser({
      teamId: ctx.team.id,
      timezone: "Australia/Melbourne",
    });
    const utc = await buildUser({ teamId: ctx.team.id, timezone: null });
    await buildKeyResult(ctx, { ownerId: melbourne.id });
    await buildKeyResult(ctx, { ownerId: utc.id });

    await run(mondayMorningMelbourne);
    expect(sentTo(melbourne)).toHaveLength(1);
    expect(sentTo(utc)).toHaveLength(0);

    await run(mondayMorningUTC);
    expect(sentTo(melbourne)).toHaveLength(1);
    expect(sentTo(utc)).toHaveLength(1);

    // Tuesday morning is outside the window for both.
    await run(new Date("2030-06-04T08:15:00Z"));
    expect(sentTo(utc)).toHaveLength(1);
  });

  it("uses the owner's local date to decide which cycles are active", async () => {
    // Starts on Monday in Melbourne while it is still Sunday in UTC.
    const ctx = await setup({ startsAt: "2030-06-03", endsAt: "2030-08-31" });
    const melbourne = await buildUser({
      teamId: ctx.team.id,
      timezone: "Australia/Melbourne",
    });
    await buildKeyResult(ctx, { ownerId: melbourne.id });

    await run(mondayMorningMelbourne);
    expect(sentTo(melbourne)).toHaveLength(1);
  });

  it("ignores cycles that are not active today", async () => {
    const ended = await setup({ startsAt: "2030-04-01", endsAt: "2030-06-02" });
    const upcoming = await setup({
      startsAt: "2030-06-04",
      endsAt: "2030-08-31",
    });
    const endedOwner = await buildUser({ teamId: ended.team.id });
    const upcomingOwner = await buildUser({ teamId: upcoming.team.id });
    await buildKeyResult(ended, { ownerId: endedOwner.id });
    await buildKeyResult(upcoming, { ownerId: upcomingOwner.id });

    await run(mondayMorningUTC);

    expect(sentTo(endedOwner)).toHaveLength(0);
    expect(sentTo(upcomingOwner)).toHaveLength(0);
  });

  it("skips suspended and guest owners", async () => {
    const ctx = await setup();
    const suspended = await buildUser({
      teamId: ctx.team.id,
      suspendedAt: new Date(),
    });
    const guest = await buildGuestUser({ teamId: ctx.team.id });
    await buildKeyResult(ctx, { ownerId: suspended.id });
    await buildKeyResult(ctx, { ownerId: guest.id });

    await run(mondayMorningUTC);

    expect(sentTo(suspended)).toHaveLength(0);
    expect(sentTo(guest)).toHaveLength(0);
  });

  it("sends at most one email per owner per week", async () => {
    const ctx = await setup();
    const owner = await buildUser({ teamId: ctx.team.id });
    await buildKeyResult(ctx, { ownerId: owner.id });

    await run(mondayMorningUTC);
    await run(new Date("2030-06-03T08:45:00Z"));
    expect(sentTo(owner)).toHaveLength(1);

    // The following Monday is a new week.
    await run(new Date("2030-06-10T08:15:00Z"));
    expect(sentTo(owner)).toHaveLength(2);
  });
});

describe("GoalCheckInReminderEmail", () => {
  // The worker initialises translations before sending emails.
  beforeAll(() => initI18n());

  const props = {
    to: "owner@example.com",
    name: "Sam",
    teamUrl: "https://vale.example.com",
    keyResults: [
      {
        title: "Average attendance reaches 450",
        objectiveTitle: "Reach our city",
        type: KeyResultType.Metric,
        currentValue: 412,
        targetValue: 450,
        unit: "people",
      },
      {
        title: "Volunteers rostered",
        objectiveTitle: "Build a volunteer bench",
        type: KeyResultType.Metric,
        currentValue: 40.5,
        targetValue: 60,
        unit: "%",
      },
      {
        title: "Launch Alpha",
        objectiveTitle: "Reach our city",
        type: KeyResultType.Milestone,
        currentValue: 0,
        targetValue: 1,
        unit: null,
      },
    ],
  };

  it("renders the waiting key results with a check-in link", async () => {
    const sendMail = vi.spyOn(mailer, "sendMail").mockResolvedValue();
    await new GoalCheckInReminderEmail(props).send();

    expect(sendMail).toHaveBeenCalledTimes(1);
    const options = sendMail.mock.calls[0][0];
    expect(options.subject).toEqual(
      "Your key results are waiting for a check-in"
    );
    expect(options.text).toContain("412 of 450 people");
    expect(options.text).toContain("40.5 of 60%");
    expect(options.text).toContain("Not done yet");
    expect(options.text).toContain("https://vale.example.com/goals?view=mine");

    const html = renderToStaticMarkup(options.component);
    expect(html).toContain("Average attendance reaches 450");
    expect(html).toContain("Reach our city · 412 of 450 people");
    expect(html).toContain('href="https://vale.example.com/goals?view=mine"');

    // House style: no em dashes and no exclamation marks.
    for (const copy of [options.subject, options.text, html]) {
      expect(copy).not.toContain("\u2014");
    }
    expect(options.subject).not.toContain("!");
    expect(options.text).not.toContain("!");
    sendMail.mockRestore();
  });
});
