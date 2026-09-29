import { Avatar, AvatarSize } from "~/components/Avatar";
import type { Option } from "~/components/InputSelect";
import type { GoalUserJSON } from "../../shared/types";

/**
 * Builds owner picker options with avatars, sorted by name.
 *
 * @param users - the workspace members.
 * @returns select options.
 */
export function userOptions(users: GoalUserJSON[]): Option[] {
  return [...users]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((user) => ({
      type: "item",
      label: user.name,
      value: user.id,
      icon: (
        <Avatar model={user} size={AvatarSize.Small} showHoverCard={false} />
      ),
    }));
}
