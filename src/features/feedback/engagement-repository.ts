import { and, asc, count, eq, gt, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/lib/db";
import { comments, follows, members, votes } from "@/lib/db/schema";
import { domainError } from "@/lib/http/errors";
import { err, ok } from "@/lib/http/result";
import { demoQuota } from "../auth/demo-session";
import { fanoutFeedbackNotification } from "../notifications/notification-fanout";
import {
  engagementFeedbackAccess,
  isEngagementModerator,
  type EngagementAccess,
  type EngagementExecutor,
} from "./engagement-access";
import {
  commentEditSchema,
  commentInputSchema,
  engagementPageSchema,
} from "./engagement-schema";
import { decodeCursor, encodeCursor } from "./feedback-schema";
import type { CommentItem, EngagementRepository } from "./engagement-types";
import type { FeedbackActor } from "./types";

const commentColumns = {
  id: comments.id,
  body: comments.body,
  authorId: comments.authorId,
  parentId: comments.parentId,
  createdAt: comments.createdAt,
  updatedAt: comments.updatedAt,
  deletedAt: comments.deletedAt,
};
function present(
  row:
    | typeof comments.$inferSelect
    | Omit<CommentItem, "canEdit" | "canDelete" | "authorName">,
  authorName: string,
  access: EngagementAccess,
): CommentItem {
  return {
    id: row.id,
    authorId: row.authorId,
    parentId: row.parentId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
    body: row.deletedAt ? "" : row.body,
    authorName,
    canEdit: !row.deletedAt && row.authorId === access.memberId,
    canDelete:
      !row.deletedAt &&
      (row.authorId === access.memberId || isEngagementModerator(access.role)),
  };
}
async function state(
  db: EngagementExecutor,
  workspaceId: string,
  feedbackId: string,
  memberId: string | null,
) {
  // One PostgreSQL statement gives all fields the same MVCC snapshot.
  const [snapshot] = await db
    .select({
      voteCount: count(),
      voted: sql<boolean>`coalesce(bool_or(${votes.memberId} = ${memberId}::uuid), false)`,
      following: sql<boolean>`exists (
        select 1 from ${follows}
        where ${follows.workspaceId} = ${workspaceId}::uuid
          and ${follows.feedbackId} = ${feedbackId}::uuid
          and ${follows.memberId} = ${memberId}::uuid
      )`,
    })
    .from(votes)
    .where(
      and(eq(votes.workspaceId, workspaceId), eq(votes.feedbackId, feedbackId)),
    );
  return snapshot;
}
export function createEngagementRepository(db: Database): EngagementRepository {
  async function set(
    table: typeof votes | typeof follows,
    actor: FeedbackActor,
    workspaceId: string,
    feedbackId: string,
    active: boolean,
  ) {
    if (typeof active !== "boolean")
      return err(domainError("VALIDATION_FAILED"));
    return db.transaction(async (tx) => {
      const allowed = await engagementFeedbackAccess(
        tx,
        actor,
        workspaceId,
        feedbackId,
        true,
      );
      if (!allowed.ok) return allowed;
      const memberId = allowed.value.memberId!;
      if (active)
        await tx
          .insert(table)
          .values({ workspaceId, feedbackId, memberId })
          .onConflictDoNothing();
      else
        await tx
          .delete(table)
          .where(
            and(
              eq(table.workspaceId, workspaceId),
              eq(table.feedbackId, feedbackId),
              eq(table.memberId, memberId),
            ),
          );
      return ok(await state(tx, workspaceId, feedbackId, memberId));
    });
  }
  async function modify(
    actor: FeedbackActor,
    workspaceId: string,
    feedbackId: string,
    commentId: string,
    input: { body: string } | null,
  ) {
    if (!z.uuid().safeParse(commentId).success)
      return err(domainError("VALIDATION_FAILED"));
    const parsed = input === null ? null : commentEditSchema.safeParse(input);
    if (parsed && !parsed.success) return err(domainError("VALIDATION_FAILED"));
    return db.transaction(async (tx) => {
      const allowed = await engagementFeedbackAccess(
        tx,
        actor,
        workspaceId,
        feedbackId,
        true,
      );
      if (!allowed.ok) return allowed;
      const scope = and(
        eq(comments.workspaceId, workspaceId),
        eq(comments.feedbackId, feedbackId),
        eq(comments.id, commentId),
        eq(comments.isInternal, false),
      );
      const [item] = await tx
        .select(commentColumns)
        .from(comments)
        .where(scope)
        .for("update");
      if (!item) return err(domainError("NOT_FOUND"));
      const own = item.authorId === allowed.value.memberId;
      if (
        !own &&
        (input !== null || !isEngagementModerator(allowed.value.role))
      )
        return err(domainError("FORBIDDEN"));
      if (item.deletedAt && input !== null) return err(domainError("CONFLICT"));
      const [updated] = item.deletedAt
        ? [item]
        : await tx
            .update(comments)
            .set(
              input === null
                ? { body: "", deletedAt: new Date() }
                : { body: parsed!.data!.body },
            )
            .where(scope)
            .returning(commentColumns);
      const [author] = await tx
        .select({ name: members.displayName })
        .from(members)
        .where(
          and(
            eq(members.workspaceId, workspaceId),
            eq(members.id, item.authorId),
          ),
        );
      return ok(present(updated, author.name, allowed.value));
    });
  }
  return {
    async state(actor, workspaceId, feedbackId) {
      const allowed = await engagementFeedbackAccess(
        db,
        actor,
        workspaceId,
        feedbackId,
      );
      return allowed.ok
        ? ok(await state(db, workspaceId, feedbackId, allowed.value.memberId))
        : allowed;
    },
    setVote: (actor, workspaceId, feedbackId, active) =>
      set(votes, actor, workspaceId, feedbackId, active),
    setFollow: (actor, workspaceId, feedbackId, active) =>
      set(follows, actor, workspaceId, feedbackId, active),
    async listComments(actor, workspaceId, feedbackId, input) {
      const parsed = engagementPageSchema.safeParse(input);
      if (!parsed.success) return err(domainError("VALIDATION_FAILED"));
      const allowed = await engagementFeedbackAccess(
        db,
        actor,
        workspaceId,
        feedbackId,
      );
      if (!allowed.ok) return allowed;
      const cursor = parsed.data.cursor
        ? decodeCursor(parsed.data.cursor)
        : null;
      const rows = await db
        .select({
          ...commentColumns,
          authorName: members.displayName,
          cursorTime: sql<string>`to_char(${comments.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
        })
        .from(comments)
        .innerJoin(
          members,
          and(
            eq(members.workspaceId, comments.workspaceId),
            eq(members.id, comments.authorId),
          ),
        )
        .where(
          and(
            eq(comments.workspaceId, workspaceId),
            eq(comments.feedbackId, feedbackId),
            eq(comments.isInternal, false),
            cursor
              ? or(
                  sql`${comments.createdAt} > ${cursor.createdAt}::timestamptz`,
                  and(
                    sql`${comments.createdAt} = ${cursor.createdAt}::timestamptz`,
                    gt(comments.id, cursor.id),
                  ),
                )
              : undefined,
          ),
        )
        .orderBy(asc(comments.createdAt), asc(comments.id))
        .limit(parsed.data.limit + 1);
      const page = rows.slice(0, parsed.data.limit),
        last = page.at(-1);
      return ok({
        items: page.map((row) => present(row, row.authorName, allowed.value)),
        nextCursor:
          rows.length > parsed.data.limit && last
            ? encodeCursor({ createdAt: last.cursorTime, id: last.id })
            : null,
      });
    },
    async createComment(actor, workspaceId, feedbackId, input) {
      const parsed = commentInputSchema.safeParse(input);
      if (!parsed.success) return err(domainError("VALIDATION_FAILED"));
      return db.transaction(async (tx) => {
        const allowed = await engagementFeedbackAccess(
          tx,
          actor,
          workspaceId,
          feedbackId,
          true,
        );
        if (!allowed.ok) return allowed;
        if (parsed.data.parentId) {
          const [parent] = await tx
            .select({ id: comments.id })
            .from(comments)
            .where(
              and(
                eq(comments.id, parsed.data.parentId),
                eq(comments.workspaceId, workspaceId),
                eq(comments.feedbackId, feedbackId),
                eq(comments.isInternal, false),
              ),
            )
            .for("share");
          if (!parent) return err(domainError("VALIDATION_FAILED"));
        }
        if (allowed.value.isDemo) {
          const [usage] = await tx
            .select({ total: count() })
            .from(comments)
            .where(eq(comments.workspaceId, workspaceId));
          if (usage.total >= demoQuota.comments)
            return err(domainError("DEMO_QUOTA_EXCEEDED"));
        }
        const [item] = await tx
          .insert(comments)
          .values({
            workspaceId,
            feedbackId,
            authorId: allowed.value.memberId!,
            body: parsed.data.body,
            parentId: parsed.data.parentId,
          })
          .returning(commentColumns);
        if (allowed.value.item.visibility === "published")
          await fanoutFeedbackNotification(tx, {
            workspaceId,
            feedbackId,
            actorId: allowed.value.memberId!,
            eventKey: `comment:${item.id}`,
            type: "comment_added",
            title: allowed.value.item.title,
            body: "A new comment was added.",
          });
        const [author] = await tx
          .select({ name: members.displayName })
          .from(members)
          .where(
            and(
              eq(members.workspaceId, workspaceId),
              eq(members.id, item.authorId),
            ),
          );
        return ok(present(item, author.name, allowed.value));
      });
    },
    async editComment(actor, workspaceId, feedbackId, commentId, input) {
      const parsed = commentEditSchema.safeParse(input);
      return parsed.success
        ? modify(actor, workspaceId, feedbackId, commentId, parsed.data)
        : err(domainError("VALIDATION_FAILED"));
    },
    deleteComment: (actor, workspaceId, feedbackId, commentId) =>
      modify(actor, workspaceId, feedbackId, commentId, null),
  };
}
