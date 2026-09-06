import { z } from "zod";
import { engagementPageSchema } from "./engagement-schema";
export const moderationStatusSchema = z
  .object({
    status: z.enum([
      "under_review",
      "planned",
      "in_progress",
      "completed",
      "closed",
    ]),
  })
  .strict();
export const moderationTaxonomySchema = z
  .object({
    boardId: z.uuid(),
    tagIds: z
      .array(z.uuid())
      .max(5)
      .refine((ids) => new Set(ids).size === ids.length),
  })
  .strict();
export const moderationMergeSchema = z.object({ targetId: z.uuid() }).strict();
export const moderationSlugSchema = z.string().min(1).max(200);
export const moderationHistorySchema = engagementPageSchema.extend({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
