import * as React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import styled from "styled-components";
import { s } from "@shared/styles";
import { errToString } from "@shared/utils/error";
import Time from "~/components/Time";
import type {
  GoalCheckInJSON,
  GoalKeyResultJSON,
  GoalUserJSON,
} from "../../shared/types";
import { KeyResultType } from "../../shared/types";
import { goalsApi } from "../api";
import { formatValue } from "../format";
import { StatusDot } from "./StatusLabel";

interface Props {
  keyResult: GoalKeyResultJSON;
  usersById: Map<string, GoalUserJSON>;
  /** Called after a check-in is deleted so totals refresh. */
  onChanged: () => void;
}

const VisibleCount = 5;

/**
 * The recent check-ins on a key result: a trend line for numbers and the
 * notes people left.
 */
export function CheckInHistory({ keyResult, usersById, onChanged }: Props) {
  const { t } = useTranslation();
  const [checkIns, setCheckIns] = React.useState<GoalCheckInJSON[] | null>(
    null
  );
  const [authors, setAuthors] = React.useState<Map<string, GoalUserJSON>>(
    () => new Map()
  );
  const [showAll, setShowAll] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await goalsApi.listCheckIns(keyResult.id);
      setCheckIns(res.checkIns);
      setAuthors(new Map(res.users.map((u) => [u.id, u])));
    } catch (err) {
      toast.error(errToString(err));
      setCheckIns([]);
    }
  }, [keyResult.id]);

  React.useEffect(() => {
    void load();
  }, [load, keyResult.lastCheckInAt]);

  const handleDelete = async (checkIn: GoalCheckInJSON) => {
    try {
      await goalsApi.deleteCheckIn(checkIn.id);
      toast.success(t("Check-in deleted"));
      await load();
      onChanged();
    } catch (err) {
      toast.error(errToString(err));
    }
  };

  if (checkIns === null) {
    return <Panel aria-busy="true" />;
  }

  if (checkIns.length === 0) {
    return (
      <Panel>
        <Muted>{t("No check-ins yet.")}</Muted>
      </Panel>
    );
  }

  const visible = showAll ? checkIns : checkIns.slice(0, VisibleCount);

  return (
    <Panel>
      {keyResult.type === KeyResultType.Metric && (
        <Sparkline keyResult={keyResult} checkIns={checkIns} />
      )}
      <List>
        {visible.map((checkIn) => {
          const author =
            authors.get(checkIn.userId) ?? usersById.get(checkIn.userId);
          return (
            <Entry key={checkIn.id}>
              <EntryHead>
                <StatusDot $status={checkIn.status} aria-hidden />
                <Value>
                  {keyResult.type === KeyResultType.Milestone
                    ? checkIn.value >= 1
                      ? t("Done")
                      : t("Not done yet")
                    : formatValue(checkIn.value, keyResult.unit)}
                </Value>
                <Muted>
                  {author?.name ?? t("Someone")}{" "}
                  <Time dateTime={checkIn.createdAt} addSuffix shorten />
                </Muted>
                {checkIn.abilities.delete && (
                  <DeleteButton
                    type="button"
                    onClick={() => handleDelete(checkIn)}
                  >
                    {t("Delete")}
                  </DeleteButton>
                )}
              </EntryHead>
              {checkIn.note && <Note>{checkIn.note}</Note>}
            </Entry>
          );
        })}
      </List>
      {checkIns.length > VisibleCount && (
        <ShowMore type="button" onClick={() => setShowAll(!showAll)}>
          {showAll
            ? t("Show fewer")
            : t("Show all {{ count }} check-ins", { count: checkIns.length })}
        </ShowMore>
      )}
    </Panel>
  );
}

interface SparklineProps {
  keyResult: GoalKeyResultJSON;
  checkIns: GoalCheckInJSON[];
}

/** A small trend line from the starting value through each check-in. */
function Sparkline({ keyResult, checkIns }: SparklineProps) {
  const { t } = useTranslation();
  const width = 320;
  const height = 48;
  const pad = 4;
  const points = [
    { at: Date.parse(keyResult.createdAt), value: keyResult.startValue },
    ...[...checkIns]
      .reverse()
      .map((c) => ({ at: Date.parse(c.createdAt), value: c.value })),
  ];
  const values = [
    ...points.map((p) => p.value),
    keyResult.targetValue,
    keyResult.startValue,
  ];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const first = points[0].at;
  const last = Math.max(points[points.length - 1].at, first + 1);
  const x = (at: number) =>
    pad + ((at - first) / (last - first)) * (width - pad * 2);
  const y = (value: number) =>
    max === min
      ? height / 2
      : height - pad - ((value - min) / (max - min)) * (height - pad * 2);
  const path = points.map((p) => `${x(p.at)},${y(p.value)}`).join(" ");
  const end = points[points.length - 1];

  return (
    <ChartWrap>
      <Chart
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={t(
          "Trend from {{ start }} to {{ current }}, target {{ target }}",
          {
            start: formatValue(keyResult.startValue, keyResult.unit),
            current: formatValue(end.value, keyResult.unit),
            target: formatValue(keyResult.targetValue, keyResult.unit),
          }
        )}
      >
        <TargetLine
          x1={0}
          x2={width}
          y1={y(keyResult.targetValue)}
          y2={y(keyResult.targetValue)}
          vectorEffect="non-scaling-stroke"
        />
        <TrendLine points={path} vectorEffect="non-scaling-stroke" />
      </Chart>
      {/* Drawn outside the SVG so non-uniform scaling can't stretch it. */}
      <EndPoint
        aria-hidden
        style={{
          left: `${(x(end.at) / width) * 100}%`,
          top: `${(y(end.value) / height) * 100}%`,
        }}
      />
      <TargetLabel
        aria-hidden
        style={{ top: `${(y(keyResult.targetValue) / height) * 100}%` }}
      >
        {t("Target {{ target }}", {
          target: formatValue(keyResult.targetValue, keyResult.unit),
        })}
      </TargetLabel>
    </ChartWrap>
  );
}

const Panel = styled.div`
  margin: 4px 0 8px 0;
  padding: 12px 14px;
  border-radius: 8px;
  background: ${s("backgroundSecondary")};
  min-height: 24px;
`;

const ChartWrap = styled.div`
  position: relative;
  margin-bottom: 10px;
`;

const Chart = styled.svg`
  display: block;
  width: 100%;
  height: 48px;
  overflow: visible;
`;

const TargetLine = styled.line`
  stroke: ${s("textTertiary")};
  stroke-width: 1;
  stroke-dasharray: 3 3;
`;

const TrendLine = styled.polyline`
  fill: none;
  stroke: ${s("accent")};
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
`;

const EndPoint = styled.span`
  position: absolute;
  width: 7px;
  height: 7px;
  margin: -3.5px 0 0 -3.5px;
  border-radius: 50%;
  background: ${s("accent")};
`;

const TargetLabel = styled.span`
  position: absolute;
  right: 0;
  transform: translateY(-120%);
  padding-left: 6px;
  font-size: 11px;
  line-height: 1;
  color: ${s("textTertiary")};
  background: ${s("backgroundSecondary")};
`;

const List = styled.ol`
  list-style: none;
  margin: 0;
  padding: 0;
`;

const Entry = styled.li`
  padding: 6px 0;

  & + & {
    border-top: 1px solid ${s("divider")};
  }
`;

const EntryHead = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 13px;
`;

const Value = styled.span`
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: ${s("text")};
`;

const Muted = styled.span`
  font-size: 13px;
  color: ${s("textTertiary")};
`;

const Note = styled.p`
  margin: 4px 0 0 16px;
  font-size: 14px;
  line-height: 1.5;
  color: ${s("textSecondary")};
  white-space: pre-wrap;
  max-width: 64ch;
`;

const DeleteButton = styled.button`
  margin-left: auto;
  border: 0;
  background: none;
  padding: 0;
  font-size: 13px;
  color: ${s("textTertiary")};
  cursor: var(--pointer);

  &:hover {
    color: ${s("danger")};
  }
`;

const ShowMore = styled.button`
  margin-top: 6px;
  border: 0;
  background: none;
  padding: 0;
  font-size: 13px;
  font-weight: 500;
  color: ${s("textSecondary")};
  cursor: var(--pointer);

  &:hover {
    color: ${s("text")};
  }
`;
