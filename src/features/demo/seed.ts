import { and, eq, inArray, or, sql } from "drizzle-orm";
import type { Database } from "../../lib/db/index.ts";
import * as schema from "../../lib/db/schema.ts";
import {
  buildWorkspaceFixtures,
  CANONICAL_SHOWCASE,
  type FixtureInput,
} from "./fixtures.ts";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Runs in the caller's transaction, after workspace/session/persona creation. */
export async function seedWorkspace(tx: Transaction, input: FixtureInput) {
  // Keep the workspace lock first, as in the bounded mutation repositories.
  const [workspace] = await tx
    .select()
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, input.workspaceId))
    .for("update");
  if (
    !workspace ||
    (input.canonical
      ? workspace.id !== CANONICAL_SHOWCASE.id ||
        !workspace.isShowcase ||
        workspace.isDemo
      : !workspace.isDemo || workspace.isShowcase)
  ) {
    throw new Error(
      "Refusing to seed a workspace outside the demo/showcase boundary",
    );
  }
  const personas = await tx
    .select()
    .from(schema.members)
    .where(
      and(
        eq(schema.members.workspaceId, input.workspaceId),
        inArray(schema.members.id, [input.memberId, input.moderatorId]),
      ),
    );
  if (
    !personas.some(
      (member) => member.id === input.memberId && member.role === "member",
    ) ||
    !personas.some(
      (member) =>
        member.id === input.moderatorId && member.role === "moderator",
    )
  ) {
    throw new Error(
      "Seeding requires a member and moderator from the same workspace",
    );
  }
  // Initial seed is deliberately insert-only. Reusing it must never spend the
  // remaining quota or silently overwrite feedback someone has already written.
  for (const table of [
    schema.boards,
    schema.tags,
    schema.feedback,
    schema.comments,
    schema.changelogEntries,
  ]) {
    const existing = await tx
      .select({ workspaceId: table.workspaceId })
      .from(table)
      .where(eq(table.workspaceId, input.workspaceId))
      .limit(1);
    if (existing.length) throw new Error("Seeding requires an empty workspace");
  }
  const data = buildWorkspaceFixtures(input);
  await tx.insert(schema.members).values(data.members);
  await tx.insert(schema.boards).values(data.boards);
  await tx.insert(schema.tags).values(data.tags);
  await tx.insert(schema.feedback).values(data.feedback);
  await tx.insert(schema.feedbackTags).values(data.feedbackTags);
  await tx.insert(schema.votes).values(data.votes);
  await tx.insert(schema.follows).values(data.follows);
  await tx.insert(schema.comments).values(data.comments);
  await tx.insert(schema.changelogEntries).values(data.changelogEntries);
  await tx.insert(schema.changelogFeedback).values(data.changelogFeedback);
}

async function canonical(db: Database, reset: boolean) {
  return db.transaction(async (tx) => {
    // Serialize first creation too: there may not yet be a workspace row to lock.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(51000000, 11)`);
    const existing = await tx
      .select()
      .from(schema.workspaces)
      .where(
        or(
          eq(schema.workspaces.id, CANONICAL_SHOWCASE.id),
          eq(schema.workspaces.slug, CANONICAL_SHOWCASE.slug),
        ),
      )
      .for("update");
    if (
      existing.some(
        (workspace) =>
          workspace.id !== CANONICAL_SHOWCASE.id ||
          workspace.slug !== CANONICAL_SHOWCASE.slug ||
          !workspace.isShowcase ||
          workspace.isDemo,
      )
    ) {
      throw new Error(
        "Refusing to overwrite an unrelated workspace ID or slug",
      );
    }
    if (reset && !existing.length)
      throw new Error("Refusing to reset a missing canonical showcase");
    if (existing.length && !reset)
      return {
        workspaceId: CANONICAL_SHOWCASE.id,
        slug: CANONICAL_SHOWCASE.slug,
        created: false,
      };
    if (reset) {
      // This exact guarded workspace is the only reset target. Cascades remove
      // its relations, including votes, before deterministic rows are restored.
      await tx
        .delete(schema.workspaces)
        .where(
          and(
            eq(schema.workspaces.id, CANONICAL_SHOWCASE.id),
            eq(schema.workspaces.slug, CANONICAL_SHOWCASE.slug),
            eq(schema.workspaces.isShowcase, true),
            eq(schema.workspaces.isDemo, false),
          ),
        );
    }
    const createdAt = new Date("2026-08-01T09:00:00.000Z");
    await tx.insert(schema.workspaces).values({
      ...CANONICAL_SHOWCASE,
      isShowcase: true,
      isDemo: false,
      createdAt,
      updatedAt: createdAt,
    });
    const memberId = "51000000-0000-4000-8000-000000000002";
    const moderatorId = "51000000-0000-4000-8000-000000000003";
    // Fictional attribution only: neither account nor demo identity can log in.
    await tx.insert(schema.members).values([
      {
        id: memberId,
        workspaceId: CANONICAL_SHOWCASE.id,
        displayName: "Casey Morgan",
        role: "member",
        userId: null,
        demoSessionId: null,
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: moderatorId,
        workspaceId: CANONICAL_SHOWCASE.id,
        displayName: "Taylor Reed",
        role: "moderator",
        userId: null,
        demoSessionId: null,
        createdAt,
        updatedAt: createdAt,
      },
    ]);
    await seedWorkspace(tx, {
      workspaceId: CANONICAL_SHOWCASE.id,
      memberId,
      moderatorId,
      canonical: true,
    });
    return {
      workspaceId: CANONICAL_SHOWCASE.id,
      slug: CANONICAL_SHOWCASE.slug,
      created: true,
    };
  });
}

export function seedCanonical(db: Database) {
  return canonical(db, false);
}

export function resetCanonical(db: Database) {
  return canonical(db, true);
}
