// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createDatabase } from "@/lib/db";
import { assertSafeTestDatabaseUrl } from "@/lib/env";
import { createNotificationRepository } from "@/features/notifications/notification-repository";
import * as s from "@/lib/db/schema";
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(
  !url || process.env.CHANGELOG_NOTIFICATION_DATABASE_TEST !== "1",
)("published changelog notification visibility", () => {
  const connection = url
    ? createDatabase(assertSafeTestDatabaseUrl(url))
    : undefined;
  const w = randomUUID(),
    u = randomUUID(),
    memberId = randomUUID(),
    entryId = randomUUID(),
    noteId = randomUUID();
  const actor = {
    kind: "account" as const,
    workspaceId: w,
    userId: u,
    memberId,
    role: "owner" as const,
  };
  beforeAll(async () => {
    const db = connection!.db;
    await db.insert(s.users).values({ id: u });
    await db
      .insert(s.workspaces)
      .values({ id: w, slug: w, name: "Release tests" });
    await db.insert(s.members).values({
      id: memberId,
      workspaceId: w,
      userId: u,
      role: "owner",
      displayName: "Owner",
    });
    await db.insert(s.changelogEntries).values({
      id: entryId,
      workspaceId: w,
      authorId: memberId,
      slug: "release",
      title: "Release",
      body: "Shipped a useful feature",
      publishedAt: new Date(),
    });
    await db.insert(s.notifications).values({
      id: noteId,
      workspaceId: w,
      recipientId: memberId,
      changelogEntryId: entryId,
      type: "changelog_published",
      eventKey: "release-test",
      title: "Release",
    });
  });
  afterAll(async () => {
    if (connection) {
      await connection.db.delete(s.workspaces).where(eq(s.workspaces.id, w));
      await connection.db.delete(s.users).where(eq(s.users.id, u));
      await connection.client.end();
    }
  });
  it("links published changelog updates and suppresses them when unpublished", async () => {
    const repo = createNotificationRepository(connection!.db);
    expect(await repo.list(actor, w, { limit: 20 })).toMatchObject({
      value: {
        unreadCount: 1,
        items: [{ id: noteId, changelogSlug: "release" }],
      },
    });
    expect(await repo.markRead(actor, w, noteId)).toMatchObject({ ok: true });
    await connection!.db
      .update(s.changelogEntries)
      .set({ publishedAt: null })
      .where(eq(s.changelogEntries.id, entryId));
    expect(await repo.list(actor, w, { limit: 20 })).toMatchObject({
      value: { unreadCount: 0, items: [] },
    });
    expect(await repo.markRead(actor, w, noteId)).toMatchObject({
      error: { code: "NOT_FOUND" },
    });
  });
});
