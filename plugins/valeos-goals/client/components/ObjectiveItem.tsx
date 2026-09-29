import { PlusIcon } from "outline-icons";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import styled, { keyframes } from "styled-components";
import { s, hover } from "@shared/styles";
import { Avatar, AvatarSize } from "~/components/Avatar";
import type { GoalObjectiveJSON } from "../../shared/types";
import { GoalLevel } from "../../shared/types";
import { useGoalsContext } from "../context";
import { formatPercent } from "../format";
import type { GoalsIndex } from "../useGoals";
import { ItemMenu } from "./ItemMenu";
import { KeyResultRow } from "./KeyResultRow";
import { ProgressBar } from "./ProgressBar";
import { StatusDot } from "./StatusLabel";

interface Props {
  objective: GoalObjectiveJSON;
  /** Show which level or team it belongs to, for mixed lists. */
  showContext?: boolean;
  /** Show the objectives aligned underneath it. */
  showAligned?: boolean;
}

/**
 * Where an objective belongs, in words: the church, a team, or a person.
 *
 * @param objective - the objective.
 * @param index - the page data, for group names.
 * @param t - the translation function.
 * @returns a short label.
 */
export function contextLabel(
  objective: GoalObjectiveJSON,
  index: GoalsIndex,
  t: (key: string) => string
): string {
  switch (objective.level) {
    case GoalLevel.Church:
      return t("Church");
    case GoalLevel.Team:
      return (
        (objective.groupId && index.groupsById.get(objective.groupId)?.name) ||
        t("No team")
      );
    default:
      return t("Personal");
  }
}

/**
 * An objective with its progress against the calendar, its key results, and
 * optionally the objectives that support it.
 */
export function ObjectiveItem({ objective, showContext, showAligned }: Props) {
  const { t } = useTranslation();
  const ctx = useGoalsContext();
  const { index } = ctx;
  const owner = index.usersById.get(objective.ownerId);
  const parent = objective.parentId
    ? index.objectivesById.get(objective.parentId)
    : undefined;
  const keyResults = index.keyResultsByObjective.get(objective.id) ?? [];
  const aligned = showAligned
    ? (index.childrenByParent.get(objective.id) ?? [])
    : [];

  return (
    <Wrapper id={`objective-${objective.id}`}>
      <Head>
        <TitleBlock>
          <Title>{objective.title}</Title>
          <Meta>
            {showContext && <span>{contextLabel(objective, index, t)}</span>}
            {owner && <span>{owner.name}</span>}
            {parent && (
              <span>
                {t("Supports")}{" "}
                <MetaLink to={ctx.objectiveLink(parent)}>
                  {parent.title}
                </MetaLink>
              </span>
            )}
          </Meta>
        </TitleBlock>
        <Percent>{formatPercent(objective.progress)}</Percent>
        {owner && (
          <Avatar
            model={owner}
            size={AvatarSize.Large}
            showTooltip
            alt={owner.name}
          />
        )}
        <MenuSlot>
          <ObjectiveMenu objective={objective} />
        </MenuSlot>
      </Head>
      <ProgressBar
        progress={objective.progress}
        elapsed={index.elapsed}
        tone={objective.status}
        size="medium"
        label={objective.title}
      />
      {objective.description && (
        <Description>{objective.description}</Description>
      )}
      {keyResults.length > 0 ? (
        <KeyResults aria-label={t("Key results")}>
          {keyResults.map((kr) => (
            <KeyResultRow key={kr.id} keyResult={kr} />
          ))}
        </KeyResults>
      ) : (
        <NoKeyResults>
          {t("No key results yet. Add two to four ways to measure this.")}
        </NoKeyResults>
      )}
      {objective.abilities.createKeyResult && (
        <AddButton
          type="button"
          onClick={() => ctx.openAddKeyResult(objective)}
        >
          <PlusIcon size={18} />
          {t("Add key result")}
        </AddButton>
      )}
      {aligned.length > 0 && (
        <Aligned>
          <AlignedTitle>{t("Supported by")}</AlignedTitle>
          <ul>
            {aligned.map((child) => {
              const childOwner = index.usersById.get(child.ownerId);
              return (
                <li key={child.id}>
                  <AlignedRow to={ctx.objectiveLink(child)}>
                    <StatusDot $status={child.status} aria-hidden />
                    <AlignedName>{child.title}</AlignedName>
                    <AlignedMeta>
                      {child.level === GoalLevel.Team
                        ? contextLabel(child, index, t)
                        : childOwner?.name}
                    </AlignedMeta>
                    <AlignedBar>
                      <ProgressBar
                        progress={child.progress}
                        tone={child.status}
                        size="small"
                        label={child.title}
                      />
                    </AlignedBar>
                    <AlignedPercent>
                      {formatPercent(child.progress)}
                    </AlignedPercent>
                  </AlignedRow>
                </li>
              );
            })}
          </ul>
        </Aligned>
      )}
    </Wrapper>
  );
}

/** The objective's overflow menu, wired to the page actions. */
function ObjectiveMenu({ objective }: { objective: GoalObjectiveJSON }) {
  const { t } = useTranslation();
  const ctx = useGoalsContext();
  return (
    <ItemMenu
      ariaLabel={t("Objective options")}
      onEdit={
        objective.abilities.update
          ? () => ctx.openEditObjective(objective)
          : undefined
      }
      onAddKeyResult={
        objective.abilities.createKeyResult
          ? () => ctx.openAddKeyResult(objective)
          : undefined
      }
      onDelete={
        objective.abilities.delete
          ? () => ctx.deleteObjective(objective)
          : undefined
      }
    />
  );
}

const flash = keyframes`
  from {
    box-shadow: -12px 0 0 0 var(--goals-flash), 12px 0 0 0 var(--goals-flash);
    background: var(--goals-flash);
  }
  to {
    box-shadow: none;
    background: transparent;
  }
`;

const Wrapper = styled.article`
  --goals-flash: ${s("backgroundSecondary")};
  padding: 20px 0 16px;
  border-bottom: 1px solid ${s("divider")};
  scroll-margin-top: 80px;

  &:last-child {
    border-bottom: 0;
  }

  &.highlight {
    animation: ${flash} 1600ms ease-out;
  }

  @media (prefers-reduced-motion: reduce) {
    &.highlight {
      animation: none;
    }
  }
`;

const Head = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 12px;
`;

const TitleBlock = styled.div`
  flex: 1;
  min-width: 0;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  line-height: 1.35;
  color: ${s("text")};
`;

const Meta = styled.div`
  display: flex;
  flex-wrap: wrap;
  column-gap: 14px;
  row-gap: 2px;
  margin-top: 2px;
  font-size: 13px;
  color: ${s("textTertiary")};
`;

const MetaLink = styled(Link)`
  color: ${s("textSecondary")};

  &: ${hover} {
    color: ${s("text")};
    text-decoration: underline;
  }
`;

const Percent = styled.span`
  font-size: 15px;
  font-weight: 600;
  line-height: 28px;
  font-variant-numeric: tabular-nums;
  color: ${s("text")};
`;

const MenuSlot = styled.span`
  display: flex;
  align-items: center;
  height: 28px;
`;

const Description = styled.p`
  margin: 6px 0 0;
  max-width: 68ch;
  font-size: 14px;
  line-height: 1.5;
  color: ${s("textSecondary")};
  white-space: pre-wrap;
`;

const KeyResults = styled.ul`
  list-style: none;
  margin: 6px 0 0;
  padding: 0 0 0 16px;
  border-inline-start: 2px solid ${s("divider")};
`;

const NoKeyResults = styled.p`
  margin: 10px 0 0;
  font-size: 14px;
  color: ${s("textTertiary")};
`;

const AddButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin: 6px 0 0 12px;
  padding: 2px 8px 2px 2px;
  border: 0;
  border-radius: 4px;
  background: none;
  font-size: 13px;
  font-weight: 500;
  color: ${s("textTertiary")};
  cursor: var(--pointer);

  &: ${hover} {
    color: ${s("text")};
    background: ${s("backgroundSecondary")};
  }
`;

const Aligned = styled.div`
  margin: 14px 0 0 18px;

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
`;

const AlignedTitle = styled.h4`
  margin: 0 0 2px;
  font-size: 13px;
  font-weight: 600;
  color: ${s("textTertiary")};
`;

const AlignedRow = styled(Link)`
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr) auto;
  align-items: center;
  column-gap: 10px;
  margin: 0 -8px;
  padding: 5px 8px;
  border-radius: 6px;
  font-size: 14px;
  color: ${s("textSecondary")};

  &: ${hover} {
    background: ${s("backgroundSecondary")};
    color: ${s("text")};
  }

  @media (min-width: 600px) {
    grid-template-columns: 8px minmax(0, 1fr) auto 72px 3em;
  }
`;

const AlignedName = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const AlignedMeta = styled.span`
  font-size: 13px;
  color: ${s("textTertiary")};
  white-space: nowrap;
`;

const AlignedBar = styled.span`
  display: none;

  @media (min-width: 600px) {
    display: block;
  }
`;

const AlignedPercent = styled.span`
  display: none;
  font-size: 13px;
  text-align: end;
  font-variant-numeric: tabular-nums;

  @media (min-width: 600px) {
    display: block;
  }
`;
