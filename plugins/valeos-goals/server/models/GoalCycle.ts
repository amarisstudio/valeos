import type { InferAttributes, InferCreationAttributes } from "sequelize";
import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  HasMany,
  Table,
} from "sequelize-typescript";
import Team from "@server/models/Team";
import User from "@server/models/User";
import IdModel from "@server/models/base/IdModel";
import Length from "@server/models/validators/Length";
import { GoalValidation } from "../../shared/types";
import GoalObjective from "./GoalObjective";

/** A period of time, such as a school term, that objectives are set for. */
@Table({ tableName: "goal_cycles", modelName: "goalCycle" })
class GoalCycle extends IdModel<
  InferAttributes<GoalCycle>,
  Partial<InferCreationAttributes<GoalCycle>>
> {
  @Length({
    min: 1,
    max: GoalValidation.maxCycleNameLength,
    msg: `name must be between 1 and ${GoalValidation.maxCycleNameLength} characters`,
  })
  @Column(DataType.STRING)
  name: string;

  /** First day of the cycle, YYYY-MM-DD. */
  @Column(DataType.DATEONLY)
  startsAt: string;

  /** Last day of the cycle, YYYY-MM-DD, inclusive. */
  @Column(DataType.DATEONLY)
  endsAt: string;

  // associations

  @HasMany(() => GoalObjective, "cycleId")
  objectives: GoalObjective[];

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

export default GoalCycle;
