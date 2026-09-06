import { and, asc, eq, gt, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "@/lib/db";
import { boards, feedback, members, tags, workspaces } from "@/lib/db/schema";
import { domainError } from "@/lib/http/errors";
import { err, ok, type Result } from "@/lib/http/result";
import {
  engagementAccess,
  isEngagementModerator,
  type EngagementAccess,
  type EngagementTransaction,
} from "../feedback/engagement-access";
import type { FeedbackActor } from "../feedback/types";
import {
  brandingSchema,
  boardSchema,
  tagSchema,
  memberQuerySchema,
  roleSchema,
  logoKeySchema,
} from "./settings-schema";
import type { SettingsRepository, SettingsMember } from "./settings-types";

const invalid = () => err(domainError("VALIDATION_FAILED"));
const conflict = () => err(domainError("CONFLICT"));
const notFound = () => err(domainError("NOT_FOUND"));
const brandingFields = {
  id: workspaces.id,
  name: workspaces.name,
  description: workspaces.description,
  accentColor: workspaces.accentColor,
  logoKey: workspaces.logoKey,
};
const memberFields = {
  id: members.id,
  displayName: members.displayName,
  role: members.role,
};
const activeAccounts = (w: string) =>
  and(
    eq(members.workspaceId, w),
    isNotNull(members.userId),
    isNull(members.demoSessionId),
  );
function isConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: string; cause?: unknown };
  return (
    ["23505", "23503", "40001", "40P01"].includes(value.code ?? "") ||
    (!!value.cause && isConflict(value.cause))
  );
}
export function createSettingsRepository(db: Database): SettingsRepository {
  async function authorized<T>(
    a: FeedbackActor,
    w: string,
    write: boolean,
    ownerOnly: boolean,
    call: (
      tx: EngagementTransaction,
      access: EngagementAccess,
    ) => Promise<Result<T>>,
  ): Promise<Result<T>> {
    try {
      // READ COMMITTED refreshes the snapshot after the workspace lock is acquired.
      // Every settings mutation locks workspace first, then members/taxonomy rows.
      return await db.transaction(
        async (tx) => {
          const access = await engagementAccess(tx, a, w, write, true);
          if (!access.ok) return access;
          if (
            ownerOnly
              ? access.value.role !== "owner"
              : !isEngagementModerator(access.value.role)
          )
            return err(domainError("FORBIDDEN"));
          return call(tx, access.value);
        },
        { isolationLevel: "read committed" },
      );
    } catch (error) {
      if (isConflict(error)) return conflict();
      throw error;
    }
  }
  async function updateBranding(
    a: FeedbackActor,
    w: string,
    fields: {
      name?: string;
      description?: string | null;
      accentColor?: string | null;
      logoKey?: string | null;
    },
  ) {
    return authorized(a, w, true, true, async (tx) => {
      const [updated] = await tx
        .update(workspaces)
        .set(fields)
        .where(eq(workspaces.id, w))
        .returning(brandingFields);
      return ok(updated);
    });
  }
  return {
    async get(a, w, input = { search: "", limit: 20 }) {
      const parsed = memberQuerySchema.safeParse(input);
      if (!parsed.success) return invalid();
      return authorized(a, w, false, false, async (tx, access) => {
        const [workspace] = await tx
          .select(brandingFields)
          .from(workspaces)
          .where(eq(workspaces.id, w));
        const boardRows = await tx
          .select()
          .from(boards)
          .where(eq(boards.workspaceId, w))
          .orderBy(asc(boards.position), asc(boards.id));
        const tagRows = await tx
          .select()
          .from(tags)
          .where(eq(tags.workspaceId, w))
          .orderBy(asc(tags.name), asc(tags.id));
        let memberRows: SettingsMember[] = [];
        if (access.role === "owner" && !access.isDemo) {
          const { search, cursor, limit } = parsed.data;
          memberRows = await tx
            .select(memberFields)
            .from(members)
            .where(
              and(
                activeAccounts(w),
                cursor ? gt(members.id, cursor) : undefined,
                search
                  ? sql`strpos(lower(${members.displayName}), lower(${search})) > 0`
                  : undefined,
              ),
            )
            .orderBy(asc(members.id))
            .limit(limit + 1);
        }
        const items = memberRows.slice(0, parsed.data.limit);
        return ok({
          workspace,
          role: access.role!,
          isDemo: access.isDemo,
          boards: boardRows,
          tags: tagRows,
          members: {
            items,
            nextCursor:
              memberRows.length > parsed.data.limit ? items.at(-1)!.id : null,
          },
        });
      });
    },
    async branding(a, w, input) {
      const parsed = brandingSchema.safeParse(input);
      return parsed.success ? updateBranding(a, w, parsed.data) : invalid();
    },
    async setLogo(a, w, key) {
      const parsed = logoKeySchema(w).safeParse(key);
      return parsed.success
        ? updateBranding(a, w, { logoKey: parsed.data })
        : invalid();
    },
    async saveBoard(a, w, input) {
      const parsed = boardSchema.safeParse(input);
      if (!parsed.success) return invalid();
      const { id, ...fields } = parsed.data;
      return authorized(a, w, true, false, async (tx, access) => {
        if (id) {
          const [existing] = await tx
            .select({ id: boards.id })
            .from(boards)
            .where(and(eq(boards.workspaceId, w), eq(boards.id, id)))
            .for("update");
          if (!existing) return notFound();
        }
        const [duplicate] = await tx
          .select({ id: boards.id })
          .from(boards)
          .where(
            and(
              eq(boards.workspaceId, w),
              sql`lower(${boards.slug}) = lower(${fields.slug})`,
              id ? ne(boards.id, id) : undefined,
            ),
          )
          .limit(1);
        if (duplicate) return conflict();
        if (!id && access.isDemo) {
          const [total] = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(boards)
            .where(eq(boards.workspaceId, w));
          if (total.count >= 10) return err(domainError("DEMO_QUOTA_EXCEEDED"));
        }
        const [saved] = id
          ? await tx
              .update(boards)
              .set(fields)
              .where(and(eq(boards.workspaceId, w), eq(boards.id, id)))
              .returning()
          : await tx
              .insert(boards)
              .values({ workspaceId: w, ...fields })
              .returning();
        return ok(saved);
      });
    },
    async deleteBoard(a, w, id) {
      if (!z.uuid().safeParse(id).success) return invalid();
      return authorized(a, w, true, false, async (tx) => {
        const [board] = await tx
          .select({ id: boards.id })
          .from(boards)
          .where(and(eq(boards.workspaceId, w), eq(boards.id, id)))
          .for("update");
        if (!board) return notFound();
        const [item] = await tx
          .select({ id: feedback.id })
          .from(feedback)
          .where(and(eq(feedback.workspaceId, w), eq(feedback.boardId, id)))
          .limit(1);
        if (item) return conflict();
        await tx
          .delete(boards)
          .where(and(eq(boards.workspaceId, w), eq(boards.id, id)));
        return ok({ id });
      });
    },
    async saveTag(a, w, input) {
      const parsed = tagSchema.safeParse(input);
      if (!parsed.success) return invalid();
      const { id, ...fields } = parsed.data;
      return authorized(a, w, true, false, async (tx, access) => {
        if (id) {
          const [existing] = await tx
            .select({ id: tags.id })
            .from(tags)
            .where(and(eq(tags.workspaceId, w), eq(tags.id, id)))
            .for("update");
          if (!existing) return notFound();
        }
        const [duplicate] = await tx
          .select({ id: tags.id })
          .from(tags)
          .where(
            and(
              eq(tags.workspaceId, w),
              or(
                sql`lower(${tags.name}) = lower(${fields.name})`,
                sql`lower(${tags.slug}) = lower(${fields.slug})`,
              ),
              id ? ne(tags.id, id) : undefined,
            ),
          )
          .limit(1);
        if (duplicate) return conflict();
        if (!id && access.isDemo) {
          const [total] = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(tags)
            .where(eq(tags.workspaceId, w));
          if (total.count >= 30) return err(domainError("DEMO_QUOTA_EXCEEDED"));
        }
        const [saved] = id
          ? await tx
              .update(tags)
              .set(fields)
              .where(and(eq(tags.workspaceId, w), eq(tags.id, id)))
              .returning()
          : await tx
              .insert(tags)
              .values({ workspaceId: w, ...fields })
              .returning();
        return ok(saved);
      });
    },
    async deleteTag(a, w, id) {
      if (!z.uuid().safeParse(id).success) return invalid();
      return authorized(a, w, true, false, async (tx) => {
        const [tag] = await tx
          .select({ id: tags.id })
          .from(tags)
          .where(and(eq(tags.workspaceId, w), eq(tags.id, id)))
          .for("update");
        if (!tag) return notFound();
        await tx
          .delete(tags)
          .where(and(eq(tags.workspaceId, w), eq(tags.id, id)));
        return ok({ id });
      });
    },
    async changeRole(a, w, input) {
      const parsed = roleSchema.safeParse(input);
      if (!parsed.success) return invalid();
      return authorized(a, w, true, true, async (tx, access) => {
        if (access.isDemo || a?.kind !== "account")
          return err(domainError("FORBIDDEN"));
        const { memberId, role } = parsed.data;
        const [target] = await tx
          .select(memberFields)
          .from(members)
          .where(and(activeAccounts(w), eq(members.id, memberId)))
          .for("update");
        if (!target) return notFound();
        if (target.role === role) return ok(target);
        if (target.role === "owner" && role !== "owner") {
          const [total] = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(members)
            .where(and(activeAccounts(w), eq(members.role, "owner")));
          if (total.count <= 1) return conflict();
        }
        const [updated] = await tx
          .update(members)
          .set({ role })
          .where(and(activeAccounts(w), eq(members.id, memberId)))
          .returning(memberFields);
        return ok(updated);
      });
    },
  };
}
