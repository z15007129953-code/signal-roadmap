import { randomUUID } from "node:crypto";
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gt,
  inArray,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/lib/db";
import {
  boards,
  demoSessions,
  feedback,
  feedbackTags,
  members,
  tags,
  workspaces,
} from "@/lib/db/schema";
import { domainError } from "@/lib/http/errors";
import { err, ok, type Result } from "@/lib/http/result";
import type { WorkspaceRole } from "../auth/actor";
import { demoQuota } from "../auth/demo-session";
import {
  createFeedbackSchema,
  decodeCursor,
  encodeCursor,
  escapeLike,
  feedbackFiltersSchema,
  feedbackSlug,
} from "./feedback-schema";
import type {
  FeedbackActor,
  FeedbackFilters,
  FeedbackItem,
  FeedbackRepository,
} from "./types";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Executor = Database | Transaction;
const columns = {
  id: feedback.id,
  slug: feedback.slug,
  title: feedback.title,
  body: feedback.body,
  status: feedback.status,
  visibility: feedback.visibility,
  createdAt: feedback.createdAt,
  authorId: feedback.authorId,
  boardId: feedback.boardId,
};
const moderator = (role: WorkspaceRole | null) =>
  role === "moderator" || role === "owner";

/** Revalidate persisted identity; actor.role never grants persistence privileges. */
async function access(
  db: Executor,
  actor: FeedbackActor,
  workspaceId: string,
  write = false,
): Promise<
  Result<{
    isDemo: boolean;
    role: WorkspaceRole | null;
    memberId: string | null;
  }>
> {
  if (!z.uuid().safeParse(workspaceId).success)
    return err(domainError("VALIDATION_FAILED"));
  if (actor && actor.workspaceId !== workspaceId)
    return err(domainError("FORBIDDEN"));
  let workspace;
  if (write) {
    // All demo creation paths lock this row before counting and inserting.
    [workspace] = await db
      .select({ isDemo: workspaces.isDemo })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .for("update");
  } else {
    [workspace] = await db
      .select({ isDemo: workspaces.isDemo })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId));
  }
  if (!workspace) return err(domainError("NOT_FOUND"));
  if (!actor)
    return workspace.isDemo || write
      ? err(domainError("UNAUTHENTICATED"))
      : ok({ isDemo: false, role: null, memberId: null });
  if (!z.uuid().safeParse(actor.memberId).success)
    return err(domainError("FORBIDDEN"));
  const identity =
    actor.kind === "account"
      ? and(eq(members.userId, actor.userId), isNull(members.demoSessionId))
      : and(isNull(members.userId), eq(workspaces.isDemo, true));
  const query = db
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
  // Share locks prevent concurrent revocation or role changes during a write.
  const [member] = write
    ? await query.for("share", { of: members })
    : await query;
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

export function createFeedbackRepository(db: Database): FeedbackRepository {
  async function list(
    actor: FeedbackActor,
    workspaceId: string,
    raw: FeedbackFilters,
    pending: boolean,
  ) {
    const checked = feedbackFiltersSchema.safeParse(raw);
    if (!checked.success) return err(domainError("VALIDATION_FAILED"));
    const allowed = await access(db, actor, workspaceId);
    if (!allowed.ok) return allowed;
    if (pending && !moderator(allowed.value.role))
      return err(domainError("FORBIDDEN"));
    const filters = checked.data;
    const cursor = filters.cursor ? decodeCursor(filters.cursor) : null;
    const rows = await db
      .select({
        ...columns,
        cursorTime: sql<string>`to_char(${feedback.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
      })
      .from(feedback)
      .where(
        and(
          eq(feedback.workspaceId, workspaceId),
          eq(feedback.visibility, pending ? "pending" : "published"),
          filters.boardId ? eq(feedback.boardId, filters.boardId) : undefined,
          filters.status ? eq(feedback.status, filters.status) : undefined,
          filters.query
            ? sql`${feedback.title} ILIKE ${`%${escapeLike(filters.query)}%`} ESCAPE ${"\\"}`
            : undefined,
          filters.tagId
            ? exists(
                db
                  .select({ id: feedbackTags.feedbackId })
                  .from(feedbackTags)
                  .where(
                    and(
                      eq(feedbackTags.workspaceId, workspaceId),
                      eq(feedbackTags.feedbackId, feedback.id),
                      eq(feedbackTags.tagId, filters.tagId),
                    ),
                  ),
              )
            : undefined,
          cursor
            ? or(
                sql`${feedback.createdAt} < ${cursor.createdAt}::timestamptz`,
                and(
                  sql`${feedback.createdAt} = ${cursor.createdAt}::timestamptz`,
                  lt(feedback.id, cursor.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(desc(feedback.createdAt), desc(feedback.id))
      .limit(filters.limit + 1);
    const page = rows.slice(0, filters.limit);
    const last = page.at(-1);
    return ok({
      items: page.map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        body: row.body,
        status: row.status,
        visibility: row.visibility,
        createdAt: row.createdAt,
        authorId: row.authorId,
        boardId: row.boardId,
      })),
      nextCursor:
        rows.length > filters.limit && last
          ? encodeCursor({ createdAt: last.cursorTime, id: last.id })
          : null,
    });
  }
  return {
    async workspaceBySlug(slug) {
      // Only routing metadata; content and taxonomy always pass access().
      if (!/^[a-z0-9-]{1,200}$/.test(slug)) return null;
      const [workspace] = await db
        .select({
          id: workspaces.id,
          slug: workspaces.slug,
          name: workspaces.name,
          description: workspaces.description,
          isDemo: workspaces.isDemo,
          logoKey: workspaces.logoKey,
          accentColor: workspaces.accentColor,
        })
        .from(workspaces)
        .where(eq(workspaces.slug, slug))
        .limit(1);
      return workspace ?? null;
    },
    async create(actor, workspaceId, raw) {
      const parsed = createFeedbackSchema.safeParse(raw);
      if (!parsed.success) return err(domainError("VALIDATION_FAILED"));
      return db.transaction(async (tx) => {
        const allowed = await access(tx, actor, workspaceId, true);
        if (!allowed.ok) return allowed;
        const input = parsed.data;
        const [board] = await tx
          .select({ id: boards.id })
          .from(boards)
          .where(
            and(
              eq(boards.workspaceId, workspaceId),
              eq(boards.id, input.boardId),
            ),
          )
          .for("share");
        if (!board) return err(domainError("VALIDATION_FAILED"));
        if (input.tagIds.length) {
          const matching = await tx
            .select({ id: tags.id })
            .from(tags)
            .where(
              and(
                eq(tags.workspaceId, workspaceId),
                inArray(tags.id, input.tagIds),
              ),
            )
            .for("share");
          if (matching.length !== input.tagIds.length)
            return err(domainError("VALIDATION_FAILED"));
        }
        if (allowed.value.isDemo) {
          const [usage] = await tx
            .select({ total: count() })
            .from(feedback)
            .where(eq(feedback.workspaceId, workspaceId));
          if (usage.total >= demoQuota.feedback)
            return err(domainError("DEMO_QUOTA_EXCEEDED"));
        }
        const id = randomUUID();
        const [item] = await tx
          .insert(feedback)
          .values({
            id,
            workspaceId,
            boardId: input.boardId,
            authorId: actor.memberId,
            slug: feedbackSlug(input.title, id),
            title: input.title,
            body: input.description,
            visibility: moderator(allowed.value.role) ? "published" : "pending",
          })
          .returning(columns);
        if (input.tagIds.length)
          await tx.insert(feedbackTags).values(
            input.tagIds.map((tagId) => ({
              workspaceId,
              feedbackId: id,
              tagId,
            })),
          );
        return ok(item);
      });
    },
    async findBySlug(actor, workspaceId, slug) {
      const allowed = await access(db, actor, workspaceId);
      if (!allowed.ok) return allowed;
      const [item] = await db
        .select(columns)
        .from(feedback)
        .where(
          and(
            eq(feedback.workspaceId, workspaceId),
            eq(feedback.slug, slug),
            or(
              eq(feedback.visibility, "published"),
              and(
                eq(feedback.visibility, "pending"),
                moderator(allowed.value.role)
                  ? sql`true`
                  : allowed.value.memberId
                    ? eq(feedback.authorId, allowed.value.memberId)
                    : sql`false`,
              ),
            ),
          ),
        )
        .limit(1);
      return item ? ok(item) : err(domainError("NOT_FOUND"));
    },
    listPublished: (actor, workspaceId, filters) =>
      list(actor, workspaceId, filters, false),
    listPending: (actor, workspaceId, filters) =>
      list(actor, workspaceId, filters, true),
    async searchSimilarTitles(actor, workspaceId, title) {
      const allowed = await access(db, actor, workspaceId);
      if (!allowed.ok) return allowed;
      const checked = z.string().trim().max(140).safeParse(title);
      if (!checked.success) return err(domainError("VALIDATION_FAILED"));
      if (checked.data.length < 3) return ok([] as FeedbackItem[]);
      const items = await db
        .select(columns)
        .from(feedback)
        .where(
          and(
            eq(feedback.workspaceId, workspaceId),
            eq(feedback.visibility, "published"),
            sql`${feedback.title} ILIKE ${`%${escapeLike(checked.data)}%`} ESCAPE ${"\\"}`,
          ),
        )
        .orderBy(desc(feedback.createdAt), desc(feedback.id))
        .limit(3);
      return ok(items);
    },
    async taxonomy(actor, workspaceId) {
      const allowed = await access(db, actor, workspaceId);
      if (!allowed.ok) return allowed;
      const [boardRows, tagRows] = await Promise.all([
        db
          .select({ id: boards.id, name: boards.name })
          .from(boards)
          .where(eq(boards.workspaceId, workspaceId))
          .orderBy(asc(boards.position), asc(boards.name), asc(boards.id)),
        db
          .select({ id: tags.id, name: tags.name })
          .from(tags)
          .where(eq(tags.workspaceId, workspaceId))
          .orderBy(asc(tags.name), asc(tags.id)),
      ]);
      return ok({ boards: boardRows, tags: tagRows });
    },
  };
}
