import type { InferAttributes, InferCreationAttributes } from "sequelize";
import {
  AllowNull,
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  IsIn,
  Table,
} from "sequelize-typescript";
import Team from "@server/models/Team";
import User from "@server/models/User";
import IdModel from "@server/models/base/IdModel";
import Length from "@server/models/validators/Length";
import { GoalStatus, GoalValidation } from "../../shared/types";
import GoalKeyResult from "./GoalKeyResult";

/** A point-in-time update on a key result's value and status. */
@Table({ tableName: "goal_check_ins", modelName: "goalCheckIn" })
class GoalCheckIn extends IdModel<
  InferAttributes<GoalCheckIn>,
  Partial<InferCreationAttributes<GoalCheckIn>>
> {
  @Column(DataType.DOUBLE)
  value: number;

  @IsIn([Object.values(GoalStatus)])
  @Column(DataType.STRING)
  status: GoalStatus;

  @AllowNull
  @Length({
    max: GoalValidation.maxNoteLength,
    msg: `note must be ${GoalValidation.maxNoteLength} characters or less`,
  })
  @Column(DataType.TEXT)
  note: string | null;

  // associations

  @BelongsTo(() => GoalKeyResult, "keyResultId")
  keyResult: GoalKeyResult;

  @ForeignKey(() => GoalKeyResult)
  @Column(DataType.UUID)
  keyResultId: string;

  /** The author of the check-in. */
  @BelongsTo(() => User, "userId")
  user: User;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  userId: string;

  @BelongsTo(() => Team, "teamId")
  team: Team;

  @ForeignKey(() => Team)
  @Column(DataType.UUID)
  teamId: string;
}

export default GoalCheckIn;
