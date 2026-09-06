import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  gt,
  lt,
  or,
  sql,
} from "drizzle-orm";
import type { Database } from "@/lib/db";
import { feedback } from "@/lib/db/schema";
import { domainError } from "@/lib/http/errors";
import { err, ok } from "@/lib/http/result";
import { engagementAccess } from "../feedback/engagement-access";
import { decodeRoadmapCursor, roadmapListSchema } from "./schema";
import type { RoadmapRepository } from "./types";
export function createRoadmapRepository(db: Database): RoadmapRepository {
  return {
    async list(actor, w, input) {
      const parsed = roadmapListSchema.safeParse(input);
      if (!parsed.success) return err(domainError("VALIDATION_FAILED"));
      return db.transaction(async (tx) => {
        const allowed = await engagementAccess(tx, actor, w);
        if (!allowed.ok) return allowed;
        const { status, limit } = parsed.data;
        const cursor = parsed.data.cursor
          ? decodeRoadmapCursor(parsed.data.cursor)
          : null;
        const rows = await tx
          .select({
            ...getTableColumns(feedback),
            cursorTime: sql<string>`to_char(${feedback.updatedAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
          })
          .from(feedback)
          .where(
            and(
              eq(feedback.workspaceId, w),
              eq(feedback.visibility, "published"),
              eq(feedback.status, status),
              cursor
                ? or(
                    gt(feedback.manualRank, cursor.rank),
                    and(
                      eq(feedback.manualRank, cursor.rank),
                      or(
                        sql`${feedback.updatedAt} < ${cursor.time}::timestamptz`,
                        and(
                          sql`${feedback.updatedAt} = ${cursor.time}::timestamptz`,
                          lt(feedback.id, cursor.id),
                        ),
                      ),
                    ),
                  )
                : undefined,
            ),
          )
          .orderBy(
            asc(feedback.manualRank),
            desc(feedback.updatedAt),
            desc(feedback.id),
          )
          .limit(limit + 1);
        const page = rows.slice(0, limit),
          last = page.at(-1);
        return ok({
          items: page.map((item) => ({
            id: item.id,
            slug: item.slug,
            title: item.title,
            body: item.body,
            status: item.status,
            visibility: item.visibility,
            createdAt: item.createdAt,
            authorId: item.authorId,
            boardId: item.boardId,
            manualRank: item.manualRank,
            updatedAt: item.updatedAt,
          })),
          nextCursor:
            rows.length > limit && last
              ? Buffer.from(
                  JSON.stringify({
                    rank: last.manualRank,
                    time: last.cursorTime,
                    id: last.id,
                    status,
                  }),
                ).toString("base64url")
              : null,
        });
      });
    },
  };
}
