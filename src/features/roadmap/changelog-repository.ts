import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/lib/db";
import {
  activity,
  changelogEntries as entries,
  changelogFeedback as links,
  feedback,
  follows,
  members,
  demoSessions,
  notifications,
} from "@/lib/db/schema";
import { domainError } from "@/lib/http/errors";
import { err, ok, type Result } from "@/lib/http/result";
import {
  engagementAccess,
  isEngagementModerator,
  type EngagementTransaction,
} from "../feedback/engagement-access";
import {
  decodeCursor,
  encodeCursor,
  escapeLike,
  feedbackSlug,
} from "../feedback/feedback-schema";
import type { FeedbackActor } from "../feedback/types";
import {
  changelogInputSchema,
  changelogListSchema,
  changelogSlugSchema,
  completedQuerySchema,
} from "./schema";
import type { ChangelogItem, ChangelogRepository } from "./types";

const invalid = () => err(domainError("VALIDATION_FAILED"));
const scope = (w: string, id: string) =>
  and(eq(entries.workspaceId, w), eq(entries.id, id));
const eligible = (w: string) =>
  and(
    eq(feedback.workspaceId, w),
    eq(feedback.visibility, "published"),
    eq(feedback.status, "completed"),
  );
async function moderator(
  tx: EngagementTransaction,
  actor: FeedbackActor,
  w: string,
  write = false,
) {
  const allowed = await engagementAccess(tx, actor, w, write, true);
  if (!allowed.ok) return allowed;
  return isEngagementModerator(allowed.value.role)
    ? allowed
    : err(domainError("FORBIDDEN"));
}
async function linked(tx: EngagementTransaction, w: string, id: string) {
  return tx
    .select({ id: feedback.id, title: feedback.title, slug: feedback.slug })
    .from(links)
    .innerJoin(
      feedback,
      and(
        eq(feedback.id, links.feedbackId),
        eq(feedback.workspaceId, links.workspaceId),
      ),
    )
    .where(
      and(
        eq(links.workspaceId, w),
        eq(links.changelogEntryId, id),
        eligible(w),
      ),
    )
    .orderBy(asc(feedback.title), asc(feedback.id));
}
async function hydrate(
  tx: EngagementTransaction,
  row: typeof entries.$inferSelect,
): Promise<ChangelogItem> {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    body: row.body,
    authorId: row.authorId,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    feedback: await linked(tx, row.workspaceId, row.id),
  };
}
async function validLinks(tx: EngagementTransaction, w: string, ids: string[]) {
  if (!ids.length) return true;
  const selected = await tx
    .select({ id: feedback.id })
    .from(feedback)
    .where(and(eligible(w), inArray(feedback.id, ids)))
    .orderBy(asc(feedback.id))
    .for("share");
  return selected.length === ids.length;
}
async function record(
  tx: EngagementTransaction,
  w: string,
  actorId: string,
  id: string,
  action: string,
) {
  await tx
    .insert(activity)
    .values({ workspaceId: w, actorId, changelogEntryId: id, action });
}
async function notifyPublication(
  tx: EngagementTransaction,
  row: typeof entries.$inferSelect,
  actorId: string,
) {
  const recipients = await tx
    .selectDistinct({ id: members.id })
    .from(links)
    .innerJoin(
      feedback,
      and(
        eq(feedback.workspaceId, links.workspaceId),
        eq(feedback.id, links.feedbackId),
      ),
    )
    .innerJoin(
      follows,
      and(
        eq(follows.workspaceId, links.workspaceId),
        eq(follows.feedbackId, links.feedbackId),
      ),
    )
    .innerJoin(
      members,
      and(
        eq(members.workspaceId, follows.workspaceId),
        eq(members.id, follows.memberId),
      ),
    )
    .leftJoin(
      demoSessions,
      and(
        eq(demoSessions.workspaceId, members.workspaceId),
        eq(demoSessions.id, members.demoSessionId),
      ),
    )
    .where(
      and(
        eq(links.workspaceId, row.workspaceId),
        eq(links.changelogEntryId, row.id),
        eligible(row.workspaceId),
        ne(members.id, actorId),
        or(
          and(isNull(members.demoSessionId), isNotNull(members.userId)),
          sql`${demoSessions.expiresAt} > clock_timestamp()`,
        ),
      ),
    );
  if (recipients.length)
    await tx
      .insert(notifications)
      .values(
        recipients.map((recipient) => ({
          workspaceId: row.workspaceId,
          recipientId: recipient.id,
          actorId,
          changelogEntryId: row.id,
          type: "changelog_published" as const,
          title: row.title,
          body: row.summary || null,
          eventKey: `changelog:${row.id}`,
        })),
      )
      .onConflictDoNothing({
        target: [notifications.recipientId, notifications.eventKey],
      });
}
export function createChangelogRepository(db: Database): ChangelogRepository {
  async function change(
    actor: FeedbackActor,
    w: string,
    id: string,
    operation: (
      tx: EngagementTransaction,
      row: typeof entries.$inferSelect,
      actorId: string,
    ) => Promise<Result<ChangelogItem>>,
  ) {
    if (!z.uuid().safeParse(id).success) return invalid();
    return db.transaction(async (tx) => {
      const allowed = await moderator(tx, actor, w, true);
      if (!allowed.ok) return allowed;
      const [row] = await tx
        .select()
        .from(entries)
        .where(scope(w, id))
        .for("update");
      return row
        ? operation(tx, row, allowed.value.memberId!)
        : err(domainError("NOT_FOUND"));
    });
  }
  return {
    async list(actor, w, input) {
      const parsed = changelogListSchema.safeParse(input);
      if (!parsed.success) return invalid();
      return db.transaction(async (tx) => {
        const { visibility, limit } = parsed.data;
        const allowed =
          visibility === "draft"
            ? await moderator(tx, actor, w)
            : await engagementAccess(tx, actor, w);
        if (!allowed.ok) return allowed;
        const time =
          visibility === "published" ? entries.publishedAt : entries.updatedAt;
        const cursor = parsed.data.cursor
          ? decodeCursor(parsed.data.cursor)
          : null;
        const rows = await tx
          .select({
            ...getTableColumns(entries),
            cursorTime: sql<string>`to_char(${time} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
          })
          .from(entries)
          .where(
            and(
              eq(entries.workspaceId, w),
              visibility === "published"
                ? isNotNull(entries.publishedAt)
                : isNull(entries.publishedAt),
              cursor
                ? or(
                    sql`${time} < ${cursor.createdAt}::timestamptz`,
                    and(
                      sql`${time} = ${cursor.createdAt}::timestamptz`,
                      lt(entries.id, cursor.id),
                    ),
                  )
                : undefined,
            ),
          )
          .orderBy(desc(time), desc(entries.id))
          .limit(limit + 1);
        const page = rows.slice(0, limit),
          last = page.at(-1);
        return ok({
          items: await Promise.all(page.map((row) => hydrate(tx, row))),
          nextCursor:
            rows.length > limit && last
              ? encodeCursor({ createdAt: last.cursorTime, id: last.id })
              : null,
        });
      });
    },
    async detail(actor, w, slug) {
      if (!changelogSlugSchema.safeParse(slug).success) return invalid();
      return db.transaction(async (tx) => {
        const allowed = await engagementAccess(tx, actor, w);
        if (!allowed.ok) return allowed;
        const [row] = await tx
          .select()
          .from(entries)
          .where(
            and(
              eq(entries.workspaceId, w),
              eq(entries.slug, slug),
              isEngagementModerator(allowed.value.role)
                ? undefined
                : isNotNull(entries.publishedAt),
            ),
          );
        return row ? ok(await hydrate(tx, row)) : err(domainError("NOT_FOUND"));
      });
    },
    async completed(actor, w, query = "") {
      const parsed = completedQuerySchema.safeParse(query);
      if (!parsed.success) return invalid();
      return db.transaction(async (tx) => {
        const allowed = await moderator(tx, actor, w);
        if (!allowed.ok) return allowed;
        return ok(
          await tx
            .select({
              id: feedback.id,
              title: feedback.title,
              slug: feedback.slug,
            })
            .from(feedback)
            .where(
              and(
                eligible(w),
                parsed.data
                  ? ilike(feedback.title, `%${escapeLike(parsed.data)}%`)
                  : undefined,
              ),
            )
            .orderBy(desc(feedback.updatedAt), desc(feedback.id))
            .limit(20),
        );
      });
    },
    async create(actor, w, input) {
      const parsed = changelogInputSchema.safeParse(input);
      if (!parsed.success) return invalid();
      return db.transaction(async (tx) => {
        const allowed = await moderator(tx, actor, w, true);
        if (!allowed.ok) return allowed;
        if (allowed.value.isDemo) {
          const [usage] = await tx
            .select({ total: count() })
            .from(entries)
            .where(eq(entries.workspaceId, w));
          if (usage.total >= 10) return err(domainError("DEMO_QUOTA_EXCEEDED"));
        }
        const { feedbackIds, ...fields } = parsed.data;
        if (!(await validLinks(tx, w, feedbackIds))) return invalid();
        const id = randomUUID();
        const [row] = await tx
          .insert(entries)
          .values({
            id,
            workspaceId: w,
            authorId: allowed.value.memberId!,
            slug: feedbackSlug(fields.title, id),
            ...fields,
          })
          .returning();
        if (feedbackIds.length)
          await tx.insert(links).values(
            feedbackIds.map((feedbackId) => ({
              workspaceId: w,
              changelogEntryId: id,
              feedbackId,
            })),
          );
        await record(tx, w, allowed.value.memberId!, id, "changelog_created");
        return ok(await hydrate(tx, row));
      });
    },
    async update(actor, w, id, input) {
      const parsed = changelogInputSchema.safeParse(input);
      if (!parsed.success) return invalid();
      return change(actor, w, id, async (tx, row, actorId) => {
        if (row.publishedAt) return err(domainError("CONFLICT"));
        const { feedbackIds, ...fields } = parsed.data;
        if (!(await validLinks(tx, w, feedbackIds))) return invalid();
        await tx
          .delete(links)
          .where(and(eq(links.workspaceId, w), eq(links.changelogEntryId, id)));
        if (feedbackIds.length)
          await tx.insert(links).values(
            feedbackIds.map((feedbackId) => ({
              workspaceId: w,
              changelogEntryId: id,
              feedbackId,
            })),
          );
        const [updated] = await tx
          .update(entries)
          .set(fields)
          .where(scope(w, id))
          .returning();
        await record(tx, w, actorId, id, "changelog_updated");
        return ok(await hydrate(tx, updated));
      });
    },
    publish: (actor, w, id) =>
      change(actor, w, id, async (tx, row, actorId) => {
        if (row.publishedAt) return ok(await hydrate(tx, row));
        if (!row.body.trim()) return invalid();
        const selected = await tx
          .select({ id: links.feedbackId })
          .from(links)
          .where(and(eq(links.workspaceId, w), eq(links.changelogEntryId, id)));
        if (
          !(await validLinks(
            tx,
            w,
            selected.map((item) => item.id),
          ))
        )
          return invalid();
        const [published] = await tx
          .update(entries)
          .set({ publishedAt: sql`clock_timestamp()` })
          .where(scope(w, id))
          .returning();
        await record(tx, w, actorId, id, "changelog_published");
        await notifyPublication(tx, published, actorId);
        return ok(await hydrate(tx, published));
      }),
  };
}
