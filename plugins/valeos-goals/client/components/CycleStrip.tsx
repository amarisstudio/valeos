import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { s, hover } from "@shared/styles";
import Heading from "~/components/Heading";
import { cycleDaysLeft, meanProgress } from "../../shared/progress";
import type { GoalCycleJSON } from "../../shared/types";
import { GoalLevel, GoalStatus } from "../../shared/types";
import { formatPercent, formatRange, parseDay } from "../format";
import type { GoalsIndex } from "../useGoals";
import { ProgressBar } from "./ProgressBar";
import { StatusDot } from "./StatusLabel";

interface Props {
  index: GoalsIndex;
  cycle: GoalCycleJSON;
  /** How many of the viewer's key results are waiting for a check-in. */
  waitingCount: number;
  onShowWaiting: () => void;
}

/**
 * The top of the Goals page: the cycle, how far through it we are, and how
 * the church is tracking against that, on one timeline.
 */
export function CycleStrip({
  index,
  cycle,
  waitingCount,
  onShowWaiting,
}: Props) {
  const { t } = useTranslation();
  const { data, elapsed } = index;
  const church = data.objectives.filter((o) => o.level === GoalLevel.Church);
  const overall = meanProgress(
    (church.length ? church : data.objectives).map((o) => o.progress)
  );
  const totalDays =
    (parseDay(cycle.endsAt).getTime() - parseDay(cycle.startsAt).getTime()) /
      86400000 +
    1;
  const weeks = Math.max(1, Math.round(totalDays / 7));

  const counts = {
    [GoalStatus.OnTrack]: 0,
    [GoalStatus.AtRisk]: 0,
    [GoalStatus.OffTrack]: 0,
    none: 0,
  };
  for (const kr of data.keyResults) {
    counts[kr.status ?? "none"] += 1;
  }

  return (
    <section aria-label={t("Cycle overview")}>
      <Heading>{cycle.name}</Heading>
      <When>
        <span>{formatRange(cycle.startsAt, cycle.endsAt, t)}</span>
        <span>{timeLeft(cycle, elapsed, t)}</span>
      </When>
      <TrackRow>
        <TrackArea>
          <ProgressBar
            progress={overall}
            elapsed={elapsed}
            tone="accent"
            size="large"
            weeks={weeks}
            animateIn
            label={t("Overall progress")}
          />
          {elapsed > 0 && elapsed < 1 && (
            <Today style={{ left: `${elapsed * 100}%` }} $flip={elapsed > 0.85}>
              {t("Today")}
            </Today>
          )}
        </TrackArea>
        <Overall>
          {formatPercent(overall)}
          <OverallLabel>{t("overall")}</OverallLabel>
        </Overall>
      </TrackRow>
      {data.keyResults.length > 0 && (
        <Summary>
          {counts[GoalStatus.OnTrack] > 0 && (
            <li>
              <StatusDot $status={GoalStatus.OnTrack} aria-hidden />
              {t("{{ count }} on track", { count: counts[GoalStatus.OnTrack] })}
            </li>
          )}
          {counts[GoalStatus.AtRisk] > 0 && (
            <li>
              <StatusDot $status={GoalStatus.AtRisk} aria-hidden />
              {t("{{ count }} at risk", { count: counts[GoalStatus.AtRisk] })}
            </li>
          )}
          {counts[GoalStatus.OffTrack] > 0 && (
            <li>
              <StatusDot $status={GoalStatus.OffTrack} aria-hidden />
              {t("{{ count }} off track", {
                count: counts[GoalStatus.OffTrack],
              })}
            </li>
          )}
          {counts.none > 0 && (
            <li>
              <StatusDot $status={null} aria-hidden />
              {t("{{ count }} not checked in", { count: counts.none })}
            </li>
          )}
        </Summary>
      )}
      {waitingCount > 0 && (
        <Nudge>
          {t("{{ count }} of your key results are waiting for a check-in.", {
            count: waitingCount,
          })}{" "}
          <NudgeButton type="button" onClick={onShowWaiting}>
            {t("Show them")}
          </NudgeButton>
        </Nudge>
      )}
    </section>
  );
}

/**
 * Describes where today sits relative to the cycle.
 *
 * @param cycle - the cycle.
 * @param elapsed - the elapsed fraction.
 * @param t - the translation function.
 * @returns text such as "5 weeks left".
 */
function timeLeft(cycle: GoalCycleJSON, elapsed: number, t: TFunction) {
  if (elapsed <= 0) {
    const days = Math.ceil(
      (parseDay(cycle.startsAt).getTime() - Date.now()) / 86400000
    );
    return days <= 1
      ? t("Starts tomorrow")
      : t("Starts in {{ count }} days", { count: days });
  }
  if (elapsed >= 1) {
    return t("Ended {{ date }}", {
      date: new Intl.DateTimeFormat(undefined, {
        day: "numeric",
        month: "short",
      }).format(parseDay(cycle.endsAt)),
    });
  }
  const days = cycleDaysLeft(cycle);
  if (days <= 1) {
    return t("Last day");
  }
  if (days <= 14) {
    return t("{{ count }} days left", { count: days });
  }
  return t("{{ count }} weeks left", { count: Math.floor(days / 7) });
}

const When = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin: -8px 0 10px;
  font-size: 14px;
  color: ${s("textTertiary")};
  font-variant-numeric: tabular-nums;
`;

const TrackRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 16px;
`;

const TrackArea = styled.div`
  position: relative;
  flex: 1;
  padding-bottom: 18px;
`;

const Today = styled.span<{ $flip: boolean }>`
  position: absolute;
  bottom: 0;
  transform: translateX(
    ${(props) => (props.$flip ? "calc(-100% + 1px)" : "-1px")}
  );
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  color: ${s("textSecondary")};
  white-space: nowrap;
`;

const Overall = styled.span`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-top: -2px;
  font-size: 22px;
  font-weight: 600;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  color: ${s("text")};
`;

const OverallLabel = styled.span`
  margin-top: 4px;
  font-size: 12px;
  font-weight: 500;
  color: ${s("textTertiary")};
`;

const Summary = styled.ul`
  display: flex;
  flex-wrap: wrap;
  column-gap: 18px;
  row-gap: 4px;
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
  font-size: 13px;
  color: ${s("textSecondary")};

  li {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
`;

const Nudge = styled.p`
  margin: 14px 0 0;
  font-size: 14px;
  color: ${s("text")};
`;

const NudgeButton = styled.button`
  border: 0;
  padding: 0;
  background: none;
  font: inherit;
  font-weight: 500;
  color: ${s("accent")};
  cursor: var(--pointer);

  &: ${hover} {
    text-decoration: underline;
  }
`;
