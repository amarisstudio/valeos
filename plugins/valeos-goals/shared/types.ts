/** The level an objective sits at. Alignment always points to a higher level. */
export enum GoalLevel {
  Church = "church",
  Team = "team",
  Personal = "personal",
}

/** How a key result is tracking, set by the latest check-in. */
export enum GoalStatus {
  OnTrack = "on_track",
  AtRisk = "at_risk",
  OffTrack = "off_track",
}

/** A metric moves between two numbers; a milestone is either done or not. */
export enum KeyResultType {
  Metric = "metric",
  Milestone = "milestone",
}

/** Levels ordered from highest to lowest. */
export const GoalLevelOrder = [
  GoalLevel.Church,
  GoalLevel.Team,
  GoalLevel.Personal,
] as const;

/** Statuses ordered from worst to best, used to pick an objective's status. */
export const GoalStatusSeverity = [
  GoalStatus.OffTrack,
  GoalStatus.AtRisk,
  GoalStatus.OnTrack,
] as const;

export const GoalValidation = {
  maxCycleNameLength: 100,
  maxTitleLength: 255,
  maxDescriptionLength: 2000,
  maxNoteLength: 2000,
  maxUnitLength: 20,
  /**
   * Days without a check-in before a key result counts as waiting for one.
   * Six, so last Monday's check-in is due again by this Monday's reminder.
   */
  staleAfterDays: 6,
};

export type GoalCycleJSON = {
  id: string;
  name: string;
  /** Calendar date, YYYY-MM-DD. */
  startsAt: string;
  /** Calendar date, YYYY-MM-DD, inclusive. */
  endsAt: string;
  createdAt: string;
  updatedAt: string;
  abilities: { update: boolean; delete: boolean };
};

export type GoalUserJSON = {
  id: string;
  name: string;
  avatarUrl: string | null;
  color: string;
};

export type GoalGroupJSON = {
  id: string;
  name: string;
};

export type GoalObjectiveJSON = {
  id: string;
  cycleId: string;
  level: GoalLevel;
  title: string;
  description: string | null;
  ownerId: string;
  groupId: string | null;
  parentId: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  /** 0 to 1, the mean of its key results. */
  progress: number;
  /** The worst status among its key results, null when none have checked in. */
  status: GoalStatus | null;
  abilities: { update: boolean; delete: boolean; createKeyResult: boolean };
};

export type GoalKeyResultJSON = {
  id: string;
  objectiveId: string;
  title: string;
  type: KeyResultType;
  startValue: number;
  targetValue: number;
  currentValue: number;
  unit: string | null;
  ownerId: string;
  status: GoalStatus | null;
  lastCheckInAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** 0 to 1. */
  progress: number;
  abilities: { update: boolean; delete: boolean; checkIn: boolean };
};

export type GoalCheckInJSON = {
  id: string;
  keyResultId: string;
  userId: string;
  value: number;
  status: GoalStatus;
  note: string | null;
  createdAt: string;
  abilities: { delete: boolean };
};

export type GoalsOverviewJSON = {
  /** Every cycle in the workspace, newest start date first. */
  cycles: GoalCycleJSON[];
  /** The cycle being shown, null when there are no cycles. */
  cycle: GoalCycleJSON | null;
  objectives: GoalObjectiveJSON[];
  keyResults: GoalKeyResultJSON[];
  /** Every active non-guest member, for owner pickers and display. */
  users: GoalUserJSON[];
  /** Every group in the workspace, for team pickers and grouping. */
  groups: GoalGroupJSON[];
  abilities: {
    createCycle: boolean;
    createObjective: Record<GoalLevel, boolean>;
  };
};
