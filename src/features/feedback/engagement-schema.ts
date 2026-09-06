import { z } from "zod";
import { decodeCursor } from "./feedback-schema";
export const commentBodySchema = z.string().trim().min(1).max(10000);
export const commentInputSchema = z.object({
  body: commentBodySchema,
  parentId: z.uuid().nullable().optional().default(null),
});
export const commentEditSchema = z.object({ body: commentBodySchema });
export const desiredStateSchema = z.object({ active: z.boolean() });
export const engagementPageSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z
    .string()
    .max(1000)
    .refine((value) => decodeCursor(value) !== null)
    .optional(),
});
