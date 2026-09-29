import { formatDistanceToNowStrict } from "date-fns";
import * as React from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import breakpoint from "styled-components-breakpoint";
import { s, hover } from "@shared/styles";
import { Avatar, AvatarSize } from "~/components/Avatar";
import ButtonSmall from "~/components/ButtonSmall";
import { needsCheckIn } from "../../shared/progress";
import type { GoalKeyResultJSON } from "../../shared/types";
import { GoalValidation } from "../../shared/types";
import { useGoalsContext } from "../context";
import { formatKeyResultValue } from "../format";
import { CheckInHistory } from "./CheckInHistory";
import { ItemMenu } from "./ItemMenu";
import { ProgressBar } from "./ProgressBar";
import { StatusLabel } from "./StatusLabel";

interface Props {
  keyResult: GoalKeyResultJSON;
}

/**
 * One key result: its title and progress against the calendar, where it
 * stands, who owns it, and the check-in action. Expands to show history.
 */
export function KeyResultRow({ keyResult }: Props) {
  const { t } = useTranslation();
  const {
    index,
    currentUserId,
    refetch,
    openCheckIn,
    openEditKeyResult,
    deleteKeyResult,
  } = useGoalsContext();
  const [expanded, setExpanded] = React.useState(false);
  const owner = index.usersById.get(keyResult.ownerId);
  const historyId = `kr-history-${keyResult.id}`;
  const stale = needsCheckIn(keyResult, GoalValidation.staleAfterDays);
  const mine = keyResult.ownerId === currentUserId;

  const staleText = !stale
    ? null
    : keyResult.lastCheckInAt
      ? t("Last check-in {{ time }} ago", {
          time: formatDistanceToNowStrict(new Date(keyResult.lastCheckInAt)),
        })
      : t("No check-ins yet");

  return (
    <li>
      <Row>
        <Main>
          <Toggle
            type="button"
            aria-expanded={expanded}
            aria-controls={historyId}
            onClick={() => setExpanded(!expanded)}
          >
            {keyResult.title}
          </Toggle>
          {staleText && <Stale $mine={mine}>{staleText}</Stale>}
          <ProgressBar
            progress={keyResult.progress}
            elapsed={index.elapsed}
            tone={keyResult.status}
            size="small"
            label={keyResult.title}
          />
        </Main>
        <Value>{formatKeyResultValue(keyResult, t)}</Value>
        <Status>
          <StatusLabel status={keyResult.status} />
        </Status>
        <Owner>
          {owner && (
            <Avatar
              model={owner}
              size={AvatarSize.Medium}
              showTooltip
              alt={owner.name}
            />
          )}
        </Owner>
        <Actions>
          {keyResult.abilities.checkIn && (
            <ButtonSmall
              neutral={!(stale && mine)}
              onClick={() => openCheckIn(keyResult)}
            >
              {t("Check in")}
            </ButtonSmall>
          )}
          <MenuReveal>
            <ItemMenu
              ariaLabel={t("Key result options")}
              onEdit={
                keyResult.abilities.update
                  ? () => openEditKeyResult(keyResult)
                  : undefined
              }
              onDelete={
                keyResult.abilities.delete
                  ? () => deleteKeyResult(keyResult)
                  : undefined
              }
            />
          </MenuReveal>
        </Actions>
      </Row>
      {expanded && (
        <div id={historyId}>
          <CheckInHistory
            keyResult={keyResult}
            usersById={index.usersById}
            onChanged={refetch}
          />
        </div>
      )}
    </li>
  );
}

const MenuReveal = styled.span`
  display: flex;

  /* On pointer devices the menu waits for hover or focus to cut noise. */
  @media (hover: hover) {
    opacity: 0;
    transition: opacity 100ms ease-out;

    &:has([aria-expanded="true"]) {
      opacity: 1;
    }
  }
`;

const Row = styled.div`
  &:hover ${MenuReveal}, &:focus-within ${MenuReveal} {
    opacity: 1;
  }

  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  grid-template-areas:
    "main main main"
    "value status actions";
  align-items: center;
  column-gap: 12px;
  row-gap: 4px;
  padding: 8px 0;

  ${breakpoint("tablet")`
    grid-template-columns: minmax(0, 1fr) 10.5em 7.5em 24px 7.5em;
    grid-template-areas: "main value status owner actions";
    row-gap: 0;
  `};
`;

const Main = styled.div`
  grid-area: main;
  position: relative;
  min-width: 0;
  margin: -4px -8px;
  padding: 4px 8px;
  border-radius: 6px;

  &: ${hover} {
    background: ${s("backgroundSecondary")};
  }

  &:focus-within:has(:focus-visible) {
    outline: 2px solid ${s("accent")};
    outline-offset: -2px;
  }
`;

const Toggle = styled.button`
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: none;
  text-align: start;
  font-size: 15px;
  line-height: 1.4;
  color: ${s("text")};
  cursor: var(--pointer);

  &:focus-visible {
    outline: none;
  }

  /* Stretch the click target over the whole cell, progress bar included. */
  &::after {
    content: "";
    position: absolute;
    inset: 0;
  }
`;

const Stale = styled.span<{ $mine: boolean }>`
  display: block;
  font-size: 12px;
  color: ${(props) =>
    props.$mine ? props.theme.warning : props.theme.textTertiary};
`;

const Value = styled.span`
  grid-area: value;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: ${s("textSecondary")};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  ${breakpoint("tablet")`
    text-align: end;
  `};
`;

const Status = styled.span`
  grid-area: status;
`;

const Owner = styled.span`
  grid-area: owner;
  display: none;

  ${breakpoint("tablet")`
    display: flex;
  `};
`;

const Actions = styled.span`
  grid-area: actions;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
`;
