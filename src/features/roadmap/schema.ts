import { z } from "zod";
import { decodeCursor } from "../feedback/feedback-schema";

const limit = z.number().int().min(1).max(20).default(20);
export function decodeRoadmapCursor(value: string) {
  try {
    if (!/^[A-Za-z0-9_-]{1,768}$/.test(value)) return null;
    const parsed = z
      .strictObject({
        rank: z.number().int().min(-2147483648).max(2147483647),
        time: z.string(),
        id: z.uuid(),
        status: z.enum([
          "under_review",
          "planned",
          "in_progress",
          "completed",
          "closed",
        ]),
      })
      .safeParse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
    if (!parsed.success) return null;
    const { time, id } = parsed.data;
    return decodeCursor(
      Buffer.from(JSON.stringify({ createdAt: time, id })).toString(
        "base64url",
      ),
    )
      ? parsed.data
      : null;
  } catch {
    return null;
  }
}
export const roadmapListSchema = z
  .strictObject({
    status: z.enum([
      "under_review",
      "planned",
      "in_progress",
      "completed",
      "closed",
    ]),
    cursor: z
      .string()
      .max(768)
      .refine((value) => decodeRoadmapCursor(value) !== null)
      .optional(),
    limit,
  })
  .refine(
    (value) =>
      !value.cursor ||
      decodeRoadmapCursor(value.cursor)?.status === value.status,
  );
export const changelogListSchema = z.strictObject({
  visibility: z.enum(["published", "draft"]),
  cursor: z
    .string()
    .max(512)
    .refine((value) => decodeCursor(value) !== null)
    .optional(),
  limit,
});
export const changelogInputSchema = z.strictObject({
  title: z.string().trim().min(5).max(140),
  summary: z.string().trim().max(300).default(""),
  body: z.string().trim().max(10000).default(""),
  feedbackIds: z
    .array(z.uuid())
    .max(20)
    .refine((ids) => new Set(ids).size === ids.length)
    .default([]),
});
export const changelogSlugSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const completedQuerySchema = z.string().trim().max(140).default("");
