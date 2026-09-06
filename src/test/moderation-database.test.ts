// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { createDatabase } from "@/lib/db";
import { assertSafeTestDatabaseUrl } from "@/lib/env";
import * as s from "@/lib/db/schema";
import { createModerationRepository } from "@/features/feedback/moderation-repository";
import type { WorkspaceActor } from "@/features/auth/actor";
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url || process.env.MODERATION_DATABASE_TEST !== "1")(
  "moderation transactions",
  () => {
    const connection = url
      ? createDatabase(assertSafeTestDatabaseUrl(url))
      : undefined;
    const db = connection?.db;
    const w = randomUUID(),
      otherW = randomUUID(),
      boardId = randomUUID(),
      otherBoardId = randomUUID(),
      tagId = randomUUID(),
      otherTagId = randomUUID();
    const actors: WorkspaceActor[] = [
      "owner",
      "moderator",
      "member",
      "member",
    ].map((role) => ({
      kind: "account",
      workspaceId: w,
      memberId: randomUUID(),
      userId: randomUUID(),
      role: role as WorkspaceActor["role"],
    }));
    const [owner, moderator, member, other] = actors;
    const repo = () => createModerationRepository(db!);
    async function item(visibility: "pending" | "published" = "published") {
      const id = randomUUID();
      await db!.insert(s.feedback).values({
        id,
        workspaceId: w,
        boardId,
        authorId: member.memberId,
        slug: id,
        title: `Idea ${id}`,
        body: "Private text",
        visibility,
      });
      return id;
    }
    beforeAll(async () => {
      await db!.insert(s.users).values(actors.map((a) => ({ id: a.userId! })));
      await db!.insert(s.workspaces).values([
        { id: w, slug: `mod-${w}`, name: "Moderation" },
        { id: otherW, slug: `mod-${otherW}`, name: "Other" },
      ]);
      await db!.insert(s.members).values(
        actors.map((a) => ({
          id: a.memberId,
          workspaceId: w,
          userId: a.userId,
          displayName: a.role,
          role: a.role,
        })),
      );
      await db!.insert(s.boards).values([
        { id: boardId, workspaceId: w, slug: "ideas", name: "Ideas" },
        { id: otherBoardId, workspaceId: otherW, slug: "ideas", name: "Ideas" },
      ]);
      await db!.insert(s.tags).values([
        { id: tagId, workspaceId: w, slug: "tag", name: "Tag" },
        { id: otherTagId, workspaceId: otherW, slug: "tag", name: "Tag" },
      ]);
    });
    afterAll(async () => {
      if (!db || !connection) return;
      for (const id of [w, otherW])
        await db.delete(s.workspaces).where(eq(s.workspaces.id, id));
      for (const a of actors)
        await db.delete(s.users).where(eq(s.users.id, a.userId!));
      await connection.client.end();
    });
    it("enforces persisted moderation role and private rejection", async () => {
      const id = await item("pending");
      expect(
        await repo().approve({ ...member, role: "owner" }, w, id),
      ).toMatchObject({ error: { code: "FORBIDDEN" } });
      expect(await repo().approve(null, w, id)).toMatchObject({
        error: { code: "UNAUTHENTICATED" },
      });
      expect(await repo().approve(owner, otherW, id)).toMatchObject({
        error: { code: "FORBIDDEN" },
      });
      expect(await repo().reject(moderator, w, id)).toMatchObject({
        value: { status: "closed", visibility: "pending" },
      });
      const logs = await db!
        .select()
        .from(s.activity)
        .where(
          and(eq(s.activity.workspaceId, w), eq(s.activity.feedbackId, id)),
        );
      expect(logs.map((l) => l.action)).toContain("feedback_rejected");
      expect(JSON.stringify(logs.map((l) => l.metadata))).not.toContain(
        "Private text",
      );
      expect(await repo().approve(owner, w, id)).toMatchObject({
        value: { visibility: "published" },
      });
      expect(await repo().reject(owner, w, id)).toMatchObject({
        error: { code: "CONFLICT" },
      });
    });
    it("validates same tenant taxonomy atomically", async () => {
      const id = await item();
      expect(
        await repo().setTaxonomy(owner, w, id, { boardId, tagIds: [tagId] }),
      ).toMatchObject({ ok: true });
      expect(await repo().taxonomySelection(owner, w, id)).toMatchObject({
        value: { tagIds: [tagId] },
      });
      for (const input of [
        { boardId: otherBoardId, tagIds: [] },
        { boardId, tagIds: [otherTagId] },
      ])
        expect(await repo().setTaxonomy(owner, w, id, input)).toMatchObject({
          error: { code: "VALIDATION_FAILED" },
        });
      expect(await repo().taxonomySelection(member, w, id)).toMatchObject({
        error: { code: "FORBIDDEN" },
      });
      expect(await repo().taxonomySelection(owner, w, id)).toMatchObject({
        value: { tagIds: [tagId] },
      });
    });
    it("records rejection intent even when a pending item was already closed", async () => {
      const id = await item("pending");
      await repo().setStatus(owner, w, id, { status: "closed" });
      await repo().reject(owner, w, id);
      const logs = await db!
        .select()
        .from(s.activity)
        .where(
          and(
            eq(s.activity.workspaceId, w),
            eq(s.activity.feedbackId, id),
            eq(s.activity.action, "feedback_rejected"),
          ),
        );
      expect(logs).toHaveLength(1);
    });
    it("rejects stale roles, forged identities, and missing merge targets", async () => {
      const id = await item("pending");
      await db!
        .update(s.members)
        .set({ role: "member" })
        .where(eq(s.members.id, moderator.memberId));
      try {
        expect(await repo().approve(moderator, w, id)).toMatchObject({
          error: { code: "FORBIDDEN" },
        });
      } finally {
        await db!
          .update(s.members)
          .set({ role: "moderator" })
          .where(eq(s.members.id, moderator.memberId));
      }
      expect(
        await repo().approve({ ...owner, userId: "forged" }, w, id),
      ).toMatchObject({ error: { code: "FORBIDDEN" } });
      expect(
        await repo().merge(owner, w, id, { targetId: randomUUID() }),
      ).toMatchObject({ error: { code: "NOT_FOUND" } });
    });
    it("authorizes private redirect targets and demo expiry before old URLs or history", async () => {
      const a = await item(),
        b = await item();
      await repo().merge(owner, w, a, { targetId: b });
      await db!
        .update(s.feedback)
        .set({ visibility: "pending" })
        .where(eq(s.feedback.id, b));
      expect(await repo().redirect(null, w, a)).toMatchObject({ value: null });
      expect(await repo().redirect(other, w, a)).toMatchObject({ value: null });
      expect(await repo().redirect(member, w, a)).toMatchObject({
        value: { slug: b },
      });
      expect(await repo().history(null, w, b, { limit: 20 })).toMatchObject({
        error: { code: "NOT_FOUND" },
      });
      const demoW = randomUUID(),
        session = randomUUID(),
        demoBoard = randomUUID(),
        source = randomUUID(),
        target = randomUUID();
      const demo: WorkspaceActor = {
        kind: "demo",
        workspaceId: demoW,
        memberId: randomUUID(),
        userId: null,
        role: "owner",
      };
      await db!.insert(s.workspaces).values({
        id: demoW,
        slug: `demo-mod-${demoW}`,
        name: "Demo",
        isDemo: true,
      });
      try {
        await db!.insert(s.demoSessions).values({
          id: session,
          workspaceId: demoW,
          tokenHash: randomUUID().replaceAll("-", "").repeat(2),
          expiresAt: new Date(Date.now() + 3600000),
        });
        await db!.insert(s.members).values({
          id: demo.memberId,
          workspaceId: demoW,
          demoSessionId: session,
          displayName: "Demo owner",
          role: "owner",
        });
        await db!.insert(s.boards).values({
          id: demoBoard,
          workspaceId: demoW,
          slug: "ideas",
          name: "Ideas",
        });
        await db!.insert(s.feedback).values(
          [source, target].map((id) => ({
            id,
            workspaceId: demoW,
            boardId: demoBoard,
            authorId: demo.memberId,
            slug: id,
            title: "Demo private",
            body: "Private",
            visibility: "published" as const,
          })),
        );
        expect(
          await repo().merge(demo, demoW, source, { targetId: target }),
        ).toMatchObject({ ok: true });
        expect(await repo().redirect(null, demoW, source)).toMatchObject({
          error: { code: "UNAUTHENTICATED" },
        });
        expect(
          await repo().history(null, demoW, target, { limit: 20 }),
        ).toMatchObject({ error: { code: "UNAUTHENTICATED" } });
        expect(await repo().redirect(demo, demoW, source)).toMatchObject({
          value: { slug: target },
        });
        await db!
          .update(s.demoSessions)
          .set({ expiresAt: new Date(0) })
          .where(eq(s.demoSessions.id, session));
        expect(await repo().redirect(demo, demoW, source)).toMatchObject({
          error: { code: "DEMO_EXPIRED" },
        });
        expect(
          await repo().history(demo, demoW, target, { limit: 20 }),
        ).toMatchObject({ error: { code: "DEMO_EXPIRED" } });
        expect(
          await repo().setStatus(demo, demoW, target, { status: "planned" }),
        ).toMatchObject({ error: { code: "DEMO_EXPIRED" } });
      } finally {
        await db!.delete(s.workspaces).where(eq(s.workspaces.id, demoW));
      }
    });
    it("only notifies actual status changes with distinct activity event IDs", async () => {
      const id = await item();
      await db!
        .insert(s.follows)
        .values({ workspaceId: w, feedbackId: id, memberId: member.memberId });
      for (const status of [
        "planned",
        "planned",
        "completed",
        "closed",
        "under_review",
        "in_progress",
      ] as const)
        expect(await repo().setStatus(owner, w, id, { status })).toMatchObject({
          value: { status },
        });
      const events = await db!
        .select()
        .from(s.notifications)
        .where(
          and(
            eq(s.notifications.workspaceId, w),
            eq(s.notifications.feedbackId, id),
          ),
        );
      expect(events).toHaveLength(5);
      expect(new Set(events.map((e) => e.eventKey)).size).toBe(5);
    });
    it("merges union votes and follows, preserves paged comment attribution, flattens redirects", async () => {
      const a = await item(),
        b = await item(),
        c = await item();
      for (const table of [s.votes, s.follows])
        await db!.insert(table).values([
          { workspaceId: w, feedbackId: a, memberId: member.memberId },
          { workspaceId: w, feedbackId: b, memberId: member.memberId },
          { workspaceId: w, feedbackId: b, memberId: other.memberId },
        ]);
      // A voter without a follow must also receive the merge event.
      await db!
        .delete(s.follows)
        .where(
          and(
            eq(s.follows.workspaceId, w),
            eq(s.follows.memberId, other.memberId),
          ),
        );
      const commentId = randomUUID();
      await db!.insert(s.comments).values([
        {
          id: commentId,
          workspaceId: w,
          feedbackId: a,
          authorId: member.memberId,
          body: "Original comment",
          createdAt: new Date("2026-01-01"),
        },
        {
          workspaceId: w,
          feedbackId: a,
          authorId: other.memberId,
          body: "Erased body",
          deletedAt: new Date(),
          createdAt: new Date("2026-01-02"),
        },
        {
          workspaceId: w,
          feedbackId: a,
          authorId: owner.memberId,
          body: "Secret internal",
          isInternal: true,
        },
      ]);
      expect(await repo().merge(owner, w, a, { targetId: b })).toMatchObject({
        value: { slug: b },
      });
      for (const table of [s.votes, s.follows]) {
        expect(
          await db!
            .select()
            .from(table)
            .where(and(eq(table.workspaceId, w), eq(table.feedbackId, a))),
        ).toHaveLength(0);
      }
      expect(
        await db!
          .select()
          .from(s.votes)
          .where(and(eq(s.votes.workspaceId, w), eq(s.votes.feedbackId, b))),
      ).toHaveLength(2);
      expect(
        await db!
          .select()
          .from(s.follows)
          .where(
            and(eq(s.follows.workspaceId, w), eq(s.follows.feedbackId, b)),
          ),
      ).toHaveLength(1);
      const notes = await db!
        .select()
        .from(s.notifications)
        .where(
          and(
            eq(s.notifications.workspaceId, w),
            eq(s.notifications.feedbackId, b),
          ),
        );
      expect(notes.map((n) => n.recipientId).sort()).toEqual(
        [member.memberId, other.memberId].sort(),
      );
      const page = await repo().history(null, w, b, { limit: 1 });
      expect(page).toMatchObject({
        value: {
          items: [
            {
              sourceId: a,
              sourceSlug: a,
              comment: {
                id: commentId,
                authorId: member.memberId,
                body: "Original comment",
                canEdit: false,
                canDelete: false,
              },
            },
          ],
          nextCursor: expect.any(String),
        },
      });
      if (!page.ok) throw new Error("history failed");
      expect(
        await repo().history(null, w, b, {
          limit: 1,
          cursor: page.value.nextCursor!,
        }),
      ).toMatchObject({
        value: { items: [{ comment: { body: "" } }], nextCursor: null },
      });
      expect(await repo().merge(owner, w, b, { targetId: c })).toMatchObject({
        ok: true,
      });
      expect(await repo().redirect(null, w, a)).toMatchObject({
        value: { slug: c },
      });
      expect(await repo().redirect(null, w, b)).toMatchObject({
        value: { slug: c },
      });
      expect(await repo().history(null, w, c, { limit: 10 })).toMatchObject({
        value: { items: expect.any(Array) },
      });
      for (const result of [
        await repo().approve(owner, w, a),
        await repo().setStatus(owner, w, a, { status: "closed" }),
        await repo().setTaxonomy(owner, w, a, { boardId, tagIds: [] }),
        await repo().merge(owner, w, c, { targetId: a }),
      ])
        expect(result).toMatchObject({ error: { code: "CONFLICT" } });
      expect(await repo().merge(owner, w, c, { targetId: c })).toMatchObject({
        error: { code: "VALIDATION_FAILED" },
      });
    });
    it("serializes competing merges without cycles or duplicate events", async () => {
      const a = await item(),
        b = await item();
      const results = await Promise.all([
        repo().merge(owner, w, a, { targetId: b }),
        repo().merge(owner, w, b, { targetId: a }),
      ]);
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(results.find((r) => !r.ok)).toMatchObject({
        error: { code: "CONFLICT" },
      });
    });
  },
);
