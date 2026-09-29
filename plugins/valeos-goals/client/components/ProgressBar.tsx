import * as React from "react";
import { useTranslation } from "react-i18next";
import styled, { css, keyframes } from "styled-components";
import { s } from "@shared/styles";
import { GoalStatus } from "../../shared/types";
import { formatPercent } from "../format";

type Size = "small" | "medium" | "large";

type Props = {
  /** 0 to 1. */
  progress: number;
  /** 0 to 1, where the today marker sits. Omit to hide the marker. */
  elapsed?: number;
  /** Colours the fill; null is neutral, "accent" uses the team accent. */
  tone: GoalStatus | null | "accent";
  size?: Size;
  /** Number of week notches to draw along the track. */
  weeks?: number;
  /** Grow the fill from zero on first paint. */
  animateIn?: boolean;
  /** Accessible name, such as the goal's title. */
  label: string;
};

const heights: Record<Size, number> = { small: 3, medium: 6, large: 10 };

/**
 * A progress track with an optional "today" marker at the cycle's elapsed
 * point, so being ahead of or behind the calendar is visible at a glance.
 */
export function ProgressBar({
  progress,
  elapsed,
  tone,
  size = "medium",
  weeks,
  animateIn,
  label,
}: Props) {
  const { t } = useTranslation();
  const height = heights[size];
  const notches =
    weeks && weeks > 1
      ? Array.from({ length: weeks - 1 }, (_, i) => (i + 1) / weeks)
      : [];

  return (
    <Wrapper $height={height}>
      <Track
        $height={height}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-valuetext={formatPercent(progress)}
      >
        {notches.map((at) => (
          <Notch key={at} style={{ left: `${at * 100}%` }} />
        ))}
        <Fill
          $tone={tone}
          $animateIn={!!animateIn}
          style={{ width: `${progress * 100}%` }}
        />
      </Track>
      {elapsed !== undefined && elapsed > 0 && elapsed < 1 && (
        <Marker
          style={{ left: `${elapsed * 100}%` }}
          title={t("Today, {{ percent }} of the way through the cycle", {
            percent: formatPercent(elapsed),
          })}
          aria-hidden
        />
      )}
    </Wrapper>
  );
}

const grow = keyframes`
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
`;

const Wrapper = styled.div<{ $height: number }>`
  position: relative;
  width: 100%;
  padding: ${(props) => Math.max(3, props.$height / 2)}px 0;
`;

const Track = styled.div<{ $height: number }>`
  position: relative;
  height: ${(props) => props.$height}px;
  border-radius: ${(props) => props.$height}px;
  background: ${s("backgroundTertiary")};
  overflow: hidden;
`;

const Notch = styled.span`
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: ${s("background")};
  opacity: 0.7;
  z-index: 1;
`;

const Fill = styled.div<{
  $tone: GoalStatus | null | "accent";
  $animateIn: boolean;
}>`
  height: 100%;
  border-radius: inherit;
  transform-origin: left center;
  transition: width 500ms cubic-bezier(0.2, 0.8, 0.2, 1);
  background: ${(props) => {
    switch (props.$tone) {
      case "accent":
        return props.theme.accent;
      case GoalStatus.OnTrack:
        return props.theme.success;
      case GoalStatus.AtRisk:
        return props.theme.warning;
      case GoalStatus.OffTrack:
        return props.theme.danger;
      default:
        return props.theme.textTertiary;
    }
  }};

  ${(props) =>
    props.$animateIn &&
    css`
      animation: ${grow} 900ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
    `}

  @media (prefers-reduced-motion: reduce) {
    transition: none;
    animation: none;
  }
`;

const Marker = styled.span`
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  margin-left: -1px;
  border-radius: 1px;
  background: ${s("textSecondary")};
  z-index: 2;
`;
