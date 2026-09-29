import type { InferAttributes, InferCreationAttributes } from "sequelize";
import {
  AllowNull,
  BelongsTo,
  Column,
  DataType,
  Default,
  ForeignKey,
  HasMany,
  IsDate,
  IsIn,
  Table,
} from "sequelize-typescript";
import Team from "@server/models/Team";
import User from "@server/models/User";
import IdModel from "@server/models/base/IdModel";
import Length from "@server/models/validators/Length";
import { GoalStatus, GoalValidation, KeyResultType } from "../../shared/types";
import GoalCheckIn from "./GoalCheckIn";
import GoalObjective from "./GoalObjective";

/** A measurable result that shows progress towards an objective. */
@Table({ tableName: "goal_key_results", modelName: "goalKeyResult" })
class GoalKeyResult extends IdModel<
  InferAttributes<GoalKeyResult>,
  Partial<InferCreationAttributes<GoalKeyResult>>
> {
  @Length({
    min: 1,
    max: GoalValidation.maxTitleLength,
    msg: `title must be between 1 and ${GoalValidation.maxTitleLength} characters`,
  })
  @Column(DataType.STRING)
  title: string;

  @IsIn([Object.values(KeyResultType)])
  @Column(DataType.STRING)
  type: KeyResultType;

  @Default(0)
  @Column(DataType.DOUBLE)
  startValue: number;

  @Column(DataType.DOUBLE)
  targetValue: number;

  @Default(0)
  @Column(DataType.DOUBLE)
  currentValue: number;

  @AllowNull
  @Length({
    max: GoalValidation.maxUnitLength,
    msg: `unit must be ${GoalValidation.maxUnitLength} characters or less`,
  })
  @Column(DataType.STRING)
  unit: string | null;

  /** Copied from the latest check-in, null until the first one. */
  @AllowNull
  @IsIn([Object.values(GoalStatus)])
  @Column(DataType.STRING)
  status: GoalStatus | null;

  @AllowNull
  @IsDate
  @Column(DataType.DATE)
  lastCheckInAt: Date | null;

  // associations

  @BelongsTo(() => GoalObjective, "objectiveId")
  objective: GoalObjective;

  @ForeignKey(() => GoalObjective)
  @Column(DataType.UUID)
  objectiveId: string;

  @HasMany(() => GoalCheckIn, "keyResultId")
  checkIns: GoalCheckIn[];

  @BelongsTo(() => User, "ownerId")
  owner: User;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  ownerId: string;

  @BelongsTo(() => Team, "teamId")
  team: Team;

  @ForeignKey(() => Team)
  @Column(DataType.UUID)
  teamId: string;

  @BelongsTo(() => User, "createdById")
  createdBy: User;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  createdById: string;
}

export default GoalKeyResult;
