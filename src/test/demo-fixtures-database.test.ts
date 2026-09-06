// @vitest-environment node
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "@/lib/db";
import { assertSafeTestDatabaseUrl } from "@/lib/env";
import * as s from "@/lib/db/schema";
import { createDemoRepository } from "@/features/auth/demo-repository";
import { createIdentityRepository } from "@/features/auth/identity-repository";
import { createFeedbackRepository } from "@/features/feedback/feedback-repository";
import { createEngagementRepository } from "@/features/feedback/engagement-repository";
import { createModerationRepository } from "@/features/feedback/moderation-repository";
import { createChangelogRepository } from "@/features/roadmap/changelog-repository";
import { CANONICAL_SHOWCASE } from "@/features/demo/fixtures";
import {
  resetCanonical,
  seedCanonical,
  seedWorkspace,
} from "@/features/demo/seed";

const url =
  process.env.DEMO_FIXTURES_DATABASE_TEST === "1"
    ? process.env.TEST_DATABASE_URL
    : undefined;
describe.skipIf(!url)(
  "deterministic showcase and isolated demo fixtures",
  () => {
    const connection = url
      ? createDatabase(assertSafeTestDatabaseUrl(url))
      : undefined;
    const db = connection?.db;
    const owned = new Set<string>();
    const byWorkspace = async (workspaceId: string) => {
      const [
        boards,
        tags,
        feedback,
        comments,
        releases,
        votes,
        members,
        links,
      ] = await Promise.all([
        db!
          .select()
          .from(s.boards)
          .where(eq(s.boards.workspaceId, workspaceId)),
        db!.select().from(s.tags).where(eq(s.tags.workspaceId, workspaceId)),
        db!
          .select()
          .from(s.feedback)
          .where(eq(s.feedback.workspaceId, workspaceId)),
        db!
          .select()
          .from(s.comments)
          .where(eq(s.comments.workspaceId, workspaceId)),
        db!
          .select()
          .from(s.changelogEntries)
          .where(eq(s.changelogEntries.workspaceId, workspaceId)),
        db!.select().from(s.votes).where(eq(s.votes.workspaceId, workspaceId)),
        db!
          .select()
          .from(s.members)
          .where(eq(s.members.workspaceId, workspaceId)),
        db!
          .select()
          .from(s.changelogFeedback)
          .where(eq(s.changelogFeedback.workspaceId, workspaceId)),
      ]);
      return {
        boards,
        tags,
        feedback,
        comments,
        releases,
        votes,
        members,
        links,
      };
    };
    beforeAll(async () => {
      // Never adopt/delete preexisting showcase data in the test database.
      const existing = await db!
        .select()
        .from(s.workspaces)
        .where(eq(s.workspaces.id, CANONICAL_SHOWCASE.id));
      if (existing.length)
        throw new Error(
          "Canonical fixture ID is already occupied; test will not overwrite it",
        );
    });
    afterAll(async () => {
      if (db && owned.size)
        await db
          .delete(s.workspaces)
          .where(inArray(s.workspaces.id, [...owned]));
      await connection?.client.end();
    });

    it("seeds, preserves on repeated seed, and resets only the explicitly marked canonical showcase", async () => {
      const unrelatedId = randomUUID();
      owned.add(unrelatedId);
      await db!.insert(s.workspaces).values({
        id: unrelatedId,
        slug: `untouched-${unrelatedId}`,
        name: "Untouched",
      });
      await seedCanonical(db!);
      owned.add(CANONICAL_SHOWCASE.id);
      const initial = await byWorkspace(CANONICAL_SHOWCASE.id);
      expect(initial.boards).toHaveLength(3);
      expect(initial.tags).toHaveLength(6);
      expect(
        initial.feedback.filter((item) => item.visibility === "published"),
      ).toHaveLength(18);
      expect(
        initial.feedback.filter((item) => item.visibility === "pending"),
      ).toHaveLength(3);
      expect(initial.comments).toHaveLength(24);
      expect(
        initial.releases.filter((entry) => entry.publishedAt),
      ).toHaveLength(3);
      expect(
        initial.members.every(
          (member) =>
            !member.userId && !member.demoSessionId && member.role !== "owner",
        ),
      ).toBe(true);
      const publicFeedback = createFeedbackRepository(db!);
      expect(
        await publicFeedback.listPublished(null, CANONICAL_SHOWCASE.id, {
          visibility: "published",
          limit: 100,
        }),
      ).toMatchObject({ ok: true, value: { items: expect.any(Array) } });
      const pendingSample = initial.feedback.find(
        (item) => item.visibility === "pending",
      )!;
      expect(
        await publicFeedback.findBySlug(
          null,
          CANONICAL_SHOWCASE.id,
          pendingSample.slug,
        ),
      ).toMatchObject({ error: { code: "NOT_FOUND" } });
      expect(
        await createModerationRepository(db!).approve(
          null,
          CANONICAL_SHOWCASE.id,
          pendingSample.id,
        ),
      ).toMatchObject({ error: { code: "UNAUTHENTICATED" } });
      expect(
        await createEngagementRepository(db!).setVote(
          null,
          CANONICAL_SHOWCASE.id,
          initial.feedback[0].id,
          true,
        ),
      ).toMatchObject({ error: { code: "UNAUTHENTICATED" } });
      expect(new Set(initial.feedback.map((item) => item.status)).size).toBe(5);
      for (const link of initial.links)
        expect(
          initial.feedback.find((item) => item.id === link.feedbackId)?.status,
        ).toBe("completed");
      await seedCanonical(db!);
      expect(await byWorkspace(CANONICAL_SHOWCASE.id)).toEqual(initial);
      await db!
        .update(s.feedback)
        .set({ title: "Changed fixture" })
        .where(eq(s.feedback.id, initial.feedback[0].id));
      await resetCanonical(db!);
      const reset = await byWorkspace(CANONICAL_SHOWCASE.id);
      const sort = (items: unknown[]) =>
        [...items].sort((a, b) =>
          JSON.stringify(a).localeCompare(JSON.stringify(b)),
        );
      for (const key of Object.keys(initial) as (keyof typeof initial)[])
        expect(sort(reset[key])).toEqual(sort(initial[key]));
      expect(
        new Set(
          reset.votes.map((vote) => `${vote.feedbackId}:${vote.memberId}`),
        ).size,
      ).toBe(reset.votes.length);
      expect(
        await db!
          .select()
          .from(s.workspaces)
          .where(eq(s.workspaces.id, unrelatedId)),
      ).toHaveLength(1);
      await db!
        .update(s.workspaces)
        .set({ isShowcase: false })
        .where(eq(s.workspaces.id, CANONICAL_SHOWCASE.id));
      await expect(resetCanonical(db!)).rejects.toThrow("Refusing");
      await expect(seedCanonical(db!)).rejects.toThrow("Refusing");
      expect((await byWorkspace(CANONICAL_SHOWCASE.id)).feedback).toHaveLength(
        21,
      );
      await db!
        .delete(s.workspaces)
        .where(eq(s.workspaces.id, CANONICAL_SHOWCASE.id));
      owned.delete(CANONICAL_SHOWCASE.id);
    });

    it("refuses a slug collision without changing the unrelated workspace", async () => {
      const id = randomUUID();
      owned.add(id);
      await db!.insert(s.workspaces).values({
        id,
        slug: CANONICAL_SHOWCASE.slug,
        name: "Real community",
        isShowcase: false,
      });
      await expect(seedCanonical(db!)).rejects.toThrow("Refusing");
      await expect(resetCanonical(db!)).rejects.toThrow("Refusing");
      const [preserved] = await db!
        .select()
        .from(s.workspaces)
        .where(eq(s.workspaces.id, id));
      expect(preserved).toMatchObject({
        name: "Real community",
        isShowcase: false,
      });
      await db!.delete(s.workspaces).where(eq(s.workspaces.id, id));
      owned.delete(id);
    });

    it("seeds browser demos atomically with random IDs and preserves persona isolation", async () => {
      const repository = createDemoRepository(db!);
      const tokenHash = randomUUID().replaceAll("-", "").repeat(2);
      const input = { tokenHash, expiresAt: new Date(Date.now() + 86_400_000) };
      const first = await repository.create(input);
      owned.add(first.workspaceId);
      const second = await repository.create({
        ...input,
        tokenHash: randomUUID().replaceAll("-", "").repeat(2),
      });
      owned.add(second.workspaceId);
      const a = await byWorkspace(first.workspaceId);
      const b = await byWorkspace(second.workspaceId);
      expect(a.feedback).toHaveLength(21);
      expect(a.comments).toHaveLength(24);
      expect(a.releases).toHaveLength(3);
      expect(a.boards.find((board) => board.slug === "ideas")).toBeDefined();
      expect(a.feedback.map((item) => item.slug).sort()).toEqual(
        b.feedback.map((item) => item.slug).sort(),
      );
      const firstIds = new Set(a.feedback.map((item) => item.id));
      expect(b.feedback.every((item) => !firstIds.has(item.id))).toBe(true);
      const personas = a.members.filter((member) => member.demoSessionId);
      expect(personas.map((member) => member.role).sort()).toEqual([
        "member",
        "moderator",
      ]);
      const member = personas.find((item) => item.role === "member")!;
      const moderator = personas.find((item) => item.role === "moderator")!;
      expect(
        a.feedback
          .filter((item) => item.visibility === "pending")
          .every((item) => item.authorId === member.id),
      ).toBe(true);
      expect(
        a.members.every((item) => item.role !== "owner" && !item.userId),
      ).toBe(true);
      await expect(
        db!.transaction((tx) =>
          seedWorkspace(tx, {
            workspaceId: first.workspaceId,
            memberId: member.id,
            moderatorId: moderator.id,
          }),
        ),
      ).rejects.toThrow("empty");
      const countBefore = await db!
        .select({ id: s.workspaces.id })
        .from(s.workspaces);
      await expect(repository.create(input)).rejects.toThrow();
      expect(
        await db!.select({ id: s.workspaces.id }).from(s.workspaces),
      ).toHaveLength(countBefore.length);
      await expect(
        db!.insert(s.votes).values({
          workspaceId: second.workspaceId,
          feedbackId: b.feedback[0].id,
          memberId: member.id,
        }),
      ).rejects.toThrow();
      expect(
        await db!
          .select()
          .from(s.feedback)
          .where(
            and(
              eq(s.feedback.workspaceId, first.workspaceId),
              eq(s.feedback.visibility, "pending"),
            ),
          ),
      ).toHaveLength(3);

      // Exercise the supplied journey through real repositories, including
      // the overlapping votes on the two intentionally duplicate requests.
      const memberIdentity = await createIdentityRepository(db!).findDemo(
        tokenHash,
        "member",
      );
      const moderatorIdentity = await createIdentityRepository(db!).findDemo(
        tokenHash,
        "moderator",
      );
      expect(memberIdentity).not.toBeNull();
      expect(moderatorIdentity).not.toBeNull();
      const actor = { ...memberIdentity!, kind: "demo" as const, userId: null };
      const moderatorActor = {
        ...moderatorIdentity!,
        kind: "demo" as const,
        userId: null,
      };
      const source = a.feedback.find(
        (item) => item.slug === "weekly-email-recap",
      )!;
      const target = a.feedback.find(
        (item) => item.slug === "weekly-progress-digest",
      )!;
      expect(
        await createModerationRepository(db!).merge(
          moderatorActor!,
          first.workspaceId,
          source.id,
          { targetId: target.id },
        ),
      ).toMatchObject({ ok: true });
      const mergedVotes = await db!
        .select()
        .from(s.votes)
        .where(
          and(
            eq(s.votes.workspaceId, first.workspaceId),
            eq(s.votes.feedbackId, target.id),
          ),
        );
      expect(mergedVotes).toHaveLength(3);
      const pending = a.feedback.find((item) => item.visibility === "pending")!;
      expect(
        await createModerationRepository(db!).approve(
          moderatorActor!,
          first.workspaceId,
          pending.id,
        ),
      ).toMatchObject({ ok: true });

      // Seed content consumes the same persisted workspace quota as user content.
      const feedbackRepo = createFeedbackRepository(db!);
      const feedbackInput = {
        boardId: a.boards[0].id,
        title: "A useful extra suggestion",
        description: "Additional feedback created inside the browser demo.",
        tagIds: [],
      };
      for (let index = 0; index < 9; index++)
        expect(
          await feedbackRepo.create(actor!, first.workspaceId, feedbackInput),
        ).toMatchObject({ ok: true });
      expect(
        await feedbackRepo.create(actor!, first.workspaceId, feedbackInput),
      ).toMatchObject({ error: { code: "DEMO_QUOTA_EXCEEDED" } });
      const engagement = createEngagementRepository(db!);
      for (let index = 0; index < 76; index++)
        expect(
          await engagement.createComment(actor!, first.workspaceId, target.id, {
            body: `Additional discussion ${index + 1}.`,
          }),
        ).toMatchObject({ ok: true });
      expect(
        await engagement.createComment(actor!, first.workspaceId, target.id, {
          body: "One comment over the limit.",
        }),
      ).toMatchObject({ error: { code: "DEMO_QUOTA_EXCEEDED" } });
      const releases = createChangelogRepository(db!);
      const releaseInput = {
        title: "Additional demo release",
        body: "Draft release notes.",
        summary: "A short summary.",
        feedbackIds: [],
      };
      for (let index = 0; index < 7; index++)
        expect(
          await releases.create(
            moderatorActor!,
            first.workspaceId,
            releaseInput,
          ),
        ).toMatchObject({ ok: true });
      expect(
        await releases.create(moderatorActor!, first.workspaceId, releaseInput),
      ).toMatchObject({ error: { code: "DEMO_QUOTA_EXCEEDED" } });
    }, 30_000);

    it("rolls back a partial seed when a fixed fixture ID belongs to another workspace", async () => {
      const id = randomUUID();
      owned.add(id);
      await db!.insert(s.workspaces).values({
        id,
        slug: `seed-collision-${id}`,
        name: "Keep this workspace",
      });
      const collisionId = "51000000-0000-4000-8000-000000000010";
      await db!.insert(s.members).values({
        id: collisionId,
        workspaceId: id,
        displayName: "Keep this member",
      });
      await expect(seedCanonical(db!)).rejects.toThrow();
      expect(
        await db!
          .select()
          .from(s.workspaces)
          .where(eq(s.workspaces.id, CANONICAL_SHOWCASE.id)),
      ).toHaveLength(0);
      expect(
        await db!.select().from(s.members).where(eq(s.members.id, collisionId)),
      ).toMatchObject([{ workspaceId: id, displayName: "Keep this member" }]);
    });
  },
);
