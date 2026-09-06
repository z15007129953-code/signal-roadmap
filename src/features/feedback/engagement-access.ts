import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/lib/db";
import { demoSessions, feedback, members, workspaces } from "@/lib/db/schema";
import { domainError } from "@/lib/http/errors";
import { err, ok, type Result } from "@/lib/http/result";
import type { WorkspaceRole } from "../auth/actor";
import type { FeedbackActor } from "./types";

export type EngagementTransaction = Parameters<
  Parameters<Database["transaction"]>[0]
>[0];
export type EngagementExecutor = Database | EngagementTransaction;
export type EngagementAccess = {
  isDemo: boolean;
  role: WorkspaceRole | null;
  memberId: string | null;
};
export const isEngagementModerator = (role: WorkspaceRole | null) =>
  role === "moderator" || role === "owner";
/** Persisted membership is authoritative; locks always begin with the workspace. */
export async function engagementAccess(
  db: EngagementExecutor,
  actor: FeedbackActor,
  workspaceId: string,
  write = false,
  privateRead = false,
): Promise<Result<EngagementAccess>> {
  if (!z.uuid().safeParse(workspaceId).success)
    return err(domainError("VALIDATION_FAILED"));
  if (actor && actor.workspaceId !== workspaceId)
    return err(domainError("FORBIDDEN"));
  const workspaceQuery = db
    .select({ isDemo: workspaces.isDemo })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId));
  const [workspace] = write
    ? await workspaceQuery.for("update")
    : await workspaceQuery;
  if (!workspace) return err(domainError("NOT_FOUND"));
  if (!actor)
    return write || privateRead || workspace.isDemo
      ? err(domainError("UNAUTHENTICATED"))
      : ok({ isDemo: false, role: null, memberId: null });
  if (!z.uuid().safeParse(actor.memberId).success)
    return err(domainError("FORBIDDEN"));
  const identity =
    actor.kind === "account"
      ? and(eq(members.userId, actor.userId), isNull(members.demoSessionId))
      : and(isNull(members.userId), eq(workspaces.isDemo, true));
  const memberQuery = db
    .select({ role: members.role, demoSessionId: members.demoSessionId })
    .from(members)
    .innerJoin(workspaces, eq(workspaces.id, members.workspaceId))
    .where(
      and(
        eq(members.id, actor.memberId),
        eq(members.workspaceId, workspaceId),
        identity,
      ),
    );
  const [member] = write
    ? await memberQuery.for("share", { of: members })
    : await memberQuery;
  if (!member) return err(domainError("FORBIDDEN"));
  if (workspace.isDemo || actor.kind === "demo") {
    if (actor.kind !== "demo" || !member.demoSessionId)
      return err(domainError("FORBIDDEN"));
    const sessionQuery = db
      .select({ id: demoSessions.id })
      .from(demoSessions)
      .where(
        and(
          eq(demoSessions.id, member.demoSessionId),
          eq(demoSessions.workspaceId, workspaceId),
          gt(demoSessions.expiresAt, sql`clock_timestamp()`),
        ),
      );
    const [session] = write
      ? await sessionQuery.for("share")
      : await sessionQuery;
    if (!session) return err(domainError("DEMO_EXPIRED"));
  }
  return ok({
    isDemo: workspace.isDemo,
    role: member.role,
    memberId: actor.memberId,
  });
}
export async function engagementFeedbackAccess(
  db: EngagementExecutor,
  actor: FeedbackActor,
  workspaceId: string,
  feedbackId: string,
  write = false,
) {
  if (!z.uuid().safeParse(feedbackId).success)
    return err(domainError("VALIDATION_FAILED"));
  const allowed = await engagementAccess(db, actor, workspaceId, write);
  if (!allowed.ok) return allowed;
  const query = db
    .select({
      id: feedback.id,
      title: feedback.title,
      visibility: feedback.visibility,
      authorId: feedback.authorId,
    })
    .from(feedback)
    .where(
      and(eq(feedback.workspaceId, workspaceId), eq(feedback.id, feedbackId)),
    );
  const [item] = write ? await query.for("update") : await query;
  if (
    !item ||
    item.visibility === "merged" ||
    (write && item.visibility !== "published") ||
    (item.visibility === "pending" &&
      !isEngagementModerator(allowed.value.role) &&
      item.authorId !== allowed.value.memberId)
  )
    return err(domainError("NOT_FOUND"));
  return ok({ ...allowed.value, item });
}
