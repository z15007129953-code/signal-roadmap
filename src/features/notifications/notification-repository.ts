import { and, count, desc, eq, exists, isNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/lib/db";
import { feedback, notifications } from "@/lib/db/schema";
import { domainError } from "@/lib/http/errors";
import { err, ok } from "@/lib/http/result";
import {
  engagementAccess,
  type EngagementExecutor,
} from "../feedback/engagement-access";
import { engagementPageSchema } from "../feedback/engagement-schema";
import { decodeCursor, encodeCursor } from "../feedback/feedback-schema";
import type { NotificationRepository } from "./notification-types";

/** Suppress notifications for content no longer public, even if visibility changed after fanout. */
function visible(db: EngagementExecutor) {
  return exists(
    db
      .select({ id: feedback.id })
      .from(feedback)
      .where(
        and(
          eq(feedback.workspaceId, notifications.workspaceId),
          eq(feedback.id, notifications.feedbackId),
          eq(feedback.visibility, "published"),
        ),
      ),
  );
}
export function createNotificationRepository(
  db: Database,
): NotificationRepository {
  return {
    async list(actor, workspaceId, input) {
      const parsed = engagementPageSchema.safeParse(input);
      if (!parsed.success) return err(domainError("VALIDATION_FAILED"));
      const allowed = await engagementAccess(
        db,
        actor,
        workspaceId,
        false,
        true,
      );
      if (!allowed.ok) return allowed;
      const scope = and(
        eq(notifications.workspaceId, workspaceId),
        eq(notifications.recipientId, allowed.value.memberId!),
        visible(db),
      );
      const cursor = parsed.data.cursor
        ? decodeCursor(parsed.data.cursor)
        : null;
      const rows = await db
        .select({
          id: notifications.id,
          feedbackId: notifications.feedbackId,
          feedbackSlug: feedback.slug,
          type: notifications.type,
          title: notifications.title,
          body: notifications.body,
          createdAt: notifications.createdAt,
          readAt: notifications.readAt,
          cursorTime: sql<string>`to_char(${notifications.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
        })
        .from(notifications)
        .leftJoin(
          feedback,
          and(
            eq(feedback.workspaceId, notifications.workspaceId),
            eq(feedback.id, notifications.feedbackId),
          ),
        )
        .where(
          and(
            scope,
            cursor
              ? or(
                  sql`${notifications.createdAt} < ${cursor.createdAt}::timestamptz`,
                  and(
                    sql`${notifications.createdAt} = ${cursor.createdAt}::timestamptz`,
                    lt(notifications.id, cursor.id),
                  ),
                )
              : undefined,
          ),
        )
        .orderBy(desc(notifications.createdAt), desc(notifications.id))
        .limit(parsed.data.limit + 1);
      const [unread] = await db
        .select({ total: count() })
        .from(notifications)
        .where(and(scope, isNull(notifications.readAt)));
      const page = rows.slice(0, parsed.data.limit),
        last = page.at(-1);
      return ok({
        items: page.map((item) => ({
          id: item.id,
          feedbackId: item.feedbackId,
          feedbackSlug: item.feedbackSlug,
          type: item.type,
          title: item.title,
          body: item.body,
          createdAt: item.createdAt,
          readAt: item.readAt,
        })),
        unreadCount: unread.total,
        nextCursor:
          rows.length > parsed.data.limit && last
            ? encodeCursor({ createdAt: last.cursorTime, id: last.id })
            : null,
      });
    },
    async markRead(actor, workspaceId, id) {
      if (!z.uuid().safeParse(id).success)
        return err(domainError("VALIDATION_FAILED"));
      return db.transaction(async (tx) => {
        const allowed = await engagementAccess(
          tx,
          actor,
          workspaceId,
          true,
          true,
        );
        if (!allowed.ok) return allowed;
        const [item] = await tx
          .update(notifications)
          .set({
            readAt: sql`coalesce(${notifications.readAt}, clock_timestamp())`,
          })
          .where(
            and(
              eq(notifications.workspaceId, workspaceId),
              eq(notifications.recipientId, allowed.value.memberId!),
              eq(notifications.id, id),
              visible(tx),
            ),
          )
          .returning({ id: notifications.id, readAt: notifications.readAt });
        return item
          ? ok({ id: item.id, readAt: item.readAt! })
          : err(domainError("NOT_FOUND"));
      });
    },
  };
}
