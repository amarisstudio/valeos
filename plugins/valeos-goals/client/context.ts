import * as React from "react";
import type {
  GoalKeyResultJSON,
  GoalLevel,
  GoalObjectiveJSON,
} from "../shared/types";
import type { GoalsIndex } from "./useGoals";

export interface GoalsActions {
  index: GoalsIndex;
  currentUserId: string;
  refetch: () => Promise<void>;
  openCheckIn: (keyResult: GoalKeyResultJSON) => void;
  openAddKeyResult: (objective: GoalObjectiveJSON) => void;
  openEditKeyResult: (keyResult: GoalKeyResultJSON) => void;
  deleteKeyResult: (keyResult: GoalKeyResultJSON) => void;
  openNewObjective: (level?: GoalLevel, groupId?: string) => void;
  openEditObjective: (objective: GoalObjectiveJSON) => void;
  deleteObjective: (objective: GoalObjectiveJSON) => void;
  /** A link to an objective in the view where it lives. */
  objectiveLink: (objective: GoalObjectiveJSON) => string;
}

export const GoalsContext = React.createContext<GoalsActions | null>(null);

/**
 * Reads the Goals page actions and data.
 *
 * @returns the actions provided by the Goals scene.
 * @throws if used outside the Goals scene.
 */
export function useGoalsContext(): GoalsActions {
  const value = React.useContext(GoalsContext);
  if (!value) {
    throw new Error("useGoalsContext must be used inside the Goals scene");
  }
  return value;
}
