// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { createDatabase } from "@/lib/db";
import { assertSafeTestDatabaseUrl } from "@/lib/env";
import * as s from "@/lib/db/schema";
import type { WorkspaceActor } from "@/features/auth/actor";
import { createRoadmapRepository } from "@/features/roadmap/roadmap-repository";
import { createChangelogRepository } from "@/features/roadmap/changelog-repository";
import { createChangelogService } from "@/features/roadmap/changelog-service";
import { createRoadmapService } from "@/features/roadmap/roadmap-service";

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url || process.env.ROADMAP_DATABASE_TEST !== "1")(
  "roadmap and release transactions",
  () => {
    const connection = url
      ? createDatabase(assertSafeTestDatabaseUrl(url))
      : undefined;
    const db = connection?.db;
    const w = randomUUID(),
      otherW = randomUUID(),
      boardId = randomUUID();
    const actors: WorkspaceActor[] = ["owner", "member"].map((role) => ({
      kind: "account",
      workspaceId: w,
      memberId: randomUUID(),
      userId: randomUUID(),
      role: role as WorkspaceActor["role"],
    }));
    const [owner, member] = actors;
    const roadmap = () => createRoadmapService(createRoadmapRepository(db!));
    const releases = () =>
      createChangelogService(createChangelogRepository(db!));
    const draft = (feedbackIds: string[] = []) => ({
      title: "Release draft",
      summary: "Summary",
      body: "Released improvements",
      feedbackIds,
    });
    async function item(
      status: typeof s.feedback.$inferInsert.status = "completed",
      visibility: typeof s.feedback.$inferInsert.visibility = "published",
      rank = 0,
    ) {
      const id = randomUUID();
      await db!.insert(s.feedback).values({
        id,
        workspaceId: w,
        boardId,
        authorId: member.memberId,
        slug: id,
        title: `Idea ${id}`,
        body: "Feedback text",
        status,
        visibility,
        manualRank: rank,
      });
      return id;
    }
    beforeAll(async () => {
      await db!.insert(s.users).values(actors.map((a) => ({ id: a.userId! })));
      await db!.insert(s.workspaces).values([
        { id: w, slug: `roadmap-${w}`, name: "Roadmap" },
        { id: otherW, slug: `roadmap-${otherW}`, name: "Other" },
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
      await db!
        .insert(s.boards)
        .values({ id: boardId, workspaceId: w, slug: "ideas", name: "Ideas" });
    });
    afterAll(async () => {
      if (!db || !connection) return;
      for (const id of [w, otherW])
        await db.delete(s.workspaces).where(eq(s.workspaces.id, id));
      for (const a of actors)
        await db.delete(s.users).where(eq(s.users.id, a.userId!));
      await connection.client.end();
    });
    it("requires a status and pages published roadmap by rank and precise timestamps", async () => {
      const first = await item("planned", "published", -2),
        second = await item("planned", "published", -2),
        third = await item("planned", "published", -1);
      await item("planned", "pending", -10);
      await item("planned", "merged", -10);
      await db!.execute(
        sql`UPDATE feedback SET updated_at = '2026-01-01T00:00:00.123456Z' WHERE id = ${first}`,
      );
      await db!.execute(
        sql`UPDATE feedback SET updated_at = '2026-01-01T00:00:00.123455Z' WHERE id = ${second}`,
      );
      expect(await roadmap().list(null, w, {})).toMatchObject({
        error: { code: "VALIDATION_FAILED" },
      });
      const page = await roadmap().list(null, w, {
        status: "planned",
        limit: 1,
      });
      expect(page).toMatchObject({
        value: { items: [{ id: first }], nextCursor: expect.any(String) },
      });
      if (!page.ok) throw Error("page");
      const next = await roadmap().list(null, w, {
        status: "planned",
        limit: 1,
        cursor: page.value.nextCursor,
      });
      expect(next).toMatchObject({ value: { items: [{ id: second }] } });
      if (!next.ok) throw Error("next");
      expect(
        await roadmap().list(null, w, {
          status: "planned",
          limit: 1,
          cursor: next.value.nextCursor,
        }),
      ).toMatchObject({ value: { items: [{ id: third }], nextCursor: null } });
      expect(
        await roadmap().list(owner, otherW, { status: "planned" }),
      ).toMatchObject({ error: { code: "FORBIDDEN" } });
    });
    it("keeps drafts private and trusts persisted moderator membership", async () => {
      expect(
        await releases().create({ ...member, role: "owner" }, w, draft()),
      ).toMatchObject({ error: { code: "FORBIDDEN" } });
      expect(
        await releases().list(null, w, { visibility: "draft" }),
      ).toMatchObject({ error: { code: "UNAUTHENTICATED" } });
      const result = await releases().create(owner, w, draft());
      expect(result).toMatchObject({ value: { publishedAt: null } });
      if (!result.ok) throw Error("draft");
      expect(await releases().detail(null, w, result.value.slug)).toMatchObject(
        { error: { code: "NOT_FOUND" } },
      );
      expect(
        await releases().detail(member, w, result.value.slug),
      ).toMatchObject({ error: { code: "NOT_FOUND" } });
      expect(
        await releases().detail(owner, w, result.value.slug),
      ).toMatchObject({ value: { id: result.value.id } });
      expect(
        await releases().list(null, w, { visibility: "published" }),
      ).toMatchObject({ value: { items: [] } });
      expect(await releases().completed(member, w)).toMatchObject({
        error: { code: "FORBIDDEN" },
      });
    });
    it("pages published releases with PostgreSQL microsecond precision and rejects malformed cursors", async () => {
      const a = await releases().create(owner, w, draft()),
        b = await releases().create(owner, w, draft());
      if (!a.ok || !b.ok) throw Error("draft");
      await db!.execute(
        sql`UPDATE changelog_entries SET published_at = '2090-01-01T00:00:00.123456Z' WHERE id = ${a.value.id}`,
      );
      await db!.execute(
        sql`UPDATE changelog_entries SET published_at = '2090-01-01T00:00:00.123455Z' WHERE id = ${b.value.id}`,
      );
      const page = await releases().list(null, w, {
        visibility: "published",
        limit: 1,
      });
      expect(page).toMatchObject({
        value: {
          items: [{ id: a.value.id }],
          nextCursor: expect.any(String),
        },
      });
      if (!page.ok) throw Error("page");
      expect(
        await releases().list(null, w, {
          visibility: "published",
          limit: 1,
          cursor: page.value.nextCursor,
        }),
      ).toMatchObject({ value: { items: [{ id: b.value.id }] } });
      for (const cursor of [
        "broken",
        Buffer.from(
          JSON.stringify({
            createdAt: "2026-02-30T00:00:00.123456Z",
            id: a.value.id,
          }),
        ).toString("base64url"),
      ]) {
        expect(
          await releases().list(null, w, { visibility: "published", cursor }),
        ).toMatchObject({ error: { code: "VALIDATION_FAILED" } });
        expect(
          await roadmap().list(null, w, { status: "completed", cursor }),
        ).toMatchObject({ error: { code: "VALIDATION_FAILED" } });
      }
      expect(
        await releases().detail(owner, otherW, a.value.slug),
      ).toMatchObject({ error: { code: "FORBIDDEN" } });
    });
    it("validates drafts and same workspace completed published links atomically", async () => {
      const complete = await item(),
        pending = await item("completed", "pending"),
        planned = await item("planned");
      for (const input of [
        { ...draft(), title: "tiny" },
        { ...draft(), summary: "a".repeat(301) },
        { ...draft(), body: "a".repeat(10001) },
        draft([pending]),
        draft([planned]),
        draft([randomUUID()]),
        draft([complete, complete]),
      ])
        expect(await releases().create(owner, w, input)).toMatchObject({
          error: { code: "VALIDATION_FAILED" },
        });
      const result = await releases().create(owner, w, draft([complete]));
      if (!result.ok) throw Error("draft");
      expect(result.value.feedback).toEqual([
        expect.objectContaining({ id: complete }),
      ]);
      expect(
        await releases().update(owner, w, result.value.id, draft([pending])),
      ).toMatchObject({ error: { code: "VALIDATION_FAILED" } });
      expect(
        await releases().detail(owner, w, result.value.slug),
      ).toMatchObject({ value: { feedback: [{ id: complete }] } });
      expect(
        await releases().update(owner, w, result.value.id, {
          ...draft(),
          title: "Updated release",
        }),
      ).toMatchObject({ value: { title: "Updated release", feedback: [] } });
      const logs = await db!
        .select()
        .from(s.activity)
        .where(
          and(
            eq(s.activity.workspaceId, w),
            eq(s.activity.changelogEntryId, result.value.id),
          ),
        );
      expect(logs.map((l) => l.action)).toEqual([
        "changelog_created",
        "changelog_updated",
      ]);
      expect(JSON.stringify(logs.map((l) => l.metadata))).not.toContain(
        "Released improvements",
      );
      const sameTitle = await releases().create(owner, w, draft());
      expect(sameTitle.ok && sameTitle.value.slug).not.toBe(result.value.slug);
    });
    it("publishes explicitly once and forbids later edits", async () => {
      const completed = await item();
      const result = await releases().create(owner, w, {
        ...draft([completed]),
        body: " ",
      });
      if (!result.ok) throw Error("draft");
      const id = result.value.id;
      expect(await releases().publish(owner, w, id)).toMatchObject({
        error: { code: "VALIDATION_FAILED" },
      });
      await releases().update(owner, w, id, draft([completed]));
      await db!
        .update(s.feedback)
        .set({ status: "planned" })
        .where(eq(s.feedback.id, completed));
      expect(await releases().publish(owner, w, id)).toMatchObject({
        error: { code: "VALIDATION_FAILED" },
      });
      await db!
        .update(s.feedback)
        .set({ status: "completed" })
        .where(eq(s.feedback.id, completed));
      const published = await releases().publish(owner, w, id);
      expect(published).toMatchObject({
        value: { publishedAt: expect.any(Date) },
      });
      expect(await releases().publish(owner, w, id)).toEqual(published);
      expect(await releases().update(owner, w, id, draft())).toMatchObject({
        error: { code: "CONFLICT" },
      });
      expect(await releases().detail(null, w, result.value.slug)).toMatchObject(
        { value: { id } },
      );
      const logs = await db!
        .select()
        .from(s.activity)
        .where(
          and(
            eq(s.activity.changelogEntryId, id),
            eq(s.activity.action, "changelog_published"),
          ),
        );
      expect(logs).toHaveLength(1);
    });
    it("deduplicates publication followers across links and retries, excluding publisher", async () => {
      const a = await item(),
        b = await item();
      await db!.insert(s.follows).values([
        { workspaceId: w, memberId: member.memberId, feedbackId: a },
        { workspaceId: w, memberId: member.memberId, feedbackId: b },
        { workspaceId: w, memberId: owner.memberId, feedbackId: a },
      ]);
      const result = await releases().create(owner, w, draft([a, b]));
      if (!result.ok) throw Error("draft");
      const publications = await Promise.all([
        releases().publish(owner, w, result.value.id),
        releases().publish(owner, w, result.value.id),
      ]);
      expect(publications.every((r) => r.ok)).toBe(true);
      const notes = await db!
        .select()
        .from(s.notifications)
        .where(eq(s.notifications.changelogEntryId, result.value.id));
      expect(notes).toEqual([
        expect.objectContaining({
          recipientId: member.memberId,
          feedbackId: null,
          type: "changelog_published",
          eventKey: `changelog:${result.value.id}`,
        }),
      ]);
    });
    it("reconciles a stale completed link by reopening and saving the draft", async () => {
      const idea = await item();
      const created = await releases().create(owner, w, draft([idea]));
      if (!created.ok) throw Error("draft");
      await db!
        .update(s.feedback)
        .set({ status: "planned" })
        .where(eq(s.feedback.id, idea));
      const reopened = await releases().detail(owner, w, created.value.slug);
      expect(reopened).toMatchObject({ value: { feedback: [] } });
      expect(
        await releases().publish(owner, w, created.value.id),
      ).toMatchObject({ error: { code: "VALIDATION_FAILED" } });
      expect(
        await releases().update(owner, w, created.value.id, draft([])),
      ).toMatchObject({ ok: true });
      expect(
        await releases().publish(owner, w, created.value.id),
      ).toMatchObject({
        value: { publishedAt: expect.any(Date), feedback: [] },
      });
    });
    it("keeps demos private, caps changelogs at ten under concurrent creates, and enforces expiry", async () => {
      const dw = randomUUID(),
        session = randomUUID();
      const actor: WorkspaceActor = {
        kind: "demo",
        workspaceId: dw,
        memberId: randomUUID(),
        userId: null,
        role: "owner",
      };
      await db!
        .insert(s.workspaces)
        .values({ id: dw, name: "Demo", slug: `roadmap-${dw}`, isDemo: true });
      try {
        await db!.insert(s.demoSessions).values({
          id: session,
          workspaceId: dw,
          tokenHash: randomUUID().replaceAll("-", "").repeat(2),
          expiresAt: new Date(Date.now() + 3600000),
        });
        await db!.insert(s.members).values({
          id: actor.memberId,
          workspaceId: dw,
          demoSessionId: session,
          displayName: "Owner",
          role: "owner",
        });
        expect(
          await roadmap().list(null, dw, { status: "completed" }),
        ).toMatchObject({ error: { code: "UNAUTHENTICATED" } });
        expect(
          await releases().list(null, dw, { visibility: "published" }),
        ).toMatchObject({ error: { code: "UNAUTHENTICATED" } });
        for (let i = 0; i < 9; i++)
          expect(await releases().create(actor, dw, draft())).toMatchObject({
            ok: true,
          });
        const results = await Promise.all([
          releases().create(actor, dw, draft()),
          releases().create(actor, dw, draft()),
        ]);
        expect(results.filter((r) => r.ok)).toHaveLength(1);
        expect(results.find((r) => !r.ok)).toMatchObject({
          error: { code: "DEMO_QUOTA_EXCEEDED" },
        });
        await db!
          .update(s.demoSessions)
          .set({ expiresAt: new Date(0) })
          .where(eq(s.demoSessions.id, session));
        expect(
          await releases().list(actor, dw, { visibility: "published" }),
        ).toMatchObject({ error: { code: "DEMO_EXPIRED" } });
        expect(await releases().create(actor, dw, draft())).toMatchObject({
          error: { code: "DEMO_EXPIRED" },
        });
      } finally {
        await db!.delete(s.workspaces).where(eq(s.workspaces.id, dw));
      }
    });
  },
);
