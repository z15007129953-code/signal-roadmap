import { z } from "zod";
import type { FeedbackCursor } from "./types";

export const createFeedbackSchema = z.strictObject({
  title: z.string().trim().min(5).max(140),
  description: z.string().trim().min(10).max(10000),
  boardId: z.uuid(),
  tagIds: z
    .array(z.uuid())
    .max(5)
    .refine((ids) => new Set(ids).size === ids.length)
    .default([]),
});
const cursorSchema = z.strictObject({
  // Retain PostgreSQL microseconds: converting to JS Date would lose precision.
  createdAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3,6}Z$/)
    .refine((value) => {
      const milliseconds = Date.parse(value);
      if (!Number.isFinite(milliseconds) || value.startsWith("0000-"))
        return false;
      // Date.parse normalizes dates such as February 30. Compare all calendar
      // and time components after parsing, while retaining the input fraction.
      return (
        new Date(milliseconds).toISOString().slice(0, 19) === value.slice(0, 19)
      );
    }),
  id: z.uuid(),
});
export function encodeCursor(cursor: {
  createdAt: Date | string;
  id: string;
}): string {
  return Buffer.from(
    JSON.stringify({
      ...cursor,
      createdAt:
        cursor.createdAt instanceof Date
          ? cursor.createdAt.toISOString()
          : cursor.createdAt,
    }),
  ).toString("base64url");
}
export function decodeCursor(value: string): FeedbackCursor | null {
  try {
    if (!/^[A-Za-z0-9_-]{1,512}$/.test(value)) return null;
    const parsed = cursorSchema.safeParse(
      JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
export const feedbackFiltersSchema = z.strictObject({
  boardId: z.uuid().optional(),
  tagId: z.uuid().optional(),
  status: z
    .enum(["under_review", "planned", "in_progress", "completed", "closed"])
    .optional(),
  query: z.string().trim().max(140).optional(),
  visibility: z.enum(["published", "pending"]).default("published"),
  cursor: z
    .string()
    .max(512)
    .refine((value) => decodeCursor(value) !== null)
    .optional(),
  limit: z.number().int().min(1).max(100).default(20),
});
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}
export function feedbackSlug(title: string, id: string): string {
  const prefix = title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70)
    .replace(/-$/, "");
  return `${prefix || "feedback"}-${id}`;
}
