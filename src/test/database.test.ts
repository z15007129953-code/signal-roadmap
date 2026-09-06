// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { DrizzleAdapter } from "@auth/drizzle-adapter";

import { createDatabase } from "@/lib/db";
import { migrateDatabase, resetTestDatabase } from "@/lib/db/migrate";
import { assertSafeTestDatabaseUrl } from "@/lib/env";
import * as schema from "@/lib/db/schema";
import { createIdentityRepository } from "@/features/auth/identity-repository";

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("PostgreSQL tenant integrity", () => {
  const connection = url
    ? createDatabase(assertSafeTestDatabaseUrl(url))
    : undefined;
  const db = connection?.db;
  const workspaceA = randomUUID();
  const workspaceB = randomUUID();
  const memberA = randomUUID();
  const memberB = randomUUID();
  const boardA = randomUUID();
  const boardB = randomUUID();
  const feedbackA = randomUUID();
  const feedbackB = randomUUID();
  const tagB = randomUUID();

  beforeAll(async () => {
    if (!connection || !db || !url)
      throw new Error("TEST_DATABASE_URL is required");
    await migrateDatabase(connection.db);
    await resetTestDatabase(connection.client, url);
    await db.insert(schema.users).values([
      { id: "a", email: "a@example.com" },
      { id: "b", email: "b@example.com" },
    ]);
    await db.insert(schema.workspaces).values([
      { id: workspaceA, slug: "a", name: "A" },
      { id: workspaceB, slug: "b", name: "B" },
    ]);
    await db.insert(schema.members).values([
      {
        id: memberA,
        workspaceId: workspaceA,
        userId: "a",
        displayName: "A",
        role: "owner",
      },
      { id: memberB, workspaceId: workspaceB, userId: "b", displayName: "B" },
    ]);
    await db.insert(schema.boards).values([
      {
        id: boardA,
        workspaceId: workspaceA,
        slug: "features",
        name: "Features",
      },
      {
        id: boardB,
        workspaceId: workspaceB,
        slug: "features",
        name: "Features",
      },
    ]);
    await db.insert(schema.feedback).values([
      {
        id: feedbackA,
        workspaceId: workspaceA,
        boardId: boardA,
        authorId: memberA,
        slug: "dark-mode",
        title: "Dark mode",
        body: "Please add it",
      },
      {
        id: feedbackB,
        workspaceId: workspaceB,
        boardId: boardB,
        authorId: memberB,
        slug: "dark-mode",
        title: "Dark mode",
        body: "Please add it",
      },
    ]);
    await db
      .insert(schema.tags)
      .values({ id: tagB, workspaceId: workspaceB, name: "UX", slug: "ux" });
  });

  afterAll(async () => {
    if (connection) await connection.client.end();
  });

  it("resolves account identity only inside its persisted workspace", async () => {
    const repository = createIdentityRepository(db!);
    expect(await repository.findAccount("a", workspaceA)).toMatchObject({
      memberId: memberA,
      role: "owner",
    });
    expect(await repository.findAccount("a", workspaceB)).toBeNull();
    expect(await repository.findAccount("unknown", workspaceA)).toBeNull();
  });

  it("resolves demo personas only from hashed sessions in demo workspaces", async () => {
    const repository = createIdentityRepository(db!);
    const [workspace] = await db!
      .insert(schema.workspaces)
      .values({ slug: "identity-demo", name: "Demo", isDemo: true })
      .returning();
    const [session] = await db!
      .insert(schema.demoSessions)
      .values({
        workspaceId: workspace.id,
        tokenHash: "b".repeat(64),
        expiresAt: new Date(Date.now() + 60_000),
      })
      .returning();
    await db!.insert(schema.members).values({
      workspaceId: workspace.id,
      demoSessionId: session.id,
      displayName: "Demo member",
      role: "member",
    });
    expect(
      await repository.findDemo(session.tokenHash, "member"),
    ).toMatchObject({
      workspaceId: workspace.id,
      userId: null,
      role: "member",
    });
    expect(
      await repository.findDemo(session.tokenHash, "moderator"),
    ).toBeNull();
    expect(await repository.findDemo("c".repeat(64), "member")).toBeNull();
    await db!
      .update(schema.workspaces)
      .set({ isDemo: false })
      .where(eq(schema.workspaces.id, workspace.id));
    expect(await repository.findDemo(session.tokenHash, "member")).toBeNull();
    await db!
      .delete(schema.workspaces)
      .where(eq(schema.workspaces.id, workspace.id));
  });

  it("supports the real Auth.js adapter user, account, session and token operations", async () => {
    const adapter = DrizzleAdapter(db!, {
      usersTable: schema.users,
      accountsTable: schema.accounts,
      sessionsTable: schema.sessions,
      verificationTokensTable: schema.verificationTokens,
    });
    const user = await adapter.createUser!({
      id: "auth-user",
      email: "auth@example.com",
      emailVerified: null,
      name: "Auth User",
      image: null,
    });
    await adapter.linkAccount!({
      userId: user.id,
      type: "oauth",
      provider: "github",
      providerAccountId: "provider-account",
    });
    expect(
      (
        await adapter.getUserByAccount!({
          provider: "github",
          providerAccountId: "provider-account",
        })
      )?.id,
    ).toBe(user.id);
    await adapter.createSession!({
      userId: user.id,
      sessionToken: "session-token",
      expires: new Date(Date.now() + 60_000),
    });
    expect((await adapter.getSessionAndUser!("session-token"))?.user.id).toBe(
      user.id,
    );
    await adapter.createVerificationToken!({
      identifier: user.email,
      token: "verification-token",
      expires: new Date(Date.now() + 60_000),
    });
    expect(
      (
        await adapter.useVerificationToken!({
          identifier: user.email,
          token: "verification-token",
        })
      )?.identifier,
    ).toBe(user.email);
    expect(
      await adapter.useVerificationToken!({
        identifier: user.email,
        token: "verification-token",
      }),
    ).toBeNull();
    await adapter.deleteUser!(user.id);
    expect(await adapter.getSessionAndUser!("session-token")).toBeNull();
  });

  it("rejects a safe URL paired with a different live database client", async () => {
    await expect(
      resetTestDatabase(
        connection!.client,
        "postgresql://local:local@127.0.0.1:54330/unrelated_test",
      ),
    ).rejects.toThrow("Refusing to reset");
  });

  it("rejects feedback attached to another tenant's board or author", async () => {
    await expect(
      db!.insert(schema.feedback).values({
        workspaceId: workspaceA,
        boardId: boardB,
        authorId: memberA,
        slug: "cross-board",
        title: "No",
        body: "No",
      }),
    ).rejects.toThrow();
    await expect(
      db!.insert(schema.feedback).values({
        workspaceId: workspaceA,
        boardId: boardA,
        authorId: memberB,
        slug: "cross-author",
        title: "No",
        body: "No",
      }),
    ).rejects.toThrow();
  });

  it("rejects cross-tenant votes, comments, follows, tags and redirects", async () => {
    await expect(
      db!.insert(schema.votes).values({
        workspaceId: workspaceA,
        feedbackId: feedbackA,
        memberId: memberB,
      }),
    ).rejects.toThrow();
    await expect(
      db!.insert(schema.comments).values({
        workspaceId: workspaceA,
        feedbackId: feedbackB,
        authorId: memberA,
        body: "No",
      }),
    ).rejects.toThrow();
    await expect(
      db!.insert(schema.follows).values({
        workspaceId: workspaceA,
        feedbackId: feedbackA,
        memberId: memberB,
      }),
    ).rejects.toThrow();
    await expect(
      db!.insert(schema.feedbackTags).values({
        workspaceId: workspaceA,
        feedbackId: feedbackA,
        tagId: tagB,
      }),
    ).rejects.toThrow();
    await expect(
      db!.insert(schema.feedbackRedirects).values({
        workspaceId: workspaceA,
        sourceSlug: "old",
        targetFeedbackId: feedbackB,
      }),
    ).rejects.toThrow();
  });

  it("enforces one vote per member and feedback", async () => {
    const vote = {
      workspaceId: workspaceA,
      feedbackId: feedbackA,
      memberId: memberA,
    };
    await db!.insert(schema.votes).values(vote);
    await expect(db!.insert(schema.votes).values(vote)).rejects.toThrow();
  });

  it("enforces slugs within a workspace", async () => {
    await expect(
      db!.insert(schema.feedback).values({
        workspaceId: workspaceA,
        boardId: boardA,
        authorId: memberA,
        slug: "dark-mode",
        title: "Duplicate",
        body: "No",
      }),
    ).rejects.toThrow();
  });

  it("keeps replies attached to their original tenant and feedback after soft deletion", async () => {
    const parentId = randomUUID();
    const childId = randomUUID();
    await db!.insert(schema.comments).values({
      id: parentId,
      workspaceId: workspaceA,
      feedbackId: feedbackA,
      authorId: memberA,
      body: "Original",
    });
    await db!.insert(schema.comments).values({
      id: childId,
      workspaceId: workspaceA,
      feedbackId: feedbackA,
      authorId: memberA,
      parentId,
      body: "Reply",
    });
    await expect(
      db!.insert(schema.comments).values({
        workspaceId: workspaceB,
        feedbackId: feedbackB,
        authorId: memberB,
        parentId,
        body: "Invalid parent",
      }),
    ).rejects.toThrow();
    await db!
      .update(schema.comments)
      .set({ deletedAt: new Date(), body: "" })
      .where(eq(schema.comments.id, parentId));
    expect(
      await db!
        .select()
        .from(schema.comments)
        .where(eq(schema.comments.id, childId)),
    ).toHaveLength(1);
    await expect(
      db!.delete(schema.comments).where(eq(schema.comments.id, parentId)),
    ).rejects.toThrow();
  });

  it("deduplicates notification delivery for a recipient and event", async () => {
    const value = {
      workspaceId: workspaceA,
      recipientId: memberA,
      type: "status_changed" as const,
      title: "Changed",
      eventKey: "event-one",
    };
    await db!.insert(schema.notifications).values(value);
    await expect(
      db!.insert(schema.notifications).values(value),
    ).rejects.toThrow();
  });

  it("rejects cross-tenant changelog links and notifications", async () => {
    const entryId = randomUUID();
    await db!.insert(schema.changelogEntries).values({
      id: entryId,
      workspaceId: workspaceA,
      authorId: memberA,
      slug: "release",
      title: "Release",
      body: "Done",
    });
    await expect(
      db!.insert(schema.changelogFeedback).values({
        workspaceId: workspaceA,
        changelogEntryId: entryId,
        feedbackId: feedbackB,
      }),
    ).rejects.toThrow();
    await expect(
      db!.insert(schema.notifications).values({
        workspaceId: workspaceA,
        recipientId: memberB,
        type: "status_changed",
        title: "Changed",
        eventKey: "status:event",
      }),
    ).rejects.toThrow();
    await expect(
      db!.insert(schema.activity).values({
        workspaceId: workspaceA,
        actorId: memberB,
        action: "feedback.created",
      }),
    ).rejects.toThrow();
  });

  it("stores unique hashed demo tokens and cascades workspace deletion", async () => {
    const tokenHash = "a".repeat(64);
    await db!.insert(schema.demoSessions).values({
      workspaceId: workspaceA,
      tokenHash,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await expect(
      db!.insert(schema.demoSessions).values({
        workspaceId: workspaceB,
        tokenHash,
        expiresAt: new Date(Date.now() + 60_000),
      }),
    ).rejects.toThrow();
    const [demoSession] = await db!
      .select()
      .from(schema.demoSessions)
      .where(eq(schema.demoSessions.tokenHash, tokenHash));
    await db!.insert(schema.members).values([
      {
        workspaceId: workspaceA,
        demoSessionId: demoSession.id,
        displayName: "Demo member",
        role: "member",
      },
      {
        workspaceId: workspaceA,
        demoSessionId: demoSession.id,
        displayName: "Demo moderator",
        role: "moderator",
      },
    ]);
    await expect(
      db!.insert(schema.members).values({
        workspaceId: workspaceA,
        demoSessionId: demoSession.id,
        displayName: "Duplicate",
        role: "member",
      }),
    ).rejects.toThrow();
    await db!
      .delete(schema.workspaces)
      .where(eq(schema.workspaces.id, workspaceA));
    expect(
      await db!
        .select()
        .from(schema.feedback)
        .where(eq(schema.feedback.workspaceId, workspaceA)),
    ).toHaveLength(0);
    expect(
      await db!
        .select()
        .from(schema.votes)
        .where(eq(schema.votes.workspaceId, workspaceA)),
    ).toHaveLength(0);
    expect(
      await db!
        .select()
        .from(schema.feedback)
        .where(eq(schema.feedback.workspaceId, workspaceB)),
    ).toHaveLength(1);
  });
});
