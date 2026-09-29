import type { InferAttributes, InferCreationAttributes } from "sequelize";
import {
  AllowNull,
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  HasMany,
  IsIn,
  Table,
} from "sequelize-typescript";
import Group from "@server/models/Group";
import Team from "@server/models/Team";
import User from "@server/models/User";
import IdModel from "@server/models/base/IdModel";
import Length from "@server/models/validators/Length";
import { GoalLevel, GoalValidation } from "../../shared/types";
import GoalCycle from "./GoalCycle";
import GoalKeyResult from "./GoalKeyResult";

/** An objective at church, team or personal level within a cycle. */
@Table({ tableName: "goal_objectives", modelName: "goalObjective" })
class GoalObjective extends IdModel<
  InferAttributes<GoalObjective>,
  Partial<InferCreationAttributes<GoalObjective>>
> {
  @IsIn([Object.values(GoalLevel)])
  @Column(DataType.STRING)
  level: GoalLevel;

  @Length({
    min: 1,
    max: GoalValidation.maxTitleLength,
    msg: `title must be between 1 and ${GoalValidation.maxTitleLength} characters`,
  })
  @Column(DataType.STRING)
  title: string;

  @AllowNull
  @Length({
    max: GoalValidation.maxDescriptionLength,
    msg: `description must be ${GoalValidation.maxDescriptionLength} characters or less`,
  })
  @Column(DataType.TEXT)
  description: string | null;

  // associations

  @BelongsTo(() => GoalCycle, "cycleId")
  cycle: GoalCycle;

  @ForeignKey(() => GoalCycle)
  @Column(DataType.UUID)
  cycleId: string;

  @BelongsTo(() => User, "ownerId")
  owner: User;

  @ForeignKey(() => User)
  @Column(DataType.UUID)
  ownerId: string;

  @BelongsTo(() => Group, "groupId")
  group: Group | null;

  @AllowNull
  @ForeignKey(() => Group)
  @Column(DataType.UUID)
  groupId: string | null;

  @BelongsTo(() => GoalObjective, "parentId")
  parent: GoalObjective | null;

  @AllowNull
  @ForeignKey(() => GoalObjective)
  @Column(DataType.UUID)
  parentId: string | null;

  @HasMany(() => GoalKeyResult, "objectiveId")
  keyResults: GoalKeyResult[];

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

export default GoalObjective;
