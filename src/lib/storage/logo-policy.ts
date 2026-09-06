import { randomUUID } from "node:crypto";
import { z } from "zod";
export const logoTypes = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
] as const;
export type LogoType = (typeof logoTypes)[number];
export const maxLogoBytes = 2 * 1024 * 1024;
export const logoUploadSchema = z.strictObject({
  type: z.enum(logoTypes),
  size: z.number().int().min(1).max(maxLogoBytes),
});
const extensions: Record<LogoType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};
export function logoKeyFor(workspace: string, type: LogoType) {
  return `${z.uuid().parse(workspace)}/logos/${randomUUID()}.${extensions[type]}`;
}
export function isWorkspaceLogoKey(workspace: string, key: string) {
  return (
    z.uuid().safeParse(workspace).success &&
    key.startsWith(`${workspace}/logos/`) &&
    /^[0-9a-f-]{36}\/logos\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpg|webp|svg)$/.test(
      key,
    )
  );
}
export function logoResponseHeaders(type: LogoType) {
  return {
    "Content-Type": type,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy":
      "default-src 'none'; sandbox; frame-ancestors 'none'",
    "Cache-Control": "private, no-store",
    "Cross-Origin-Resource-Policy": "same-origin",
  };
}
