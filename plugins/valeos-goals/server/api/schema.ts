import { z } from "zod";
import { BaseSchema } from "@server/routes/api/schema";
import {
  GoalLevel,
  GoalStatus,
  GoalValidation,
  KeyResultType,
} from "../../shared/types";

const day = () =>
  z.iso.date({ error: "Must be a date in the format YYYY-MM-DD" });

const cycleName = z
  .string()
  .trim()
  .min(1, { error: "Required" })
  .max(GoalValidation.maxCycleNameLength, {
    error: `Must be ${GoalValidation.maxCycleNameLength} characters or less`,
  });

const title = z
  .string()
  .trim()
  .min(1, { error: "Required" })
  .max(GoalValidation.maxTitleLength, {
    error: `Must be ${GoalValidation.maxTitleLength} characters or less`,
  });

/** Optional long text where an empty string is stored as null. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `Must be ${max} characters or less` })
    .nullish()
    .transform((value) => (value === "" ? null : value));

const value = z.number({ error: "Must be a finite number" });

export const GoalsOverviewSchema = BaseSchema.extend({
  body: z.object({
    /** The cycle to show, defaults to the current one. */
    cycleId: z.uuid().nullish(),
  }),
});

export type GoalsOverviewReq = z.infer<typeof GoalsOverviewSchema>;

export const GoalCyclesCreateSchema = BaseSchema.extend({
  body: z.object({
    name: cycleName,
    startsAt: day(),
    endsAt: day(),
  }),
});

export type GoalCyclesCreateReq = z.infer<typeof GoalCyclesCreateSchema>;

export const GoalCyclesUpdateSchema = BaseSchema.extend({
  body: z.object({
    id: z.uuid(),
    name: cycleName.optional(),
    startsAt: day().optional(),
    endsAt: day().optional(),
  }),
});

export type GoalCyclesUpdateReq = z.infer<typeof GoalCyclesUpdateSchema>;

export const GoalCyclesDeleteSchema = BaseSchema.extend({
  body: z.object({
    id: z.uuid(),
  }),
});

export type GoalCyclesDeleteReq = z.infer<typeof GoalCyclesDeleteSchema>;

export const GoalObjectivesCreateSchema = BaseSchema.extend({
  body: z.object({
    cycleId: z.uuid(),
    level: z.enum(GoalLevel),
    title,
    description: optionalText(GoalValidation.maxDescriptionLength),
    /** Defaults to the acting user. */
    ownerId: z.uuid().optional(),
    groupId: z.uuid().nullish(),
    parentId: z.uuid().nullish(),
  }),
});

export type GoalObjectivesCreateReq = z.infer<
  typeof GoalObjectivesCreateSchema
>;

export const GoalObjectivesUpdateSchema = BaseSchema.extend({
  body: z.object({
    id: z.uuid(),
    cycleId: z.uuid().optional(),
    level: z.enum(GoalLevel).optional(),
    title: title.optional(),
    description: optionalText(GoalValidation.maxDescriptionLength),
    ownerId: z.uuid().optional(),
    groupId: z.uuid().nullish(),
    parentId: z.uuid().nullish(),
  }),
});

export type GoalObjectivesUpdateReq = z.infer<
  typeof GoalObjectivesUpdateSchema
>;

export const GoalObjectivesDeleteSchema = BaseSchema.extend({
  body: z.object({
    id: z.uuid(),
  }),
});

export type GoalObjectivesDeleteReq = z.infer<
  typeof GoalObjectivesDeleteSchema
>;

export const GoalKeyResultsCreateSchema = BaseSchema.extend({
  body: z.object({
    objectiveId: z.uuid(),
    title,
    type: z.enum(KeyResultType),
    startValue: value.optional(),
    targetValue: value.optional(),
    unit: optionalText(GoalValidation.maxUnitLength),
    /** Defaults to the acting user. */
    ownerId: z.uuid().optional(),
  }),
});

export type GoalKeyResultsCreateReq = z.infer<
  typeof GoalKeyResultsCreateSchema
>;

export const GoalKeyResultsUpdateSchema = BaseSchema.extend({
  body: z.object({
    id: z.uuid(),
    title: title.optional(),
    type: z.enum(KeyResultType).optional(),
    startValue: value.optional(),
    targetValue: value.optional(),
    unit: optionalText(GoalValidation.maxUnitLength),
    ownerId: z.uuid().optional(),
  }),
});

export type GoalKeyResultsUpdateReq = z.infer<
  typeof GoalKeyResultsUpdateSchema
>;

export const GoalKeyResultsDeleteSchema = BaseSchema.extend({
  body: z.object({
    id: z.uuid(),
  }),
});

export type GoalKeyResultsDeleteReq = z.infer<
  typeof GoalKeyResultsDeleteSchema
>;

export const GoalCheckInsListSchema = BaseSchema.extend({
  body: z.object({
    keyResultId: z.uuid(),
  }),
});

export type GoalCheckInsListReq = z.infer<typeof GoalCheckInsListSchema>;

export const GoalCheckInsCreateSchema = BaseSchema.extend({
  body: z.object({
    keyResultId: z.uuid(),
    value,
    status: z.enum(GoalStatus),
    note: optionalText(GoalValidation.maxNoteLength),
  }),
});

export type GoalCheckInsCreateReq = z.infer<typeof GoalCheckInsCreateSchema>;

export const GoalCheckInsDeleteSchema = BaseSchema.extend({
  body: z.object({
    id: z.uuid(),
  }),
});

export type GoalCheckInsDeleteReq = z.infer<typeof GoalCheckInsDeleteSchema>;
