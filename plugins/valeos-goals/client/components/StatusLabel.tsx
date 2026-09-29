import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { s } from "@shared/styles";
import { GoalStatus } from "../../shared/types";
import { statusLabel } from "../format";

type Props = {
  status: GoalStatus | null;
  /** Hide the text and show only the dot, keeping it as the accessible name. */
  dotOnly?: boolean;
};

/** A coloured dot and label for a key result or objective status. */
export function StatusLabel({ status, dotOnly }: Props) {
  const { t } = useTranslation();
  const label = statusLabel(status, t);
  return (
    <Wrapper title={dotOnly ? label : undefined}>
      <StatusDot $status={status} aria-hidden />
      {dotOnly ? <VisuallyHidden>{label}</VisuallyHidden> : label}
    </Wrapper>
  );
}

export const StatusDot = styled.span<{ $status: GoalStatus | null }>`
  display: inline-block;
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${(props) => {
    switch (props.$status) {
      case GoalStatus.OnTrack:
        return props.theme.success;
      case GoalStatus.AtRisk:
        return props.theme.warning;
      case GoalStatus.OffTrack:
        return props.theme.danger;
      default:
        return "transparent";
    }
  }};
  box-shadow: ${(props) =>
    props.$status ? "none" : `inset 0 0 0 1.5px ${props.theme.textTertiary}`};
`;

const Wrapper = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: ${s("textSecondary")};
  white-space: nowrap;
`;

const VisuallyHidden = styled.span`
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
`;
