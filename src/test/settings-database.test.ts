// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { createDatabase } from "@/lib/db";
import { assertSafeTestDatabaseUrl } from "@/lib/env";
import * as s from "@/lib/db/schema";
import { createSettingsRepository } from "@/features/settings/settings-repository";
import type { WorkspaceActor } from "@/features/auth/actor";
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url || process.env.SETTINGS_DATABASE_TEST !== "1")(
  "workspace settings transactions",
  () => {
    const connection = url
      ? createDatabase(assertSafeTestDatabaseUrl(url))
      : undefined;
    const db = connection?.db;
    const w = randomUUID(),
      otherW = randomUUID(),
      boardId = randomUUID(),
      otherBoard = randomUUID(),
      otherTag = randomUUID();
    const actors = (["owner", "owner", "moderator", "member"] as const).map(
      (role): WorkspaceActor => ({
        kind: "account",
        workspaceId: w,
        memberId: randomUUID(),
        userId: randomUUID(),
        role,
      }),
    );
    const [owner, secondOwner, moderator, member] = actors;
    const repo = () => createSettingsRepository(db!);
    const branding = {
      name: "Signal",
      description: "Community",
      accentColor: "#abcdef",
    };
    const board = {
      name: "Research",
      slug: "research",
      description: null,
      position: 0,
    };
    const tag = { name: "Design", slug: "design", color: "#aabbcc" };
    beforeAll(async () => {
      await db!.insert(s.users).values(actors.map((a) => ({ id: a.userId! })));
      await db!.insert(s.workspaces).values([
        { id: w, slug: `settings-${w}`, name: "Settings" },
        { id: otherW, slug: `settings-${otherW}`, name: "Other" },
      ]);
      await db!.insert(s.members).values(
        actors.map((a) => ({
          id: a.memberId,
          workspaceId: w,
          userId: a.userId,
          role: a.role,
          displayName: a.role,
        })),
      );
      await db!.insert(s.boards).values([
        { id: boardId, workspaceId: w, name: "Ideas", slug: "ideas" },
        { id: otherBoard, workspaceId: otherW, name: "Other", slug: "other" },
      ]);
      await db!.insert(s.tags).values({
        id: otherTag,
        workspaceId: otherW,
        name: "Other",
        slug: "other",
      });
      await db!.insert(s.feedback).values({
        workspaceId: w,
        boardId,
        authorId: member.memberId,
        slug: "authored-history",
        title: "History",
        body: "Preserve",
        visibility: "published",
      });
    });
    afterAll(async () => {
      if (!db || !connection) return;
      for (const id of [w, otherW])
        await db.delete(s.workspaces).where(eq(s.workspaces.id, id));
      for (const a of actors)
        await db.delete(s.users).where(eq(s.users.id, a.userId!));
      await connection.client.end();
    });
    it("uses persisted roles for private settings and owner branding", async () => {
      expect(await repo().get(null, w)).toMatchObject({
        error: { code: "UNAUTHENTICATED" },
      });
      expect(await repo().get({ ...member, role: "owner" }, w)).toMatchObject({
        error: { code: "FORBIDDEN" },
      });
      expect(
        await repo().branding({ ...member, role: "owner" }, w, branding),
      ).toMatchObject({ error: { code: "FORBIDDEN" } });
      expect(await repo().branding(moderator, w, branding)).toMatchObject({
        error: { code: "FORBIDDEN" },
      });
      expect(await repo().branding(owner, otherW, branding)).toMatchObject({
        error: { code: "FORBIDDEN" },
      });
      expect(
        await repo().branding({ ...owner, userId: "forged" }, w, branding),
      ).toMatchObject({ error: { code: "FORBIDDEN" } });
      expect(
        await repo().branding({ ...owner, role: "member" }, w, branding),
      ).toMatchObject({ value: branding });
      expect(
        await repo().setLogo(owner, w, `${otherW}/logos/${randomUUID()}.png`),
      ).toMatchObject({ error: { code: "VALIDATION_FAILED" } });
      const key = `${w}/logos/${randomUUID()}.png`;
      expect(await repo().setLogo(owner, w, key)).toMatchObject({
        value: { logoKey: key },
      });
      expect(await repo().setLogo(owner, w, null)).toMatchObject({
        value: { logoKey: null },
      });
    });
    it("allows moderator taxonomy but protects nonempty boards and cross-tenant ids", async () => {
      expect(await repo().deleteBoard(owner, w, boardId)).toMatchObject({
        error: { code: "CONFLICT" },
      });
      for (const result of [
        await repo().deleteBoard(owner, w, otherBoard),
        await repo().saveBoard(owner, w, { ...board, id: otherBoard }),
        await repo().deleteTag(owner, w, otherTag),
        await repo().saveTag(owner, w, { ...tag, id: otherTag }),
      ])
        expect(result).toMatchObject({ error: { code: "NOT_FOUND" } });
      expect(
        await repo().saveBoard({ ...member, role: "moderator" }, w, board),
      ).toMatchObject({ error: { code: "FORBIDDEN" } });
      const saved = await repo().saveBoard(moderator, w, board);
      expect(saved).toMatchObject({ value: { slug: "research" } });
      expect(
        await repo().saveBoard(moderator, w, { ...board, slug: "RESEARCH" }),
      ).toMatchObject({ error: { code: "CONFLICT" } });
      if (!saved.ok) throw new Error("board save failed");
      expect(
        await repo().saveBoard(moderator, w, {
          ...board,
          id: saved.value.id,
          name: "Updated",
        }),
      ).toMatchObject({ value: { name: "Updated" } });
      expect(
        await repo().deleteBoard(moderator, w, saved.value.id),
      ).toMatchObject({ value: { id: saved.value.id } });
      const savedTag = await repo().saveTag(moderator, w, tag);
      expect(savedTag.ok).toBe(true);
      expect(
        await repo().saveTag(moderator, w, {
          ...tag,
          name: "DESIGN",
          slug: "other-design",
        }),
      ).toMatchObject({ error: { code: "CONFLICT" } });
      if (!savedTag.ok) throw new Error("tag save failed");
      expect(
        await repo().saveTag(moderator, w, {
          ...tag,
          id: savedTag.value.id,
          color: "#123456",
        }),
      ).toMatchObject({ value: { color: "#123456" } });
      await db!.insert(s.feedbackTags).values({
        workspaceId: w,
        tagId: savedTag.value.id,
        feedbackId: (
          await db!
            .select()
            .from(s.feedback)
            .where(eq(s.feedback.workspaceId, w))
        )[0].id,
      });
      expect(
        await repo().deleteTag(moderator, w, savedTag.value.id),
      ).toMatchObject({ ok: true });
      expect(
        await db!
          .select()
          .from(s.feedback)
          .where(eq(s.feedback.workspaceId, w)),
      ).toHaveLength(1);
    });
    it("paginates safe active account member fields only for owners", async () => {
      const stale = randomUUID();
      await db!
        .insert(s.members)
        .values({ id: stale, workspaceId: w, displayName: "Deleted account" });
      const first = await repo().get(owner, w, { limit: 2, search: "" });
      expect(first).toMatchObject({
        value: {
          members: { items: expect.any(Array), nextCursor: expect.any(String) },
        },
      });
      if (!first.ok) throw new Error("settings read failed");
      expect(first.value.members.items).toHaveLength(2);
      expect(Object.keys(first.value.members.items[0]).sort()).toEqual([
        "displayName",
        "id",
        "role",
      ]);
      const next = await repo().get(owner, w, {
        limit: 2,
        search: "",
        cursor: first.value.members.nextCursor!,
      });
      expect(next).toMatchObject({
        value: { members: { items: expect.any(Array), nextCursor: null } },
      });
      if (!next.ok) throw new Error("page failed");
      expect(
        new Set(
          [...first.value.members.items, ...next.value.members.items].map(
            (m) => m.id,
          ),
        ).size,
      ).toBe(4);
      expect(
        await repo().get(owner, w, { limit: 20, search: "moderator" }),
      ).toMatchObject({
        value: { members: { items: [{ id: moderator.memberId }] } },
      });
      expect(await repo().get(moderator, w)).toMatchObject({
        value: { members: { items: [], nextCursor: null } },
      });
      expect(
        await repo().changeRole(owner, w, { memberId: stale, role: "owner" }),
      ).toMatchObject({ error: { code: "NOT_FOUND" } });
      expect(
        await repo().changeRole(moderator, w, {
          memberId: member.memberId,
          role: "owner",
        }),
      ).toMatchObject({ error: { code: "FORBIDDEN" } });
      expect(
        await repo().changeRole(owner, w, {
          memberId: randomUUID(),
          role: "member",
        }),
      ).toMatchObject({ error: { code: "NOT_FOUND" } });
    });
    it("serializes competing owner demotions and preserves authored membership history", async () => {
      const results = await Promise.all([
        repo().changeRole(owner, w, {
          memberId: owner.memberId,
          role: "member",
        }),
        repo().changeRole(secondOwner, w, {
          memberId: secondOwner.memberId,
          role: "member",
        }),
      ]);
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(results.find((r) => !r.ok)).toMatchObject({
        error: { code: "CONFLICT" },
      });
      const remaining = await db!
        .select()
        .from(s.members)
        .where(
          and(
            eq(s.members.workspaceId, w),
            eq(s.members.role, "owner"),
            isNotNull(s.members.userId),
            isNull(s.members.demoSessionId),
          ),
        );
      expect(remaining).toHaveLength(1);
      const last = actors.find((a) => a.memberId === remaining[0].id)!;
      expect(
        await repo().changeRole(last, w, {
          memberId: last.memberId,
          role: "moderator",
        }),
      ).toMatchObject({ error: { code: "CONFLICT" } });
      expect(
        await repo().changeRole(last, w, {
          memberId: member.memberId,
          role: "moderator",
        }),
      ).toMatchObject({ value: { id: member.memberId, role: "moderator" } });
      expect(
        await db!
          .select()
          .from(s.feedback)
          .where(eq(s.feedback.authorId, member.memberId)),
      ).toHaveLength(1);
    });
    it("keeps demos private, rejects persona role changes and expiry, and enforces concurrent caps", async () => {
      const demoW = randomUUID(),
        session = randomUUID();
      const demo: WorkspaceActor = {
        kind: "demo",
        workspaceId: demoW,
        memberId: randomUUID(),
        userId: null,
        role: "owner",
      };
      await db!.insert(s.workspaces).values({
        id: demoW,
        slug: `settings-demo-${demoW}`,
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
          role: "owner",
          displayName: "Demo owner",
        });
        expect(await repo().get(null, demoW)).toMatchObject({
          error: { code: "UNAUTHENTICATED" },
        });
        expect(await repo().get(demo, demoW)).toMatchObject({
          value: { isDemo: true, members: { items: [] } },
        });
        expect(
          await repo().changeRole(demo, demoW, {
            memberId: demo.memberId,
            role: "moderator",
          }),
        ).toMatchObject({ error: { code: "FORBIDDEN" } });
        await db!.insert(s.boards).values(
          Array.from({ length: 9 }, (_, i) => ({
            workspaceId: demoW,
            name: `Board ${i}`,
            slug: `board-${i}`,
          })),
        );
        await db!.insert(s.tags).values(
          Array.from({ length: 29 }, (_, i) => ({
            workspaceId: demoW,
            name: `Tag ${i}`,
            slug: `tag-${i}`,
          })),
        );
        for (const results of [
          await Promise.all(
            ["a", "b"].map((slug) =>
              repo().saveBoard(demo, demoW, { ...board, slug }),
            ),
          ),
          await Promise.all(
            ["a", "b"].map((slug) =>
              repo().saveTag(demo, demoW, { ...tag, name: slug, slug }),
            ),
          ),
        ]) {
          expect(results.filter((r) => r.ok)).toHaveLength(1);
          expect(results.find((r) => !r.ok)).toMatchObject({
            error: { code: "DEMO_QUOTA_EXCEEDED" },
          });
        }
        await db!
          .update(s.demoSessions)
          .set({ expiresAt: new Date(0) })
          .where(eq(s.demoSessions.id, session));
        for (const result of [
          await repo().get(demo, demoW),
          await repo().branding(demo, demoW, branding),
          await repo().saveTag(demo, demoW, tag),
        ])
          expect(result).toMatchObject({ error: { code: "DEMO_EXPIRED" } });
      } finally {
        await db!.delete(s.workspaces).where(eq(s.workspaces.id, demoW));
      }
    });
  },
);
