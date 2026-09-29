import { PlusIcon } from "outline-icons";
import * as React from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { s, hover } from "@shared/styles";
import { Avatar, AvatarSize } from "~/components/Avatar";
import Button from "~/components/Button";
import { meanProgress } from "../../shared/progress";
import type { GoalObjectiveJSON } from "../../shared/types";
import { GoalLevel, GoalLevelOrder } from "../../shared/types";
import { useGoalsContext } from "../context";
import { formatPercent } from "../format";
import { ObjectiveItem } from "./ObjectiveItem";

export enum GoalsView {
  Church = "church",
  Teams = "teams",
  People = "people",
  Mine = "mine",
}

/** Church objectives, each with what supports it underneath. */
export function ChurchView() {
  const { t } = useTranslation();
  const { index, openNewObjective } = useGoalsContext();
  const church = index.data.objectives.filter(
    (o) => o.level === GoalLevel.Church
  );

  if (church.length === 0) {
    return index.data.abilities.createObjective.church ? (
      <EmptyState
        text={t(
          "Start with two or three church-wide objectives for this cycle. Teams and staff can then line their own goals up underneath."
        )}
        action={t("New church objective")}
        onAction={() => openNewObjective(GoalLevel.Church)}
      />
    ) : (
      <EmptyState
        text={t("Leadership hasn’t set church objectives for this cycle yet.")}
      />
    );
  }

  return (
    <List>
      {church.map((objective) => (
        <ObjectiveItem key={objective.id} objective={objective} showAligned />
      ))}
    </List>
  );
}

/** Team objectives, a section per group. */
export function TeamsView() {
  const { t } = useTranslation();
  const { index, openNewObjective } = useGoalsContext();
  const canCreate = index.data.abilities.createObjective.team;
  const team = index.data.objectives.filter((o) => o.level === GoalLevel.Team);

  const sections = React.useMemo(() => {
    const byGroup = new Map<string, GoalObjectiveJSON[]>();
    for (const objective of team) {
      const key = objective.groupId ?? "";
      byGroup.set(key, [...(byGroup.get(key) ?? []), objective]);
    }
    return [...byGroup.entries()]
      .map(([groupId, objectives]) => ({
        groupId,
        name: index.groupsById.get(groupId)?.name ?? t("No team"),
        objectives,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [team, index.groupsById, t]);

  if (team.length === 0) {
    return (
      <EmptyState
        text={t("No team objectives yet.")}
        action={canCreate ? t("New team objective") : undefined}
        onAction={() => openNewObjective(GoalLevel.Team)}
      />
    );
  }

  return (
    <>
      {sections.map((section) => (
        <Section key={section.groupId || "none"}>
          <SectionHead>
            <SectionTitle>{section.name}</SectionTitle>
            <SectionPercent>
              {formatPercent(
                meanProgress(section.objectives.map((o) => o.progress))
              )}
            </SectionPercent>
            {canCreate && section.groupId && (
              <SectionAdd
                type="button"
                onClick={() =>
                  openNewObjective(GoalLevel.Team, section.groupId)
                }
                aria-label={t("New objective for {{ team }}", {
                  team: section.name,
                })}
              >
                <PlusIcon size={18} />
              </SectionAdd>
            )}
          </SectionHead>
          <List>
            {section.objectives.map((objective) => (
              <ObjectiveItem
                key={objective.id}
                objective={objective}
                showAligned
              />
            ))}
          </List>
        </Section>
      ))}
    </>
  );
}

/** Personal objectives, a section per person, the viewer first. */
export function PeopleView() {
  const { t } = useTranslation();
  const { index, currentUserId, openNewObjective } = useGoalsContext();
  const personal = index.data.objectives.filter(
    (o) => o.level === GoalLevel.Personal
  );

  const sections = React.useMemo(() => {
    const byOwner = new Map<string, GoalObjectiveJSON[]>();
    for (const objective of personal) {
      byOwner.set(objective.ownerId, [
        ...(byOwner.get(objective.ownerId) ?? []),
        objective,
      ]);
    }
    return [...byOwner.entries()]
      .map(([ownerId, objectives]) => ({
        owner: index.usersById.get(ownerId),
        ownerId,
        objectives,
      }))
      .sort((a, b) => {
        if (a.ownerId === currentUserId) {
          return -1;
        }
        if (b.ownerId === currentUserId) {
          return 1;
        }
        return (a.owner?.name ?? "").localeCompare(b.owner?.name ?? "");
      });
  }, [personal, index.usersById, currentUserId]);

  const canCreate = index.data.abilities.createObjective.personal;

  if (personal.length === 0) {
    return (
      <EmptyState
        text={t(
          "No personal objectives yet. Set one of your own that supports your team or the church."
        )}
        action={canCreate ? t("New personal objective") : undefined}
        onAction={() => openNewObjective(GoalLevel.Personal)}
      />
    );
  }

  return (
    <>
      {sections.map((section) => (
        <Section key={section.ownerId}>
          <SectionHead>
            {section.owner && (
              <Avatar model={section.owner} size={AvatarSize.Medium} alt="" />
            )}
            <SectionTitle>{section.owner?.name ?? t("Someone")}</SectionTitle>
            <SectionPercent>
              {formatPercent(
                meanProgress(section.objectives.map((o) => o.progress))
              )}
            </SectionPercent>
          </SectionHead>
          <List>
            {section.objectives.map((objective) => (
              <ObjectiveItem key={objective.id} objective={objective} />
            ))}
          </List>
        </Section>
      ))}
    </>
  );
}

/** Everything the viewer owns or has a key result on. */
export function MineView() {
  const { t } = useTranslation();
  const { index, currentUserId, openNewObjective } = useGoalsContext();

  const objectives = React.useMemo(() => {
    const hasMyKeyResult = new Set(
      index.data.keyResults
        .filter((kr) => kr.ownerId === currentUserId)
        .map((kr) => kr.objectiveId)
    );
    return index.data.objectives
      .filter((o) => o.ownerId === currentUserId || hasMyKeyResult.has(o.id))
      .sort(
        (a, b) =>
          GoalLevelOrder.indexOf(a.level) - GoalLevelOrder.indexOf(b.level)
      );
  }, [index.data, currentUserId]);

  if (objectives.length === 0) {
    const canCreate = index.data.abilities.createObjective.personal;
    return (
      <EmptyState
        text={t(
          "Nothing here is yours yet. Objectives and key results you own will show here."
        )}
        action={canCreate ? t("New personal objective") : undefined}
        onAction={() => openNewObjective(GoalLevel.Personal)}
      />
    );
  }

  return (
    <List>
      {objectives.map((objective) => (
        <ObjectiveItem key={objective.id} objective={objective} showContext />
      ))}
    </List>
  );
}

interface EmptyStateProps {
  text: string;
  action?: string;
  onAction?: () => void;
}

/** An empty view that points to the next thing to do. */
function EmptyState({ text, action, onAction }: EmptyStateProps) {
  return (
    <Empty>
      <p>{text}</p>
      {action && onAction && (
        <Button neutral icon={<PlusIcon />} onClick={onAction}>
          {action}
        </Button>
      )}
    </Empty>
  );
}

const List = styled.div`
  display: flex;
  flex-direction: column;
`;

const Section = styled.section`
  margin: 28px 0 0;

  &:first-child {
    margin-top: 12px;
  }
`;

const SectionHead = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid ${s("divider")};
`;

const SectionTitle = styled.h2`
  flex: 1;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: ${s("textTertiary")};
`;

const SectionPercent = styled.span`
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: ${s("textTertiary")};
`;

const SectionAdd = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 4px;
  background: none;
  color: ${s("textTertiary")};
  cursor: var(--pointer);

  &: ${hover} {
    color: ${s("text")};
    background: ${s("backgroundSecondary")};
  }
`;

const Empty = styled.div`
  padding: 32px 0;
  max-width: 52ch;
  color: ${s("textSecondary")};

  p {
    margin: 0 0 16px;
    line-height: 1.5;
  }
`;
