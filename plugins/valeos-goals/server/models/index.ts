import { sequelize } from "@server/storage/database";
import GoalCheckIn from "./GoalCheckIn";
import GoalCycle from "./GoalCycle";
import GoalKeyResult from "./GoalKeyResult";
import GoalObjective from "./GoalObjective";

// Core models are registered when the Sequelize instance is created and there
// is no plugin hook for models, so the plugin adds its own to the same
// instance when this module is first loaded. Associations to core models
// (User, Team, Group) resolve here because those are already registered.
sequelize.addModels([GoalCycle, GoalObjective, GoalKeyResult, GoalCheckIn]);

export { GoalCycle, GoalObjective, GoalKeyResult, GoalCheckIn };
