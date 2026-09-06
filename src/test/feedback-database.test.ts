// @vitest-environment node
// Run separately from database.test.ts, whose setup truncates shared tables:
// FEEDBACK_DATABASE_TEST=1 node node_modules/vitest/vitest.mjs run src/test/feedback-database.test.ts
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { createDatabase } from "@/lib/db";
import { migrateDatabase } from "@/lib/db/migrate";
import { assertSafeTestDatabaseUrl } from "@/lib/env";
import * as s from "@/lib/db/schema";
import { createFeedbackRepository } from "@/features/feedback/feedback-repository";
import type { WorkspaceActor } from "@/features/auth/actor";

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url || process.env.FEEDBACK_DATABASE_TEST !== "1")(
  "feedback PostgreSQL authorization and paging",
  () => {
    const connection = url
      ? createDatabase(assertSafeTestDatabaseUrl(url))
      : undefined;
    const db = connection?.db;
    const workspaceId = randomUUID(),
      otherId = randomUUID(),
      demoId = randomUUID();
    const userId = randomUUID(),
      memberId = randomUUID(),
      moderatorId = randomUUID(),
      strangerId = randomUUID();
    const boardId = randomUUID(),
      otherBoardId = randomUUID(),
      demoBoardId = randomUUID(),
      tagId = randomUUID(),
      otherTagId = randomUUID();
    const demoSessionId = randomUUID(),
      demoMemberId = randomUUID();
    const member: WorkspaceActor = {
      kind: "account",
      workspaceId,
      memberId,
      userId,
      role: "member",
    };
    const moderator: WorkspaceActor = {
      ...member,
      memberId: moderatorId,
      userId: `${userId}-mod`,
      role: "moderator",
    };
    const demo: WorkspaceActor = {
      kind: "demo",
      workspaceId: demoId,
      memberId: demoMemberId,
      userId: null,
      role: "member",
    };
    const input = {
      title: "Please add dark mode",
      description: "We need a dark theme at night.",
      boardId,
      tagIds: [tagId],
    };
    const filters = { limit: 2, visibility: "published" as const };
    const repo = () => createFeedbackRepository(db!);
    beforeAll(async () => {
      await migrateDatabase(db!);
      await db!
        .insert(s.users)
        .values([
          { id: userId },
          { id: `${userId}-mod` },
          { id: `${userId}-stranger` },
        ]);
      await db!.insert(s.workspaces).values([
        { id: workspaceId, slug: `feedback-${workspaceId}`, name: "Test" },
        { id: otherId, slug: `feedback-${otherId}`, name: "Other" },
        {
          id: demoId,
          slug: `feedback-${demoId}`,
          name: "Private demo",
          isDemo: true,
        },
      ]);
      await db!.insert(s.demoSessions).values({
        id: demoSessionId,
        workspaceId: demoId,
        tokenHash: randomUUID().replaceAll("-", "").repeat(2),
        expiresAt: new Date(Date.now() + 3600000),
      });
      await db!.insert(s.members).values([
        { id: memberId, workspaceId, userId, displayName: "Member" },
        {
          id: moderatorId,
          workspaceId,
          userId: moderator.userId,
          role: "moderator",
          displayName: "Moderator",
        },
        {
          id: strangerId,
          workspaceId,
          userId: `${userId}-stranger`,
          displayName: "Stranger",
        },
        {
          id: demoMemberId,
          workspaceId: demoId,
          demoSessionId,
          displayName: "Demo",
        },
      ]);
      await db!.insert(s.boards).values([
        { id: boardId, workspaceId, slug: "ideas", name: "Ideas" },
        {
          id: otherBoardId,
          workspaceId: otherId,
          slug: "ideas",
          name: "Other ideas",
        },
        {
          id: demoBoardId,
          workspaceId: demoId,
          slug: "ideas",
          name: "Demo ideas",
        },
      ]);
      await db!.insert(s.tags).values([
        { id: tagId, workspaceId, slug: "ux", name: "UX" },
        { id: otherTagId, workspaceId: otherId, slug: "ux", name: "Other UX" },
      ]);
    });
    afterAll(async () => {
      if (!db || !connection) return;
      for (const id of [workspaceId, otherId, demoId])
        await db.delete(s.workspaces).where(eq(s.workspaces.id, id));
      for (const id of [userId, `${userId}-mod`, `${userId}-stranger`])
        await db.delete(s.users).where(eq(s.users.id, id));
      await connection.client.end();
    });
    it("derives visibility from persisted role and protects pending detail", async () => {
      const result = await repo().create(
        { ...member, role: "owner" },
        workspaceId,
        input,
      );
      expect(result).toMatchObject({
        ok: true,
        value: { visibility: "pending" },
      });
      if (!result.ok) return;
      expect(
        await repo().findBySlug(null, workspaceId, result.value.slug),
      ).toMatchObject({ error: { code: "NOT_FOUND" } });
      expect(
        (await repo().findBySlug(member, workspaceId, result.value.slug)).ok,
      ).toBe(true);
      const stranger = {
        ...member,
        memberId: strangerId,
        userId: `${userId}-stranger`,
      };
      expect(
        await repo().findBySlug(stranger, workspaceId, result.value.slug),
      ).toMatchObject({ error: { code: "NOT_FOUND" } });
      expect(
        (await repo().findBySlug(moderator, workspaceId, result.value.slug)).ok,
      ).toBe(true);
      expect(
        await repo().listPending(
          { ...member, role: "owner" },
          workspaceId,
          filters,
        ),
      ).toMatchObject({ error: { code: "FORBIDDEN" } });
      expect(await repo().create(moderator, workspaceId, input)).toMatchObject({
        value: { visibility: "published" },
      });
    });
    it("rejects foreign taxonomy and forged identity", async () => {
      expect(
        await repo().create(member, workspaceId, {
          ...input,
          boardId: otherBoardId,
        }),
      ).toMatchObject({ error: { code: "VALIDATION_FAILED" } });
      expect(
        await repo().create(member, workspaceId, {
          ...input,
          tagIds: [otherTagId],
        }),
      ).toMatchObject({ error: { code: "VALIDATION_FAILED" } });
      expect(
        await repo().create(
          { ...member, userId: "forged" },
          workspaceId,
          input,
        ),
      ).toMatchObject({ error: { code: "FORBIDDEN" } });
      expect(await repo().taxonomy(member, otherId)).toMatchObject({
        error: { code: "FORBIDDEN" },
      });
      expect(await repo().taxonomy(null, workspaceId)).toEqual({
        ok: true,
        value: {
          boards: [{ id: boardId, name: "Ideas" }],
          tags: [{ id: tagId, name: "UX" }],
        },
      });
    });
    it("denies stale actors after their persisted membership is deleted", async () => {
      const revokedUserId = randomUUID();
      const revokedMemberId = randomUUID();
      const staleActor: WorkspaceActor = {
        kind: "account",
        workspaceId,
        memberId: revokedMemberId,
        userId: revokedUserId,
        role: "member",
      };
      await db!.insert(s.users).values({ id: revokedUserId });
      try {
        await db!.insert(s.members).values({
          id: revokedMemberId,
          workspaceId,
          userId: revokedUserId,
          displayName: "Revocation fixture",
        });
        expect((await repo().taxonomy(staleActor, workspaceId)).ok).toBe(true);
        const deleted = await db!
          .delete(s.members)
          .where(
            and(
              eq(s.members.workspaceId, workspaceId),
              eq(s.members.id, revokedMemberId),
            ),
          )
          .returning({ id: s.members.id });
        expect(deleted).toEqual([{ id: revokedMemberId }]);
        expect(
          await repo().create(staleActor, workspaceId, input),
        ).toMatchObject({
          error: { code: "FORBIDDEN" },
        });
        expect(await repo().taxonomy(staleActor, workspaceId)).toMatchObject({
          error: { code: "FORBIDDEN" },
        });
        expect(
          await db!
            .select({ id: s.feedback.id })
            .from(s.feedback)
            .where(
              and(
                eq(s.feedback.workspaceId, workspaceId),
                eq(s.feedback.authorId, revokedMemberId),
              ),
            ),
        ).toEqual([]);
      } finally {
        await db!
          .delete(s.members)
          .where(
            and(
              eq(s.members.workspaceId, workspaceId),
              eq(s.members.id, revokedMemberId),
            ),
          );
        await db!.delete(s.users).where(eq(s.users.id, revokedUserId));
      }
    });
    it("paginates exact timestamps without repeats and scopes board, tag and status filters", async () => {
      const ids = Array.from({ length: 5 }, () => randomUUID()).sort();
      await db!.insert(s.feedback).values(
        ids.map((id, i) => ({
          id,
          workspaceId,
          boardId,
          authorId: moderatorId,
          slug: id,
          title: `Pagination ${i}`,
          body: "Page fixture",
          visibility: "published" as const,
        })),
      );
      await db!.execute(
        sql`UPDATE feedback SET created_at = '2025-01-01T00:00:00.123456Z' WHERE workspace_id = ${workspaceId} AND title LIKE 'Pagination %'`,
      );
      let cursor: string | undefined;
      const found: string[] = [];
      do {
        const page = await repo().listPublished(null, workspaceId, {
          ...filters,
          query: "Pagination",
          cursor,
        });
        expect(page.ok).toBe(true);
        if (!page.ok) return;
        found.push(...page.value.items.map((item) => item.id));
        cursor = page.value.nextCursor ?? undefined;
      } while (cursor);
      expect(found).toEqual([...ids].reverse());
      expect(
        await repo().listPublished(null, workspaceId, {
          ...filters,
          boardId: otherBoardId,
        }),
      ).toEqual({ ok: true, value: { items: [], nextCursor: null } });
      expect(
        await repo().listPublished(null, workspaceId, {
          ...filters,
          tagId: otherTagId,
        }),
      ).toEqual({ ok: true, value: { items: [], nextCursor: null } });
      expect(
        await repo().listPublished(null, workspaceId, {
          ...filters,
          status: "completed",
        }),
      ).toEqual({ ok: true, value: { items: [], nextCursor: null } });
    });
    it("treats duplicate search wildcards literally and caps suggestions at three", async () => {
      for (let i = 0; i < 4; i++)
        await repo().create(moderator, workspaceId, {
          ...input,
          title: `100%_ literal request ${i}`,
        });
      expect(
        await repo().searchSimilarTitles(null, workspaceId, "100%_"),
      ).toMatchObject({ ok: true });
      const result = await repo().searchSimilarTitles(
        null,
        workspaceId,
        "100%_",
      );
      if (result.ok) expect(result.value).toHaveLength(3);
      expect(
        await repo().searchSimilarTitles(null, workspaceId, "not_found%_"),
      ).toEqual({ ok: true, value: [] });
    });
    it("requires own valid demo identity for every data read", async () => {
      const result = await repo().create(demo, demoId, {
        ...input,
        boardId: demoBoardId,
        tagIds: [],
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      for (const outsider of [null, member]) {
        expect((await repo().listPublished(outsider, demoId, filters)).ok).toBe(
          false,
        );
        expect(
          (await repo().findBySlug(outsider, demoId, result.value.slug)).ok,
        ).toBe(false);
        expect(
          (await repo().searchSimilarTitles(outsider, demoId, "dark")).ok,
        ).toBe(false);
        expect((await repo().taxonomy(outsider, demoId)).ok).toBe(false);
      }
      expect(
        (await repo().findBySlug(demo, demoId, result.value.slug)).ok,
      ).toBe(true);
    });
    it("serializes concurrent demo writes at 30 and checks expiry inside persistence", async () => {
      const rows = await db!
        .select()
        .from(s.feedback)
        .where(eq(s.feedback.workspaceId, demoId));
      await db!.insert(s.feedback).values(
        Array.from({ length: 29 - rows.length }, () => ({
          workspaceId: demoId,
          boardId: demoBoardId,
          authorId: demoMemberId,
          slug: randomUUID(),
          title: "Quota fixture",
          body: "Quota fixture",
        })),
      );
      const results = await Promise.all(
        Array.from({ length: 3 }, () =>
          repo().create(demo, demoId, {
            ...input,
            boardId: demoBoardId,
            tagIds: [],
          }),
        ),
      );
      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(results.filter((result) => !result.ok)).toEqual(
        Array(2).fill(
          expect.objectContaining({
            error: expect.objectContaining({ code: "DEMO_QUOTA_EXCEEDED" }),
          }),
        ),
      );
      await db!
        .update(s.demoSessions)
        .set({ expiresAt: new Date(0) })
        .where(
          and(
            eq(s.demoSessions.id, demoSessionId),
            eq(s.demoSessions.workspaceId, demoId),
          ),
        );
      expect(
        await repo().create(demo, demoId, {
          ...input,
          boardId: demoBoardId,
          tagIds: [],
        }),
      ).toMatchObject({ error: { code: "DEMO_EXPIRED" } });
      expect(await repo().taxonomy(demo, demoId)).toMatchObject({
        error: { code: "DEMO_EXPIRED" },
      });
    });
  },
);
