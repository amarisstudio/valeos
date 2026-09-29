import { subDays } from "date-fns";
import { Op } from "sequelize";
import { toError } from "@shared/utils/error";
import Logger from "@server/logging/Logger";
import { User } from "@server/models";
import { TaskPriority } from "@server/queues/tasks/base/BaseTask";
import type { Props } from "@server/queues/tasks/base/CronTask";
import { CronTask, TaskInterval } from "@server/queues/tasks/base/CronTask";
import Redis from "@server/storage/redis";
import { cycleContains } from "../../shared/progress";
import { GoalValidation } from "../../shared/types";
import { GoalCheckInReminderEmail } from "../emails/GoalCheckInReminderEmail";
import type { ReminderKeyResult } from "../emails/GoalCheckInReminderEmail";
import { GoalCycle, GoalKeyResult, GoalObjective } from "../models";
import { progressOf } from "../presenters";
import {
  addDaysToDay,
  dayInTimeZone,
  isoWeekKey,
  localParts,
  safeTimeZone,
} from "../time";

/** A key result counts as waiting when its last check-in is older than this. */

/** Reminders go out on Monday (1) from 8:00 to 8:59 in the owner's timezone. */
const ReminderWeekday = 1;
const ReminderHour = 8;

/** Long enough to outlast the ISO week the key belongs to. */
const DedupeExpirySeconds = 8 * 24 * 60 * 60;

/**
 * Redis key recording that a user was reminded in a given ISO week.
 *
 * @param userId - the key result owner.
 * @param week - the ISO week, such as "2026-W40".
 * @returns the key.
 */
export function reminderKey(userId: string, week: string) {
  return `goals:checkin-reminder:${userId}:${week}`;
}

/**
 * Whether it is Monday between 8:00 and 8:59 in a timezone.
 *
 * @param now - the moment to test.
 * @param timeZone - an IANA timezone name.
 * @returns true inside the reminder window.
 */
export function isReminderWindow(now: Date, timeZone: string) {
  const { weekday, hour } = localParts(now, timeZone);
  return weekday === ReminderWeekday && hour === ReminderHour;
}

/**
 * Hourly task that emails key result owners on Monday morning, in their own
 * timezone, listing key results with no check-in in the last week.
 */
export class GoalCheckInReminderTask extends CronTask {
  public async perform(props?: Partial<Props>) {
    // Time-of-day decisions use the scheduled time so a delayed job still
    // lands in the hour it was meant for. Tests pass it in to control "now".
    const now = new Date(props?.scheduledAt ?? Date.now());

    // Cycle dates are calendar days, and "today" depends on the owner's
    // timezone, so start with any cycle that could be active somewhere.
    const utcToday = dayInTimeZone(now, "UTC");
    const cycles = await GoalCycle.findAll({
      where: {
        startsAt: { [Op.lte]: addDaysToDay(utcToday, 1) },
        endsAt: { [Op.gte]: addDaysToDay(utcToday, -1) },
      },
    });
    if (!cycles.length) {
      return;
    }
    const cyclesById = new Map(cycles.map((c) => [c.id, c]));

    const objectives = await GoalObjective.findAll({
      attributes: ["id", "title", "cycleId", "teamId", "createdAt"],
      where: { cycleId: cycles.map((c) => c.id) },
      order: [
        ["createdAt", "ASC"],
        ["id", "ASC"],
      ],
    });
    if (!objectives.length) {
      return;
    }
    const objectivesById = new Map(objectives.map((o) => [o.id, o]));

    const keyResults = await GoalKeyResult.findAll({
      where: {
        objectiveId: objectives.map((o) => o.id),
        [Op.or]: [
          { lastCheckInAt: { [Op.is]: null } },
          {
            lastCheckInAt: {
              [Op.lt]: subDays(now, GoalValidation.staleAfterDays),
            },
          },
        ],
      },
      order: [
        ["createdAt", "ASC"],
        ["id", "ASC"],
      ],
    });

    const byOwner = new Map<string, GoalKeyResult[]>();
    for (const kr of keyResults) {
      if (progressOf(kr) >= 1) {
        continue;
      }
      const list = byOwner.get(kr.ownerId) ?? [];
      list.push(kr);
      byOwner.set(kr.ownerId, list);
    }
    if (!byOwner.size) {
      return;
    }

    const owners = await User.scope("withTeam").findAll({
      where: { id: Array.from(byOwner.keys()) },
    });

    for (const owner of owners) {
      if (owner.isSuspended || owner.isGuest || !owner.email) {
        continue;
      }

      const timeZone = safeTimeZone(owner.timezone);
      if (!isReminderWindow(now, timeZone)) {
        continue;
      }

      const localToday = dayInTimeZone(now, timeZone);
      const waiting = (byOwner.get(owner.id) ?? []).filter((kr) => {
        const objective = objectivesById.get(kr.objectiveId);
        const cycle = objective && cyclesById.get(objective.cycleId);
        return (
          !!cycle &&
          cycle.teamId === owner.teamId &&
          cycleContains(
            {
              startsAt: String(cycle.startsAt),
              endsAt: String(cycle.endsAt),
            },
            localToday
          )
        );
      });
      if (!waiting.length) {
        continue;
      }

      // Claim the week atomically so overlapping runs cannot both send.
      const key = reminderKey(owner.id, isoWeekKey(localToday));
      const claimed = await Redis.defaultClient.set(
        key,
        now.toISOString(),
        "EX",
        DedupeExpirySeconds,
        "NX"
      );
      if (!claimed) {
        continue;
      }

      const items: ReminderKeyResult[] = waiting.map((kr) => ({
        title: kr.title,
        objectiveTitle: objectivesById.get(kr.objectiveId)?.title ?? "",
        type: kr.type,
        currentValue: Number(kr.currentValue),
        targetValue: Number(kr.targetValue),
        unit: kr.unit ?? null,
      }));

      try {
        await new GoalCheckInReminderEmail({
          to: owner.email,
          language: owner.language,
          name: owner.name,
          teamUrl: owner.team.url,
          keyResults: items,
        }).schedule();
      } catch (err) {
        // Release the claim so the next hourly run can try again.
        await Redis.defaultClient.del(key);
        Logger.error(
          "Failed to schedule goal check-in reminder",
          toError(err),
          {
            userId: owner.id,
          }
        );
      }
    }
  }

  public get cron() {
    return {
      interval: TaskInterval.Hour,
    };
  }

  public get options() {
    return {
      attempts: 1,
      priority: TaskPriority.Background,
    };
  }
}
