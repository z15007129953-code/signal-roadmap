// @vitest-environment node
// Run separately: ENGAGEMENT_DATABASE_TEST=1 node node_modules/vitest/vitest.mjs run src/test/engagement-database.test.ts
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, count, eq } from "drizzle-orm";
import { createDatabase, type Database } from "@/lib/db";
import { createFeedbackRepository } from "@/features/feedback/feedback-repository";
import { migrateDatabase } from "@/lib/db/migrate";
import { assertSafeTestDatabaseUrl } from "@/lib/env";
import * as s from "@/lib/db/schema";
import { createEngagementRepository } from "@/features/feedback/engagement-repository";
import { createNotificationRepository } from "@/features/notifications/notification-repository";
import { fanoutFeedbackNotification } from "@/features/notifications/notification-fanout";
import type { WorkspaceActor } from "@/features/auth/actor";

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url || process.env.ENGAGEMENT_DATABASE_TEST !== "1")(
  "engagement PostgreSQL boundaries and transactions",
  () => {
    const connection = url
      ? createDatabase(assertSafeTestDatabaseUrl(url))
      : undefined;
    const db = connection?.db;
    const workspaceId = randomUUID(),
      demoId = randomUUID(),
      boardId = randomUUID(),
      demoBoardId = randomUUID(),
      sessionId = randomUUID();
    const actors: WorkspaceActor[] = Array.from({ length: 3 }, (_, i) => ({
      kind: "account",
      workspaceId,
      memberId: randomUUID(),
      userId: randomUUID(),
      role: i === 2 ? "moderator" : "member",
    }));
    const [author, follower, moderator] = actors;
    const demo: WorkspaceActor = {
      kind: "demo",
      workspaceId: demoId,
      memberId: randomUUID(),
      userId: null,
      role: "member",
    };
    const publishedId = randomUUID(),
      pendingId = randomUUID(),
      mergedId = randomUUID(),
      demoFeedbackId = randomUUID();
    const repo = () => createEngagementRepository(db!);
    const inbox = () => createNotificationRepository(db!);
    beforeAll(async () => {
      await migrateDatabase(db!);
      await db!.insert(s.users).values(actors.map((a) => ({ id: a.userId! })));
      await db!.insert(s.workspaces).values([
        {
          id: workspaceId,
          slug: `engagement-${workspaceId}`,
          name: "Engagement",
        },
        {
          id: demoId,
          slug: `engagement-${demoId}`,
          name: "Demo",
          isDemo: true,
        },
      ]);
      await db!.insert(s.demoSessions).values({
        id: sessionId,
        workspaceId: demoId,
        tokenHash: randomUUID().replaceAll("-", "").repeat(2),
        expiresAt: new Date(Date.now() + 3600000),
      });
      await db!.insert(s.members).values([
        ...actors.map((a) => ({
          id: a.memberId,
          workspaceId,
          userId: a.userId,
          displayName: a.role,
          role: a.role,
        })),
        {
          id: demo.memberId,
          workspaceId: demoId,
          demoSessionId: sessionId,
          displayName: "Demo",
          role: "member",
        },
      ]);
      await db!.insert(s.boards).values([
        { id: boardId, workspaceId, slug: "ideas", name: "Ideas" },
        { id: demoBoardId, workspaceId: demoId, slug: "ideas", name: "Ideas" },
      ]);
      await db!.insert(s.feedback).values([
        ...[
          { id: publishedId, visibility: "published" as const },
          { id: pendingId, visibility: "pending" as const },
          { id: mergedId, visibility: "merged" as const },
        ].map((item) => ({
          ...item,
          workspaceId,
          boardId,
          authorId: author.memberId,
          slug: item.id,
          title: "Test feedback",
          body: "Fixture",
        })),
        {
          id: demoFeedbackId,
          workspaceId: demoId,
          boardId: demoBoardId,
          authorId: demo.memberId,
          slug: demoFeedbackId,
          title: "Demo feedback",
          body: "Fixture",
          visibility: "published",
        },
      ]);
    });
    afterAll(async () => {
      if (!db || !connection) return;
      for (const id of [workspaceId, demoId])
        await db.delete(s.workspaces).where(eq(s.workspaces.id, id));
      for (const actor of actors)
        await db.delete(s.users).where(eq(s.users.id, actor.userId!));
      await connection.client.end();
    });
    it("serializes concurrent desired votes and counts within their transaction", async () => {
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          repo().setVote(author, workspaceId, publishedId, true),
        ),
      );
      for (const result of results)
        expect(result).toMatchObject({
          ok: true,
          value: { voted: true, voteCount: 1 },
        });
      expect(
        await repo().setVote(follower, workspaceId, publishedId, true),
      ).toMatchObject({ value: { voteCount: 2 } });
      expect(
        await repo().setVote(author, workspaceId, publishedId, false),
      ).toMatchObject({ value: { voted: false, voteCount: 1 } });
      expect(
        await repo().setVote(author, workspaceId, publishedId, false),
      ).toMatchObject({ value: { voted: false, voteCount: 1 } });
      expect(await repo().state(null, workspaceId, publishedId)).toMatchObject({
        value: { voteCount: 1, voted: false, following: false },
      });
    });
    it("protects pending, merged, forged identities and foreign workspaces", async () => {
      expect(await repo().state(null, workspaceId, pendingId)).toMatchObject({
        error: { code: "NOT_FOUND" },
      });
      expect(
        await repo().setVote(
          { ...follower, role: "owner" },
          workspaceId,
          pendingId,
          true,
        ),
      ).toMatchObject({ error: { code: "NOT_FOUND" } });
      const pendingCommentId = randomUUID();
      await db!.insert(s.comments).values({
        id: pendingCommentId,
        workspaceId,
        feedbackId: pendingId,
        authorId: author.memberId,
        body: "Existing comment",
      });
      for (const actor of [author, moderator]) {
        for (const result of [
          await repo().setVote(actor, workspaceId, pendingId, true),
          await repo().setFollow(actor, workspaceId, pendingId, true),
          await repo().createComment(actor, workspaceId, pendingId, {
            body: "Denied",
          }),
          await repo().editComment(
            actor,
            workspaceId,
            pendingId,
            pendingCommentId,
            { body: "Denied" },
          ),
          await repo().deleteComment(
            actor,
            workspaceId,
            pendingId,
            pendingCommentId,
          ),
        ])
          expect(result).toMatchObject({ error: { code: "NOT_FOUND" } });
        expect(
          (
            await createFeedbackRepository(db!).findBySlug(
              actor,
              workspaceId,
              pendingId,
            )
          ).ok,
        ).toBe(true);
      }
      expect(
        (
          await repo().listComments(moderator, workspaceId, pendingId, {
            limit: 50,
          })
        ).ok,
      ).toBe(true);
      expect(
        await repo().setFollow(author, workspaceId, mergedId, true),
      ).toMatchObject({ error: { code: "NOT_FOUND" } });
      expect(
        await repo().setVote(
          { ...author, userId: "forged" },
          workspaceId,
          publishedId,
          true,
        ),
      ).toMatchObject({ error: { code: "FORBIDDEN" } });
      expect(await repo().state(author, demoId, demoFeedbackId)).toMatchObject({
        error: { code: "FORBIDDEN" },
      });
    });
    it("returns one coherent state when a vote commits between database statements", async () => {
      const feedbackId = randomUUID();
      await db!.insert(s.feedback).values({
        id: feedbackId,
        workspaceId,
        boardId,
        authorId: author.memberId,
        slug: feedbackId,
        title: "Snapshot",
        body: "Snapshot",
        visibility: "published",
      });
      await repo().setVote(author, workspaceId, feedbackId, true);
      let committed = false;
      // Commit immediately after the aggregate statement resolves, before any
      // subsequent member-vote read. This deterministically reproduces the race.
      const wrapped = new Proxy(db!, {
        get(target, property, receiver) {
          if (property !== "select")
            return Reflect.get(target, property, receiver);
          return (...args: unknown[]) => {
            const builder = Reflect.apply(target.select, target, args);
            const fields = args[0] as Record<string, unknown>;
            if (!fields || !("value" in fields || "voteCount" in fields))
              return builder;
            function intercept(query: object): object {
              return new Proxy(query, {
                get(queryTarget, key) {
                  const value = Reflect.get(queryTarget, key);
                  if (key === "then")
                    return (
                      resolve: (value: unknown) => void,
                      reject: (reason: unknown) => void,
                    ) =>
                      Promise.resolve(query)
                        .then(async (result) => {
                          if (!committed) {
                            committed = true;
                            await db!
                              .delete(s.votes)
                              .where(
                                and(
                                  eq(s.votes.workspaceId, workspaceId),
                                  eq(s.votes.feedbackId, feedbackId),
                                ),
                              );
                          }
                          return result;
                        })
                        .then(resolve, reject);
                  return typeof value === "function"
                    ? (...params: unknown[]) =>
                        intercept(Reflect.apply(value, queryTarget, params))
                    : value;
                },
              });
            }
            return intercept(builder);
          };
        },
      }) as Database;
      expect(
        await createEngagementRepository(wrapped).state(
          author,
          workspaceId,
          feedbackId,
        ),
      ).toMatchObject({ value: { voteCount: 1, voted: true } });
      expect(committed).toBe(true);
      expect(await repo().state(author, workspaceId, feedbackId)).toMatchObject(
        { value: { voteCount: 0, voted: false } },
      );
    });
    it("deduplicates follows, notifies followers except actor and scopes inbox reads", async () => {
      await Promise.all(
        Array.from({ length: 3 }, () =>
          repo().setFollow(follower, workspaceId, publishedId, true),
        ),
      );
      await repo().setFollow(author, workspaceId, publishedId, true);
      const comment = await repo().createComment(
        author,
        workspaceId,
        publishedId,
        { body: " New comment " },
      );
      expect(comment).toMatchObject({
        value: { body: "New comment", canEdit: true, canDelete: true },
      });
      const list = await inbox().list(follower, workspaceId, { limit: 50 });
      expect(list.ok).toBe(true);
      if (!list.ok) return;
      expect(list.value.items).toHaveLength(1);
      expect(list.value.unreadCount).toBe(1);
      const id = list.value.items[0].id;
      expect(await inbox().markRead(author, workspaceId, id)).toMatchObject({
        error: { code: "NOT_FOUND" },
      });
      expect((await inbox().markRead(follower, workspaceId, id)).ok).toBe(true);
      expect((await inbox().markRead(follower, workspaceId, id)).ok).toBe(true);
      expect(
        await inbox().list(follower, workspaceId, { limit: 50 }),
      ).toMatchObject({ value: { unreadCount: 0 } });
      expect(
        await inbox().list(author, workspaceId, { limit: 50 }),
      ).toMatchObject({ value: { items: [] } });
    });
    it("preserves deleted parents, enforces comment ownership and paginates", async () => {
      const root = await repo().createComment(
        author,
        workspaceId,
        publishedId,
        { body: "Root" },
      );
      if (!root.ok) throw new Error("fixture failed");
      const reply = await repo().createComment(
        follower,
        workspaceId,
        publishedId,
        { body: "Reply", parentId: root.value.id },
      );
      expect(reply.ok).toBe(true);
      expect(
        await repo().editComment(
          moderator,
          workspaceId,
          publishedId,
          root.value.id,
          { body: "Changed" },
        ),
      ).toMatchObject({ error: { code: "FORBIDDEN" } });
      expect(
        await repo().deleteComment(
          { ...follower, role: "owner" },
          workspaceId,
          publishedId,
          root.value.id,
        ),
      ).toMatchObject({ error: { code: "FORBIDDEN" } });
      expect(
        await repo().editComment(
          author,
          workspaceId,
          publishedId,
          root.value.id,
          { body: " Revised " },
        ),
      ).toMatchObject({ value: { body: "Revised" } });
      expect(
        await repo().deleteComment(
          moderator,
          workspaceId,
          publishedId,
          root.value.id,
        ),
      ).toMatchObject({
        value: { body: "", deletedAt: expect.any(Date), canEdit: false },
      });
      const page = await repo().listComments(null, workspaceId, publishedId, {
        limit: 2,
      });
      expect(page.ok).toBe(true);
      if (!page.ok) return;
      expect(page.value.items).toHaveLength(2);
      expect(page.value.nextCursor).toBeTruthy();
      const next = await repo().listComments(null, workspaceId, publishedId, {
        limit: 2,
        cursor: page.value.nextCursor!,
      });
      if (!next.ok) throw new Error("page failed");
      expect(next.value.items.map((c) => c.id)).not.toContain(
        page.value.items[0].id,
      );
      expect(
        await repo().createComment(author, workspaceId, pendingId, {
          body: "Wrong parent",
          parentId: root.value.id,
        }),
      ).toMatchObject({ error: { code: "NOT_FOUND" } });
      if (reply.ok)
        expect(
          await repo().deleteComment(
            follower,
            workspaceId,
            publishedId,
            reply.value.id,
          ),
        ).toMatchObject({ value: { body: "" } });
    });
    it("never fans out pending comments and suppresses internal comments", async () => {
      await repo().setFollow(moderator, workspaceId, pendingId, true);
      await repo().createComment(author, workspaceId, pendingId, {
        body: "Private pending",
      });
      expect(
        await inbox().list(moderator, workspaceId, { limit: 50 }),
      ).toMatchObject({ value: { items: [] } });
      const id = randomUUID();
      await db!.insert(s.comments).values({
        id,
        workspaceId,
        feedbackId: publishedId,
        authorId: moderator.memberId,
        body: "Internal",
        isInternal: true,
      });
      const list = await repo().listComments(author, workspaceId, publishedId, {
        limit: 100,
      });
      if (!list.ok) throw new Error("list failed");
      expect(list.value.items.map((c) => c.id)).not.toContain(id);
      expect(
        await repo().createComment(author, workspaceId, publishedId, {
          body: "Reply",
          parentId: id,
        }),
      ).toMatchObject({ error: { code: "VALIDATION_FAILED" } });
    });
    it("deduplicates retried events and hides notifications after publication is withdrawn", async () => {
      const event = {
        workspaceId,
        feedbackId: publishedId,
        actorId: author.memberId,
        eventKey: `status:${randomUUID()}`,
        type: "status_changed" as const,
        title: "Status update",
      };
      await db!.transaction(async (tx) => {
        await tx
          .select({ id: s.workspaces.id })
          .from(s.workspaces)
          .where(eq(s.workspaces.id, workspaceId))
          .for("update");
        await tx
          .select({ id: s.feedback.id })
          .from(s.feedback)
          .where(
            and(
              eq(s.feedback.workspaceId, workspaceId),
              eq(s.feedback.id, publishedId),
            ),
          )
          .for("update");
        await fanoutFeedbackNotification(tx, event);
        await fanoutFeedbackNotification(tx, event);
      });
      const events = await db!
        .select()
        .from(s.notifications)
        .where(
          and(
            eq(s.notifications.workspaceId, workspaceId),
            eq(s.notifications.eventKey, event.eventKey),
          ),
        );
      expect(events).toHaveLength(1);
      await db!
        .update(s.feedback)
        .set({ visibility: "pending" })
        .where(
          and(
            eq(s.feedback.workspaceId, workspaceId),
            eq(s.feedback.id, publishedId),
          ),
        );
      try {
        expect(
          await inbox().list(follower, workspaceId, { limit: 100 }),
        ).toMatchObject({ value: { items: [], unreadCount: 0 } });
        expect(
          await inbox().markRead(follower, workspaceId, events[0].id),
        ).toMatchObject({ error: { code: "NOT_FOUND" } });
      } finally {
        await db!
          .update(s.feedback)
          .set({ visibility: "published" })
          .where(
            and(
              eq(s.feedback.workspaceId, workspaceId),
              eq(s.feedback.id, publishedId),
            ),
          );
      }
    });
    it("uses current membership and role after revocation or demotion", async () => {
      await db!
        .update(s.members)
        .set({ role: "member" })
        .where(
          and(
            eq(s.members.workspaceId, workspaceId),
            eq(s.members.id, moderator.memberId),
          ),
        );
      try {
        expect(
          await repo().state(moderator, workspaceId, pendingId),
        ).toMatchObject({ error: { code: "NOT_FOUND" } });
      } finally {
        await db!
          .update(s.members)
          .set({ role: "moderator" })
          .where(
            and(
              eq(s.members.workspaceId, workspaceId),
              eq(s.members.id, moderator.memberId),
            ),
          );
      }
      const userId = randomUUID(),
        memberId = randomUUID();
      const stale: WorkspaceActor = {
        kind: "account",
        workspaceId,
        userId,
        memberId,
        role: "owner",
      };
      await db!.insert(s.users).values({ id: userId });
      try {
        await db!.insert(s.members).values({
          id: memberId,
          workspaceId,
          userId,
          displayName: "Revoked",
        });
        expect((await repo().state(stale, workspaceId, publishedId)).ok).toBe(
          true,
        );
        await db!
          .delete(s.members)
          .where(
            and(
              eq(s.members.workspaceId, workspaceId),
              eq(s.members.id, memberId),
            ),
          );
        expect(
          await repo().state(stale, workspaceId, publishedId),
        ).toMatchObject({ error: { code: "FORBIDDEN" } });
        expect(
          await repo().createComment(stale, workspaceId, publishedId, {
            body: "Denied",
          }),
        ).toMatchObject({ error: { code: "FORBIDDEN" } });
        expect(
          await inbox().list(stale, workspaceId, { limit: 50 }),
        ).toMatchObject({ error: { code: "FORBIDDEN" } });
      } finally {
        await db!
          .delete(s.members)
          .where(
            and(
              eq(s.members.workspaceId, workspaceId),
              eq(s.members.id, memberId),
            ),
          );
        await db!.delete(s.users).where(eq(s.users.id, userId));
      }
    });
    it("enforces private demo access, quota under contention and current expiry", async () => {
      expect(await repo().state(null, demoId, demoFeedbackId)).toMatchObject({
        error: { code: "UNAUTHENTICATED" },
      });
      await db!.insert(s.comments).values(
        Array.from({ length: 99 }, () => ({
          workspaceId: demoId,
          feedbackId: demoFeedbackId,
          authorId: demo.memberId,
          body: "Quota",
        })),
      );
      const results = await Promise.all(
        Array.from({ length: 3 }, () =>
          repo().createComment(demo, demoId, demoFeedbackId, {
            body: "Last slot",
          }),
        ),
      );
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(results.filter((r) => !r.ok)).toEqual(
        Array(2).fill(
          expect.objectContaining({
            error: expect.objectContaining({ code: "DEMO_QUOTA_EXCEEDED" }),
          }),
        ),
      );
      const [usage] = await db!
        .select({ total: count() })
        .from(s.comments)
        .where(eq(s.comments.workspaceId, demoId));
      expect(usage.total).toBe(100);
      await db!
        .update(s.demoSessions)
        .set({ expiresAt: new Date(0) })
        .where(
          and(
            eq(s.demoSessions.id, sessionId),
            eq(s.demoSessions.workspaceId, demoId),
          ),
        );
      expect(await repo().state(demo, demoId, demoFeedbackId)).toMatchObject({
        error: { code: "DEMO_EXPIRED" },
      });
      expect(
        await repo().setVote(demo, demoId, demoFeedbackId, true),
      ).toMatchObject({ error: { code: "DEMO_EXPIRED" } });
      expect(await inbox().list(demo, demoId, { limit: 50 })).toMatchObject({
        error: { code: "DEMO_EXPIRED" },
      });
    });
  },
);
