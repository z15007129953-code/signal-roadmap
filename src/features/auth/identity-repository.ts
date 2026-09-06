import { and, eq, isNull } from "drizzle-orm";
import type { Database } from "@/lib/db";
import { demoSessions, members, workspaces } from "@/lib/db/schema";
import type { IdentityRepository } from "./resolve-actor";

const membershipColumns = {
  memberId: members.id,
  workspaceId: members.workspaceId,
  userId: members.userId,
  role: members.role,
};

export function createIdentityRepository(db: Database): IdentityRepository {
  return {
    async findAccount(userId, workspaceId) {
      const [member] = await db
        .select(membershipColumns)
        .from(members)
        .where(
          and(
            eq(members.userId, userId),
            eq(members.workspaceId, workspaceId),
            isNull(members.demoSessionId),
          ),
        )
        .limit(1);
      return member ?? null;
    },
    async findDemo(tokenHash, persona) {
      const [member] = await db
        .select({ ...membershipColumns, expiresAt: demoSessions.expiresAt })
        .from(demoSessions)
        .innerJoin(
          members,
          and(
            eq(members.demoSessionId, demoSessions.id),
            eq(members.workspaceId, demoSessions.workspaceId),
          ),
        )
        .innerJoin(workspaces, eq(workspaces.id, demoSessions.workspaceId))
        .where(
          and(
            eq(demoSessions.tokenHash, tokenHash),
            eq(members.role, persona),
            isNull(members.userId),
            eq(workspaces.isDemo, true),
          ),
        )
        .limit(1);
      return member ?? null;
    },
  };
}
