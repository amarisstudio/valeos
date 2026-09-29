import { AuthorizationError } from "@server/errors";
import type { User } from "@server/models";
import { GoalLevel } from "../shared/types";

/** The parts of a user the permission checks look at. */
type Actor = Pick<User, "id" | "teamId" | "isAdmin" | "isMember" | "isGuest">;

type OwnedObjective = { teamId: string; ownerId: string; createdById: string };
type OwnedKeyResult = { teamId: string; ownerId: string };
type AuthoredCheckIn = { teamId: string; userId: string };

/**
 * Throws an authorization error unless the check passed.
 *
 * @param allowed - the result of a permission check.
 * @param message - optional message for the error.
 */
export function authorize(
  allowed: boolean,
  message = "You do not have permission to do that"
): asserts allowed {
  if (!allowed) {
    throw AuthorizationError(message);
  }
}

const sameTeam = (user: Actor, model: { teamId: string }) =>
  user.teamId === model.teamId;

/** Admins and members (editors) can create and edit goals they are part of. */
const isEditor = (user: Actor) => user.isAdmin || user.isMember;

/**
 * Whether the user can see goals at all. Guests never can.
 *
 * @param user - the acting user.
 * @returns true for admins, members and viewers.
 */
export function canReadGoals(user: Actor): boolean {
  return !user.isGuest;
}

/**
 * Whether the user can create, edit and delete cycles.
 *
 * @param user - the acting user.
 * @returns true for admins.
 */
export function canManageCycles(user: Actor): boolean {
  return user.isAdmin;
}

/**
 * Whether the user can create an objective at a level for an owner. Church
 * objectives are admin only; members create team objectives and personal
 * objectives they own themselves.
 *
 * @param user - the acting user.
 * @param level - the objective's level.
 * @param ownerId - the intended owner, defaults to the acting user.
 * @returns true when allowed.
 */
export function canCreateObjective(
  user: Actor,
  level: GoalLevel,
  ownerId: string = user.id
): boolean {
  if (user.isAdmin) {
    return true;
  }
  if (!user.isMember) {
    return false;
  }
  switch (level) {
    case GoalLevel.Church:
      return false;
    case GoalLevel.Team:
      return true;
    case GoalLevel.Personal:
      return ownerId === user.id;
    default:
      return false;
  }
}

/**
 * Whether the user can edit an objective and add key results to it.
 *
 * @param user - the acting user.
 * @param objective - the objective.
 * @returns true for admins and for members who own or created it.
 */
export function canUpdateObjective(
  user: Actor,
  objective: OwnedObjective
): boolean {
  if (!sameTeam(user, objective) || !isEditor(user)) {
    return false;
  }
  return (
    user.isAdmin ||
    objective.ownerId === user.id ||
    objective.createdById === user.id
  );
}

/**
 * Whether the user can delete an objective.
 *
 * @param user - the acting user.
 * @param objective - the objective.
 * @returns true for admins and for members who own or created it.
 */
export function canDeleteObjective(
  user: Actor,
  objective: OwnedObjective
): boolean {
  return canUpdateObjective(user, objective);
}

/**
 * Whether the user can add a key result to an objective.
 *
 * @param user - the acting user.
 * @param objective - the objective.
 * @returns true for admins and for members who own or created it.
 */
export function canCreateKeyResult(
  user: Actor,
  objective: OwnedObjective
): boolean {
  return canUpdateObjective(user, objective);
}

/**
 * Whether the user can edit a key result.
 *
 * @param user - the acting user.
 * @param keyResult - the key result.
 * @param objective - the objective it belongs to.
 * @returns true for those who can edit the objective, and members who own it.
 */
export function canUpdateKeyResult(
  user: Actor,
  keyResult: OwnedKeyResult,
  objective: OwnedObjective
): boolean {
  if (!sameTeam(user, keyResult)) {
    return false;
  }
  return (
    canUpdateObjective(user, objective) ||
    (isEditor(user) && keyResult.ownerId === user.id)
  );
}

/**
 * Whether the user can delete a key result.
 *
 * @param user - the acting user.
 * @param keyResult - the key result.
 * @param objective - the objective it belongs to.
 * @returns true for admins and the objective's owner or creator.
 */
export function canDeleteKeyResult(
  user: Actor,
  keyResult: OwnedKeyResult,
  objective: OwnedObjective
): boolean {
  return sameTeam(user, keyResult) && canUpdateObjective(user, objective);
}

/**
 * Whether the user can post a check-in on a key result. Viewers can check in
 * on key results they own, but nothing else.
 *
 * @param user - the acting user.
 * @param keyResult - the key result.
 * @param objective - the objective it belongs to.
 * @returns true for admins, the key result's owner and the objective's owner.
 */
export function canCheckIn(
  user: Actor,
  keyResult: OwnedKeyResult,
  objective: OwnedObjective
): boolean {
  if (!sameTeam(user, keyResult) || !canReadGoals(user)) {
    return false;
  }
  if (user.isAdmin || keyResult.ownerId === user.id) {
    return true;
  }
  return isEditor(user) && objective.ownerId === user.id;
}

/**
 * Whether the user can delete a check-in.
 *
 * @param user - the acting user.
 * @param checkIn - the check-in.
 * @returns true for admins and the check-in's author.
 */
export function canDeleteCheckIn(
  user: Actor,
  checkIn: AuthoredCheckIn
): boolean {
  if (!sameTeam(user, checkIn) || !canReadGoals(user)) {
    return false;
  }
  return user.isAdmin || checkIn.userId === user.id;
}
