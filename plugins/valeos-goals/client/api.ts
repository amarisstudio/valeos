import { client } from "~/utils/ApiClient";
import type {
  GoalCheckInJSON,
  GoalCycleJSON,
  GoalKeyResultJSON,
  GoalLevel,
  GoalObjectiveJSON,
  GoalStatus,
  GoalUserJSON,
  GoalsOverviewJSON,
  KeyResultType,
} from "../shared/types";

type Data<T> = { data: T };

export type CycleInput = { name: string; startsAt: string; endsAt: string };

export type ObjectiveInput = {
  cycleId: string;
  level: GoalLevel;
  title: string;
  description?: string | null;
  ownerId?: string;
  groupId?: string | null;
  parentId?: string | null;
};

export type KeyResultInput = {
  objectiveId: string;
  title: string;
  type: KeyResultType;
  startValue?: number;
  targetValue?: number;
  unit?: string | null;
  ownerId?: string;
};

export type CheckInInput = {
  keyResultId: string;
  value: number;
  status: GoalStatus;
  note?: string | null;
};

/** Thin typed wrappers around the Goals API endpoints. */
export const goalsApi = {
  overview: async (cycleId?: string) =>
    (await client.post<Data<GoalsOverviewJSON>>("/goals.overview", { cycleId }))
      .data,

  createCycle: async (input: CycleInput) =>
    (await client.post<Data<GoalCycleJSON>>("/goalCycles.create", input)).data,
  updateCycle: async (id: string, input: Partial<CycleInput>) =>
    (
      await client.post<Data<GoalCycleJSON>>("/goalCycles.update", {
        id,
        ...input,
      })
    ).data,
  deleteCycle: async (id: string) => {
    await client.post("/goalCycles.delete", { id });
  },

  createObjective: async (input: ObjectiveInput) =>
    (
      await client.post<Data<GoalObjectiveJSON>>(
        "/goalObjectives.create",
        input
      )
    ).data,
  updateObjective: async (
    id: string,
    input: Partial<Omit<ObjectiveInput, "cycleId">>
  ) =>
    (
      await client.post<Data<GoalObjectiveJSON>>("/goalObjectives.update", {
        id,
        ...input,
      })
    ).data,
  deleteObjective: async (id: string) => {
    await client.post("/goalObjectives.delete", { id });
  },

  createKeyResult: async (input: KeyResultInput) =>
    (
      await client.post<Data<GoalKeyResultJSON>>(
        "/goalKeyResults.create",
        input
      )
    ).data,
  updateKeyResult: async (
    id: string,
    input: Partial<Omit<KeyResultInput, "objectiveId">>
  ) =>
    (
      await client.post<Data<GoalKeyResultJSON>>("/goalKeyResults.update", {
        id,
        ...input,
      })
    ).data,
  deleteKeyResult: async (id: string) => {
    await client.post("/goalKeyResults.delete", { id });
  },

  listCheckIns: async (keyResultId: string) => {
    const res = await client.post<
      Data<GoalCheckInJSON[]> & { users?: GoalUserJSON[] }
    >("/goalCheckIns.list", { keyResultId });
    return { checkIns: res.data, users: res.users ?? [] };
  },
  createCheckIn: async (input: CheckInInput) =>
    (await client.post<Data<GoalCheckInJSON>>("/goalCheckIns.create", input))
      .data,
  deleteCheckIn: async (id: string) => {
    await client.post("/goalCheckIns.delete", { id });
  },
};
