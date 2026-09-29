import * as React from "react";
import { errToString } from "@shared/utils/error";
import { cycleElapsed } from "../shared/progress";
import type {
  GoalGroupJSON,
  GoalKeyResultJSON,
  GoalObjectiveJSON,
  GoalUserJSON,
  GoalsOverviewJSON,
} from "../shared/types";
import { goalsApi } from "./api";

export type GoalsIndex = {
  data: GoalsOverviewJSON;
  usersById: Map<string, GoalUserJSON>;
  groupsById: Map<string, GoalGroupJSON>;
  objectivesById: Map<string, GoalObjectiveJSON>;
  keyResultsByObjective: Map<string, GoalKeyResultJSON[]>;
  childrenByParent: Map<string, GoalObjectiveJSON[]>;
  /** 0 to 1, how much of the shown cycle has passed. */
  elapsed: number;
};

/**
 * Builds lookup maps over an overview response.
 *
 * @param data - the overview.
 * @returns the data plus indexes used across the page.
 */
function buildIndex(data: GoalsOverviewJSON): GoalsIndex {
  const usersById = new Map(data.users.map((u) => [u.id, u]));
  const groupsById = new Map(data.groups.map((g) => [g.id, g]));
  const objectivesById = new Map(data.objectives.map((o) => [o.id, o]));
  const keyResultsByObjective = new Map<string, GoalKeyResultJSON[]>();
  for (const kr of data.keyResults) {
    const list = keyResultsByObjective.get(kr.objectiveId) ?? [];
    list.push(kr);
    keyResultsByObjective.set(kr.objectiveId, list);
  }
  const childrenByParent = new Map<string, GoalObjectiveJSON[]>();
  for (const objective of data.objectives) {
    if (objective.parentId && objectivesById.has(objective.parentId)) {
      const list = childrenByParent.get(objective.parentId) ?? [];
      list.push(objective);
      childrenByParent.set(objective.parentId, list);
    }
  }
  return {
    data,
    usersById,
    groupsById,
    objectivesById,
    keyResultsByObjective,
    childrenByParent,
    elapsed: data.cycle ? cycleElapsed(data.cycle) : 0,
  };
}

/**
 * Loads the Goals overview for a cycle and keeps it fresh after changes.
 *
 * @param cycleId - the cycle to show, or undefined for the server's pick.
 * @returns the indexed data, loading and error state, and a refetch function.
 */
export function useGoals(cycleId: string | undefined) {
  const [index, setIndex] = React.useState<GoalsIndex | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const latest = React.useRef(0);

  const refetch = React.useCallback(async () => {
    const request = ++latest.current;
    try {
      const data = await goalsApi.overview(cycleId);
      if (request === latest.current) {
        setIndex(buildIndex(data));
        setError(null);
      }
    } catch (err) {
      if (request === latest.current) {
        setError(errToString(err));
      }
    }
  }, [cycleId]);

  React.useEffect(() => {
    void refetch();
  }, [refetch]);

  return { index, error, loading: !index && !error, refetch };
}
