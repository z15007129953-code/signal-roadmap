import { and, asc, eq, gt, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/lib/db";
import {
  activity,
  boards,
  comments,
  demoSessions,
  feedback,
  feedbackRedirects,
  feedbackTags,
  follows,
  members,
  notifications,
  tags,
  votes,
} from "@/lib/db/schema";
import { domainError } from "@/lib/http/errors";
import { err, ok, type Result } from "@/lib/http/result";
import { fanoutFeedbackNotification } from "../notifications/notification-fanout";
import {
  engagementAccess,
  engagementFeedbackAccess,
  isEngagementModerator,
  type EngagementTransaction,
} from "./engagement-access";
import { decodeCursor, encodeCursor } from "./feedback-schema";
import {
  moderationHistorySchema,
  moderationMergeSchema,
  moderationSlugSchema,
  moderationStatusSchema,
  moderationTaxonomySchema,
} from "./moderation-schema";
import type { ModerationRepository } from "./moderation-types";
import type { FeedbackActor, FeedbackItem } from "./types";

const scope = (w: string, id: string) =>
  and(eq(feedback.workspaceId, w), eq(feedback.id, id));
const validId = (id: string) => z.uuid().safeParse(id).success;
const invalid = () => err(domainError("VALIDATION_FAILED"));
const conflict = () => err(domainError("CONFLICT"));
function transactionConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: string; cause?: unknown };
  return (
    value.code === "40001" ||
    value.code === "40P01" ||
    (!!value.cause && transactionConflict(value.cause))
  );
}
async function moderatorAccess(
  tx: EngagementTransaction,
  actor: FeedbackActor,
  w: string,
  write: boolean,
) {
  const allowed = await engagementAccess(tx, actor, w, write, true);
  if (!allowed.ok) return allowed;
  return isEngagementModerator(allowed.value.role)
    ? allowed
    : err(domainError("FORBIDDEN"));
}
async function record(
  tx: EngagementTransaction,
  w: string,
  actorId: string,
  id: string,
  action: string,
  metadata: Record<string, unknown> = {},
) {
  const [event] = await tx
    .insert(activity)
    .values({ workspaceId: w, actorId, feedbackId: id, action, metadata })
    .returning({ id: activity.id });
  return event.id;
}
export function createModerationRepository(db: Database): ModerationRepository {
  async function transaction<T>(
    fn: (tx: EngagementTransaction) => Promise<Result<T>>,
  ): Promise<Result<T>> {
    try {
      return await db.transaction(fn, { isolationLevel: "serializable" });
    } catch (error) {
      if (transactionConflict(error)) return conflict();
      throw error;
    }
  }
  async function change(
    actor: FeedbackActor,
    w: string,
    id: string,
    operation: (
      tx: EngagementTransaction,
      item: typeof feedback.$inferSelect,
      actorId: string,
    ) => Promise<Result<FeedbackItem>>,
  ) {
    if (!validId(id)) return invalid();
    return transaction(async (tx) => {
      const allowed = await moderatorAccess(tx, actor, w, true);
      if (!allowed.ok) return allowed;
      const [item] = await tx
        .select()
        .from(feedback)
        .where(scope(w, id))
        .for("update");
      if (!item) return err(domainError("NOT_FOUND"));
      if (item.visibility === "merged") return conflict();
      return operation(tx, item, allowed.value.memberId!);
    });
  }
  return {
    approve: (actor, w, id) =>
      change(actor, w, id, async (tx, item, actorId) => {
        if (item.visibility !== "pending") return conflict();
        const [updated] = await tx
          .update(feedback)
          .set({ visibility: "published" })
          .where(scope(w, id))
          .returning();
        await record(tx, w, actorId, id, "feedback_approved");
        return ok(updated);
      }),
    reject: (actor, w, id) =>
      change(actor, w, id, async (tx, item, actorId) => {
        if (item.visibility !== "pending") return conflict();
        const [updated] =
          item.status === "closed"
            ? [item]
            : await tx
                .update(feedback)
                .set({ status: "closed" })
                .where(scope(w, id))
                .returning();
        await record(tx, w, actorId, id, "feedback_rejected", {
          status: "closed",
          visibility: "pending",
        });
        return ok(updated);
      }),
    async setStatus(actor, w, id, input) {
      const parsed = moderationStatusSchema.safeParse(input);
      if (!parsed.success) return invalid();
      return change(actor, w, id, async (tx, item, actorId) => {
        if (item.status === parsed.data.status) return ok(item);
        const [updated] = await tx
          .update(feedback)
          .set({ status: parsed.data.status })
          .where(scope(w, id))
          .returning();
        const eventId = await record(
          tx,
          w,
          actorId,
          id,
          "feedback_status_changed",
          { from: item.status, to: parsed.data.status },
        );
        await fanoutFeedbackNotification(tx, {
          workspaceId: w,
          feedbackId: id,
          actorId,
          eventKey: `status:${eventId}`,
          type: "status_changed",
          title: `${item.title} · Status updated`,
          body: `Now ${parsed.data.status.replaceAll("_", " ")}.`,
        });
        return ok(updated);
      });
    },
    async setTaxonomy(actor, w, id, input) {
      const parsed = moderationTaxonomySchema.safeParse(input);
      if (!parsed.success) return invalid();
      return change(actor, w, id, async (tx, item, actorId) => {
        const { boardId, tagIds } = parsed.data;
        const [board] = await tx
          .select({ id: boards.id })
          .from(boards)
          .where(and(eq(boards.workspaceId, w), eq(boards.id, boardId)))
          .for("share");
        const selected = tagIds.length
          ? await tx
              .select({ id: tags.id })
              .from(tags)
              .where(and(eq(tags.workspaceId, w), inArray(tags.id, tagIds)))
              .orderBy(asc(tags.id))
              .for("share")
          : [];
        if (!board || selected.length !== tagIds.length) return invalid();
        const previous = await tx
          .select({ id: feedbackTags.tagId })
          .from(feedbackTags)
          .where(
            and(
              eq(feedbackTags.workspaceId, w),
              eq(feedbackTags.feedbackId, id),
            ),
          );
        if (
          item.boardId === boardId &&
          previous
            .map((t) => t.id)
            .sort()
            .join() === [...tagIds].sort().join()
        )
          return ok(item);
        await tx
          .delete(feedbackTags)
          .where(
            and(
              eq(feedbackTags.workspaceId, w),
              eq(feedbackTags.feedbackId, id),
            ),
          );
        if (tagIds.length)
          await tx.insert(feedbackTags).values(
            tagIds.map((tagId) => ({
              workspaceId: w,
              feedbackId: id,
              tagId,
            })),
          );
        const [updated] = await tx
          .update(feedback)
          .set({ boardId })
          .where(scope(w, id))
          .returning();
        await record(tx, w, actorId, id, "feedback_taxonomy_changed", {
          boardId,
          tagIds,
        });
        return ok(updated);
      });
    },
    async taxonomySelection(actor, w, id) {
      if (!validId(id)) return invalid();
      return transaction(async (tx) => {
        const allowed = await moderatorAccess(tx, actor, w, false);
        if (!allowed.ok) return allowed;
        const [item] = await tx
          .select({ id: feedback.id, visibility: feedback.visibility })
          .from(feedback)
          .where(scope(w, id));
        if (!item) return err(domainError("NOT_FOUND"));
        if (item.visibility === "merged") return conflict();
        const selected = await tx
          .select({ id: feedbackTags.tagId })
          .from(feedbackTags)
          .where(
            and(
              eq(feedbackTags.workspaceId, w),
              eq(feedbackTags.feedbackId, id),
            ),
          )
          .orderBy(asc(feedbackTags.tagId));
        return ok({ tagIds: selected.map((tag) => tag.id) });
      });
    },
    async merge(actor, w, sourceId, input) {
      const parsed = moderationMergeSchema.safeParse(input);
      if (
        !validId(sourceId) ||
        !parsed.success ||
        sourceId === parsed.data.targetId
      )
        return invalid();
      const targetId = parsed.data.targetId;
      return transaction(async (tx) => {
        const allowed = await moderatorAccess(tx, actor, w, true);
        if (!allowed.ok) return allowed;
        const rows = await tx
          .select()
          .from(feedback)
          .where(
            and(
              eq(feedback.workspaceId, w),
              inArray(feedback.id, [sourceId, targetId]),
            ),
          )
          .orderBy(asc(feedback.id))
          .for("update");
        const source = rows.find((row) => row.id === sourceId),
          target = rows.find((row) => row.id === targetId);
        if (!source || !target) return err(domainError("NOT_FOUND"));
        if (
          source.visibility !== "published" ||
          target.visibility !== "published"
        )
          return conflict();
        for (const table of [votes, follows]) {
          const sourceRows = await tx
            .select({ memberId: table.memberId, createdAt: table.createdAt })
            .from(table)
            .where(
              and(eq(table.workspaceId, w), eq(table.feedbackId, sourceId)),
            );
          if (sourceRows.length)
            await tx
              .insert(table)
              .values(
                sourceRows.map((row) => ({
                  ...row,
                  workspaceId: w,
                  feedbackId: targetId,
                })),
              )
              .onConflictDoNothing();
          await tx
            .delete(table)
            .where(
              and(eq(table.workspaceId, w), eq(table.feedbackId, sourceId)),
            );
        }
        await tx
          .update(feedback)
          .set({ visibility: "merged" })
          .where(scope(w, sourceId));
        await tx
          .update(feedbackRedirects)
          .set({ targetFeedbackId: targetId })
          .where(
            and(
              eq(feedbackRedirects.workspaceId, w),
              eq(feedbackRedirects.targetFeedbackId, sourceId),
            ),
          );
        await tx.insert(feedbackRedirects).values({
          workspaceId: w,
          sourceSlug: source.slug,
          targetFeedbackId: targetId,
        });
        const actorId = allowed.value.memberId!;
        const eventId = await record(
          tx,
          w,
          actorId,
          sourceId,
          "feedback_merged",
          { sourceId, targetId },
        );
        // Both sets are now unions on the target. Voters do not implicitly become followers.
        const recipients = await tx
          .select({ id: members.id })
          .from(members)
          .leftJoin(
            demoSessions,
            and(
              eq(demoSessions.workspaceId, members.workspaceId),
              eq(demoSessions.id, members.demoSessionId),
            ),
          )
          .where(
            and(
              eq(members.workspaceId, w),
              ne(members.id, actorId),
              or(
                and(
                  isNull(members.demoSessionId),
                  sql`${members.userId} IS NOT NULL`,
                ),
                sql`${demoSessions.expiresAt} > clock_timestamp()`,
              ),
              sql`(exists (select 1 from ${votes} where ${votes.workspaceId} = ${w}::uuid and ${votes.feedbackId} = ${targetId}::uuid and ${votes.memberId} = ${members.id}) or exists (select 1 from ${follows} where ${follows.workspaceId} = ${w}::uuid and ${follows.feedbackId} = ${targetId}::uuid and ${follows.memberId} = ${members.id}))`,
            ),
          );
        if (recipients.length)
          await tx
            .insert(notifications)
            .values(
              recipients.map((recipient) => ({
                workspaceId: w,
                recipientId: recipient.id,
                actorId,
                feedbackId: targetId,
                eventKey: `merge:${eventId}`,
                type: "feedback_merged" as const,
                title: `${source.title} merged into ${target.title}`,
              })),
            )
            .onConflictDoNothing({
              target: [notifications.recipientId, notifications.eventKey],
            });
        return ok({ slug: target.slug });
      });
    },
    async redirect(actor, w, slug) {
      if (!moderationSlugSchema.safeParse(slug).success) return invalid();
      return transaction(async (tx) => {
        const allowed = await engagementAccess(tx, actor, w);
        if (!allowed.ok) return allowed;
        const [target] = await tx
          .select({
            id: feedback.id,
            slug: feedback.slug,
            visibility: feedback.visibility,
            authorId: feedback.authorId,
          })
          .from(feedbackRedirects)
          .innerJoin(
            feedback,
            and(
              eq(feedback.workspaceId, feedbackRedirects.workspaceId),
              eq(feedback.id, feedbackRedirects.targetFeedbackId),
            ),
          )
          .where(
            and(
              eq(feedbackRedirects.workspaceId, w),
              eq(feedbackRedirects.sourceSlug, slug),
            ),
          );
        if (
          !target ||
          target.visibility === "merged" ||
          (target.visibility === "pending" &&
            !isEngagementModerator(allowed.value.role) &&
            target.authorId !== allowed.value.memberId)
        )
          return ok(null);
        return ok({ slug: target.slug });
      });
    },
    async history(actor, w, targetId, input) {
      const parsed = moderationHistorySchema.safeParse(input);
      if (!parsed.success) return invalid();
      return transaction(async (tx) => {
        const allowed = await engagementFeedbackAccess(tx, actor, w, targetId);
        if (!allowed.ok) return allowed;
        const cursor = parsed.data.cursor
          ? decodeCursor(parsed.data.cursor)
          : null;
        const rows = await tx
          .select({
            sourceId: feedback.id,
            sourceTitle: feedback.title,
            sourceSlug: feedback.slug,
            id: comments.id,
            body: comments.body,
            authorId: comments.authorId,
            authorName: members.displayName,
            parentId: comments.parentId,
            createdAt: comments.createdAt,
            updatedAt: comments.updatedAt,
            deletedAt: comments.deletedAt,
            cursorTime: sql<string>`to_char(${comments.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
          })
          .from(feedbackRedirects)
          .innerJoin(
            feedback,
            and(
              eq(feedback.workspaceId, feedbackRedirects.workspaceId),
              eq(feedback.slug, feedbackRedirects.sourceSlug),
              eq(feedback.visibility, "merged"),
            ),
          )
          .innerJoin(
            comments,
            and(
              eq(comments.workspaceId, feedback.workspaceId),
              eq(comments.feedbackId, feedback.id),
            ),
          )
          .innerJoin(
            members,
            and(
              eq(members.workspaceId, comments.workspaceId),
              eq(members.id, comments.authorId),
            ),
          )
          .where(
            and(
              eq(feedbackRedirects.workspaceId, w),
              eq(feedbackRedirects.targetFeedbackId, targetId),
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
          items: page.map((row) => ({
            sourceId: row.sourceId,
            sourceTitle: row.sourceTitle,
            sourceSlug: row.sourceSlug,
            comment: {
              id: row.id,
              body: row.deletedAt ? "" : row.body,
              authorId: row.authorId,
              authorName: row.authorName,
              parentId: row.parentId,
              createdAt: row.createdAt,
              updatedAt: row.updatedAt,
              deletedAt: row.deletedAt,
              canEdit: false,
              canDelete: false,
            },
          })),
          nextCursor:
            rows.length > parsed.data.limit && last
              ? encodeCursor({ createdAt: last.cursorTime, id: last.id })
              : null,
        });
      });
    },
  };
}
