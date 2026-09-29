import { observer } from "mobx-react";
import {
  CalendarIcon,
  EditIcon,
  PlusIcon,
  TargetIcon,
  TrashIcon,
} from "outline-icons";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { useHistory, useLocation, useParams } from "react-router-dom";
import { toast } from "sonner";
import styled from "styled-components";
import { s } from "@shared/styles";
import { Action } from "~/components/Actions";
import Button from "~/components/Button";
import ConfirmationDialog from "~/components/ConfirmationDialog";
import Heading from "~/components/Heading";
import { DropdownMenu } from "~/components/Menu/DropdownMenu";
import Scene from "~/components/Scene";
import { Tab, Tabs } from "~/components/Tabs";
import { ActionSeparator, createAction } from "~/actions";
import useCurrentUser from "~/hooks/useCurrentUser";
import { useMenuAction } from "~/hooks/useMenuAction";
import useStores from "~/hooks/useStores";
import { needsCheckIn } from "../../shared/progress";
import type {
  GoalCycleJSON,
  GoalKeyResultJSON,
  GoalObjectiveJSON,
} from "../../shared/types";
import { GoalLevel, GoalValidation } from "../../shared/types";
import { goalsApi } from "../api";
import { CycleStrip } from "../components/CycleStrip";
import {
  ChurchView,
  GoalsView,
  MineView,
  PeopleView,
  TeamsView,
} from "../components/Views";
import type { GoalsActions } from "../context";
import { GoalsContext } from "../context";
import { CheckInDialog } from "../dialogs/CheckInDialog";
import { CycleDialog } from "../dialogs/CycleDialog";
import { KeyResultDialog } from "../dialogs/KeyResultDialog";
import { ObjectiveDialog } from "../dialogs/ObjectiveDialog";
import { useGoals } from "../useGoals";

const ViewForLevel: Record<GoalLevel, GoalsView> = {
  [GoalLevel.Church]: GoalsView.Church,
  [GoalLevel.Team]: GoalsView.Teams,
  [GoalLevel.Personal]: GoalsView.People,
};

/**
 * The Goals page: the current cycle's objectives and key results at church,
 * team and personal level, with weekly check-ins.
 */
function Goals() {
  const { t } = useTranslation();
  const { cycleId } = useParams<{ cycleId?: string }>();
  const location = useLocation();
  const history = useHistory();
  const user = useCurrentUser();
  const { dialogs } = useStores();
  const { index, error, loading, refetch } = useGoals(cycleId);

  const requestedView = new URLSearchParams(location.search).get("view");
  const view =
    Object.values(GoalsView).find((v) => v === requestedView) ??
    GoalsView.Church;

  const cycle = index?.data.cycle ?? null;
  const basePath = cycle ? `/goals/${cycle.id}` : "/goals";

  const setView = React.useCallback(
    (next: GoalsView) => {
      history.replace({
        pathname: basePath,
        search: next === GoalsView.Church ? "" : `?view=${next}`,
      });
    },
    [history, basePath]
  );

  const closeAndRefetch = React.useCallback(async () => {
    dialogs.closeAllModals();
    await refetch();
  }, [dialogs, refetch]);

  const actions = React.useMemo<GoalsActions | null>(() => {
    if (!index) {
      return null;
    }

    const openAddKeyResult = (objective: GoalObjectiveJSON) => {
      dialogs.openModal({
        title: t("Add key result"),
        replace: true,
        content: (
          <KeyResultDialog
            key={Date.now()}
            objective={objective}
            users={index.data.users}
            onSaved={(another) => {
              void refetch();
              if (another) {
                openAddKeyResult(objective);
              } else {
                dialogs.closeAllModals();
              }
            }}
          />
        ),
      });
    };

    const confirmDelete = (
      title: string,
      body: string,
      perform: () => Promise<void>,
      done: string
    ) => {
      dialogs.openModal({
        title,
        content: (
          <ConfirmationDialog
            danger
            submitText={t("Delete")}
            savingText={`${t("Deleting")}…`}
            onSubmit={async () => {
              await perform();
              toast.success(done);
              await refetch();
            }}
          >
            {body}
          </ConfirmationDialog>
        ),
      });
    };

    return {
      index,
      currentUserId: user.id,
      refetch,
      openCheckIn: (keyResult: GoalKeyResultJSON) =>
        dialogs.openModal({
          title: t("Check in"),
          content: (
            <CheckInDialog keyResult={keyResult} onSaved={closeAndRefetch} />
          ),
        }),
      openAddKeyResult,
      openEditKeyResult: (keyResult: GoalKeyResultJSON) => {
        const objective = index.objectivesById.get(keyResult.objectiveId);
        if (!objective) {
          return;
        }
        dialogs.openModal({
          title: t("Edit key result"),
          content: (
            <KeyResultDialog
              objective={objective}
              users={index.data.users}
              keyResult={keyResult}
              onSaved={closeAndRefetch}
            />
          ),
        });
      },
      deleteKeyResult: (keyResult: GoalKeyResultJSON) =>
        confirmDelete(
          t("Delete key result"),
          t(
            "“{{ title }}” and its check-in history will be deleted. This can’t be undone.",
            { title: keyResult.title }
          ),
          () => goalsApi.deleteKeyResult(keyResult.id),
          t("Key result deleted")
        ),
      openNewObjective: (level?: GoalLevel, groupId?: string) =>
        dialogs.openModal({
          title: t("New objective"),
          content: (
            <ObjectiveDialog
              index={index}
              currentUserId={user.id}
              isAdmin={user.isAdmin}
              defaultLevel={level}
              defaultGroupId={groupId}
              onSaved={(objective) => {
                void refetch();
                openAddKeyResult(objective);
              }}
            />
          ),
        }),
      openEditObjective: (objective: GoalObjectiveJSON) =>
        dialogs.openModal({
          title: t("Edit objective"),
          content: (
            <ObjectiveDialog
              index={index}
              currentUserId={user.id}
              isAdmin={user.isAdmin}
              objective={objective}
              onSaved={closeAndRefetch}
            />
          ),
        }),
      deleteObjective: (objective: GoalObjectiveJSON) =>
        confirmDelete(
          t("Delete objective"),
          t(
            "“{{ title }}”, its key results and their check-ins will be deleted. Objectives that support it will stay, unlinked. This can’t be undone.",
            { title: objective.title }
          ),
          () => goalsApi.deleteObjective(objective.id),
          t("Objective deleted")
        ),
      objectiveLink: (objective: GoalObjectiveJSON) => {
        const target = ViewForLevel[objective.level];
        const search = target === GoalsView.Church ? "" : `?view=${target}`;
        return `/goals/${objective.cycleId}${search}#objective-${objective.id}`;
      },
    };
  }, [index, user.id, user.isAdmin, dialogs, t, refetch, closeAndRefetch]);

  // Scroll to and briefly highlight an objective linked by hash.
  React.useEffect(() => {
    if (!index || !location.hash.startsWith("#objective-")) {
      return;
    }
    const element = document.getElementById(location.hash.slice(1));
    if (!element) {
      return;
    }
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    element.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });
    element.classList.add("highlight");
    const timer = window.setTimeout(
      () => element.classList.remove("highlight"),
      1600
    );
    return () => window.clearTimeout(timer);
  }, [index, location.hash, view]);

  const waitingCount = index
    ? index.data.keyResults.filter(
        (kr) =>
          kr.ownerId === user.id &&
          kr.abilities.checkIn &&
          needsCheckIn(kr, GoalValidation.staleAfterDays)
      ).length
    : 0;

  const canCreateObjective =
    !!cycle &&
    !!index &&
    Object.values(index.data.abilities.createObjective).some(Boolean);

  return (
    <Scene
      icon={<TargetIcon />}
      title={t("Goals")}
      actions={
        index && (
          <>
            <Action>
              <CycleMenu
                cycles={index.data.cycles}
                current={cycle}
                canCreate={index.data.abilities.createCycle}
                onSelect={(id) =>
                  history.push(`/goals/${id}${location.search}`)
                }
                onCreate={() =>
                  dialogs.openModal({
                    title: t("New cycle"),
                    content: (
                      <CycleDialog
                        onSaved={(saved) => {
                          dialogs.closeAllModals();
                          history.push(`/goals/${saved.id}`);
                        }}
                      />
                    ),
                  })
                }
                onEdit={(target) =>
                  dialogs.openModal({
                    title: t("Edit cycle"),
                    content: (
                      <CycleDialog cycle={target} onSaved={closeAndRefetch} />
                    ),
                  })
                }
                onDelete={(target) =>
                  dialogs.openModal({
                    title: t("Delete cycle"),
                    content: (
                      <ConfirmationDialog
                        danger
                        submitText={t("Delete")}
                        savingText={`${t("Deleting")}…`}
                        onSubmit={async () => {
                          await goalsApi.deleteCycle(target.id);
                          toast.success(t("Cycle deleted"));
                          history.push("/goals");
                          await refetch();
                        }}
                      >
                        {t(
                          "“{{ name }}” and every objective, key result and check-in in it will be deleted. This can’t be undone.",
                          { name: target.name }
                        )}
                      </ConfirmationDialog>
                    ),
                  })
                }
              />
            </Action>
            {canCreateObjective && actions && (
              <Action>
                <Button
                  icon={<PlusIcon />}
                  onClick={() =>
                    actions.openNewObjective(
                      view === GoalsView.Teams
                        ? GoalLevel.Team
                        : view === GoalsView.People || view === GoalsView.Mine
                          ? GoalLevel.Personal
                          : GoalLevel.Church
                    )
                  }
                >
                  {t("New objective")}
                </Button>
              </Action>
            )}
          </>
        )
      }
    >
      {error && !index ? (
        <Message>
          <Heading>{t("Goals")}</Heading>
          <p>{t("Goals couldn’t be loaded: {{ error }}", { error })}</p>
          <Button neutral onClick={() => void refetch()}>
            {t("Try again")}
          </Button>
        </Message>
      ) : loading && !index ? null : index && actions && !cycle ? (
        <Message>
          <Heading>{t("Goals")}</Heading>
          {index.data.abilities.createCycle ? (
            <>
              <p>
                {t(
                  "Goals are set for a cycle, such as a term or a quarter. Set up the first one, then add church objectives for it."
                )}
              </p>
              <Button
                icon={<PlusIcon />}
                onClick={() =>
                  dialogs.openModal({
                    title: t("New cycle"),
                    content: (
                      <CycleDialog
                        onSaved={(saved) => {
                          dialogs.closeAllModals();
                          history.push(`/goals/${saved.id}`);
                        }}
                      />
                    ),
                  })
                }
              >
                {t("Set up your first cycle")}
              </Button>
            </>
          ) : (
            <p>{t("Goals will show here once leadership sets up a cycle.")}</p>
          )}
        </Message>
      ) : index && actions && cycle ? (
        <GoalsContext.Provider value={actions}>
          <CycleStrip
            index={index}
            cycle={cycle}
            waitingCount={waitingCount}
            onShowWaiting={() => setView(GoalsView.Mine)}
          />
          <Tabs>
            <Tab
              active={view === GoalsView.Church}
              onClick={() => setView(GoalsView.Church)}
            >
              {t("Church")}
            </Tab>
            <Tab
              active={view === GoalsView.Teams}
              onClick={() => setView(GoalsView.Teams)}
            >
              {t("Teams")}
            </Tab>
            <Tab
              active={view === GoalsView.People}
              onClick={() => setView(GoalsView.People)}
            >
              {t("People")}
            </Tab>
            <Tab
              active={view === GoalsView.Mine}
              onClick={() => setView(GoalsView.Mine)}
            >
              {t("Mine")}
            </Tab>
          </Tabs>
          {view === GoalsView.Church && <ChurchView />}
          {view === GoalsView.Teams && <TeamsView />}
          {view === GoalsView.People && <PeopleView />}
          {view === GoalsView.Mine && <MineView />}
        </GoalsContext.Provider>
      ) : null}
    </Scene>
  );
}

interface CycleMenuProps {
  cycles: GoalCycleJSON[];
  current: GoalCycleJSON | null;
  canCreate: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onEdit: (cycle: GoalCycleJSON) => void;
  onDelete: (cycle: GoalCycleJSON) => void;
}

/** Switches between cycles and, for admins, manages them. */
function CycleMenu({
  cycles,
  current,
  canCreate,
  onSelect,
  onCreate,
  onEdit,
  onDelete,
}: CycleMenuProps) {
  const { t } = useTranslation();
  const section = "Goals";

  const menuActions = React.useMemo(
    () => [
      ...cycles.map((cycle) =>
        createAction({
          name: cycle.name,
          section,
          selected: cycle.id === current?.id,
          perform: () => onSelect(cycle.id),
        })
      ),
      ActionSeparator,
      createAction({
        name: `${t("New cycle")}…`,
        icon: <PlusIcon />,
        section,
        visible: canCreate,
        perform: onCreate,
      }),
      createAction({
        name: `${t("Edit this cycle")}…`,
        icon: <EditIcon />,
        section,
        visible: !!current?.abilities.update,
        perform: () => current && onEdit(current),
      }),
      createAction({
        name: `${t("Delete this cycle")}…`,
        icon: <TrashIcon />,
        section,
        dangerous: true,
        visible: !!current?.abilities.delete,
        perform: () => current && onDelete(current),
      }),
    ],
    [cycles, current, canCreate, onSelect, onCreate, onEdit, onDelete, t]
  );

  const rootAction = useMenuAction(menuActions);

  if (cycles.length === 0) {
    return null;
  }

  return (
    <DropdownMenu action={rootAction} align="end" ariaLabel={t("Cycles")}>
      <Button neutral icon={<CalendarIcon />} disclosure>
        {t("Cycles")}
      </Button>
    </DropdownMenu>
  );
}

const Message = styled.div`
  max-width: 52ch;
  color: ${s("textSecondary")};

  p {
    line-height: 1.5;
    margin: 0 0 16px;
  }
`;

export default observer(Goals);
