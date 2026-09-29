import { PluginManager, Hook } from "@server/utils/PluginManager";
import config from "../plugin.json";
// Registers the plugin's models with Sequelize before anything queries them.
import "./models";
import goals from "./api/goals";
import { GoalCheckInReminderEmail } from "./emails/GoalCheckInReminderEmail";
import { GoalCheckInReminderTask } from "./tasks/GoalCheckInReminderTask";

PluginManager.add([
  {
    ...config,
    type: Hook.API,
    value: goals,
  },
  {
    type: Hook.Task,
    value: GoalCheckInReminderTask,
  },
  {
    type: Hook.EmailTemplate,
    value: GoalCheckInReminderEmail,
  },
]);
