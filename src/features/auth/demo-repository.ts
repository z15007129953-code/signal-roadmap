import { randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { Database } from "../../lib/db/index.ts";
import { demoSessions, members, workspaces } from "../../lib/db/schema.ts";
import type { DemoRepository } from "./demo-session.ts";
import { seedWorkspace } from "../demo/seed.ts";

export function createDemoRepository(db: Database): DemoRepository {
  return {
    async create({ tokenHash, expiresAt }) {
      return db.transaction(async (tx) => {
        const id = randomUUID();
        const slug = `demo-${id}`;
        await tx.insert(workspaces).values({
          id,
          slug,
          name: "Your community sandbox",
          description:
            "An isolated space to try Signal Roadmap. This demo expires in 24 hours.",
          isDemo: true,
        });
        const [session] = await tx
          .insert(demoSessions)
          .values({ workspaceId: id, tokenHash, expiresAt })
          .returning();
        const memberId = randomUUID();
        const moderatorId = randomUUID();
        await tx.insert(members).values([
          {
            id: memberId,
            workspaceId: id,
            demoSessionId: session.id,
            displayName: "Demo member",
            role: "member",
          },
          {
            id: moderatorId,
            workspaceId: id,
            demoSessionId: session.id,
            displayName: "Demo moderator",
            role: "moderator",
          },
        ]);
        await seedWorkspace(tx, { workspaceId: id, memberId, moderatorId });
        return { workspaceId: id, slug };
      });
    },
    async findPersona(tokenHash, persona) {
      const [record] = await db
        .select({
          workspaceId: workspaces.id,
          slug: workspaces.slug,
          expiresAt: demoSessions.expiresAt,
        })
        .from(demoSessions)
        .innerJoin(workspaces, eq(workspaces.id, demoSessions.workspaceId))
        .innerJoin(
          members,
          and(
            eq(members.demoSessionId, demoSessions.id),
            eq(members.workspaceId, workspaces.id),
          ),
        )
        .where(
          and(
            eq(demoSessions.tokenHash, tokenHash),
            eq(members.role, persona),
            isNull(members.userId),
            eq(workspaces.isDemo, true),
          ),
        )
        .limit(1);
      return record ?? null;
    },
    async deleteExpiredBatch(now, limit) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 100)
        throw new Error("Invalid cleanup batch size");
      // Row locks let concurrent workers claim disjoint batches. Never remove a
      // real/showcase workspace or a demo with any still-active session.
      const timestamp = now.toISOString();
      const result = await db.execute(sql`
        WITH candidates AS (
          SELECT w.id FROM workspaces w
          WHERE w.is_demo = true AND w.is_showcase = false
            AND EXISTS (SELECT 1 FROM demo_sessions s WHERE s.workspace_id = w.id AND s.expires_at <= ${timestamp}::timestamptz)
            AND NOT EXISTS (SELECT 1 FROM demo_sessions s WHERE s.workspace_id = w.id AND s.expires_at > ${timestamp}::timestamptz)
          ORDER BY w.created_at, w.id LIMIT ${limit} FOR UPDATE OF w SKIP LOCKED
        ), deleted AS (
          DELETE FROM workspaces WHERE id IN (SELECT id FROM candidates) RETURNING id
        ) SELECT count(*)::integer AS deleted FROM deleted
      `);
      return Number(result[0].deleted);
    },
  };
}
