import { z } from "zod";
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const brandingSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(500).nullable(),
    accentColor: hex.nullable(),
  })
  .strict();
export const boardSchema = z
  .object({
    id: z.uuid().optional(),
    name: z.string().trim().min(1).max(80),
    slug,
    description: z.string().trim().max(500).nullable().default(null),
    position: z.number().int().min(0).max(9999).default(0),
  })
  .strict();
export const tagSchema = z
  .object({
    id: z.uuid().optional(),
    name: z.string().trim().min(1).max(40),
    slug,
    color: hex,
  })
  .strict();
export const memberQuerySchema = z
  .object({
    search: z.string().trim().max(100).default(""),
    cursor: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(20).default(20),
  })
  .strict();
export const roleSchema = z
  .object({
    memberId: z.uuid(),
    role: z.enum(["member", "moderator", "owner"]),
  })
  .strict();
export const logoKeySchema = (workspaceId: string) =>
  z
    .string()
    .refine((key) => {
      const prefix = `${workspaceId}/logos/`;
      if (!key.startsWith(prefix)) return false;
      const match = /^([0-9a-fA-F-]+)\.(png|jpg|webp|svg)$/.exec(
        key.slice(prefix.length),
      );
      return !!match && z.uuid().safeParse(match[1]).success;
    })
    .nullable();
