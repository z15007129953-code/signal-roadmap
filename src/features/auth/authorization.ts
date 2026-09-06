import { domainError } from "@/lib/http/errors";
import { err, ok, type Result } from "@/lib/http/result";
import type { WorkspaceActor, WorkspaceRole } from "./actor";

type MaybeActor = WorkspaceActor | null | undefined;

function roleRank(role: unknown): number {
  switch (role) {
    case "member":
      return 0;
    case "moderator":
      return 1;
    case "owner":
      return 2;
    default:
      return -1;
  }
}

export function requireWorkspaceActor(
  actor: MaybeActor,
): Result<WorkspaceActor> {
  if (actor == null) return err(domainError("UNAUTHENTICATED"));
  if (roleRank(actor.role) < 0) return err(domainError("FORBIDDEN"));
  return ok(actor);
}

/** Check capability after requireWorkspace has established the target boundary. */
export function requireRole(
  actor: MaybeActor,
  role: WorkspaceRole,
): Result<WorkspaceActor> {
  const authenticated = requireWorkspaceActor(actor);
  if (!authenticated.ok) return authenticated;
  const requiredRank = roleRank(role);
  if (requiredRank < 0 || roleRank(authenticated.value.role) < requiredRank) {
    return err(domainError("FORBIDDEN"));
  }
  return authenticated;
}

/** Call for every target resource; an owner has no authority in other workspaces. */
export function requireWorkspace(
  actor: MaybeActor,
  workspaceId: string,
): Result<WorkspaceActor> {
  const authenticated = requireWorkspaceActor(actor);
  if (!authenticated.ok) return authenticated;
  if (!workspaceId || authenticated.value.workspaceId !== workspaceId) {
    return err(domainError("FORBIDDEN"));
  }
  return authenticated;
}

export function canModerate(actor: MaybeActor): boolean {
  return requireRole(actor, "moderator").ok;
}

export function canManageWorkspace(actor: MaybeActor): boolean {
  return requireRole(actor, "owner").ok;
}
