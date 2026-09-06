// @vitest-environment node
import { expect, it } from "vitest";
import {
  logoUploadSchema,
  logoKeyFor,
  isWorkspaceLogoKey,
  logoResponseHeaders,
} from "./logo-policy";
const workspace = "00000000-0000-4000-8000-000000000001";
it("only accepts bounded supported image declarations", () => {
  for (const type of ["image/png", "image/jpeg", "image/webp", "image/svg+xml"])
    expect(logoUploadSchema.safeParse({ type, size: 2097152 }).success).toBe(
      true,
    );
  for (const input of [
    { type: "text/html", size: 20 },
    { type: "image/png", size: 0 },
    { type: "image/png", size: 2097153 },
    { type: "image/png", size: 20, key: "chosen" },
  ])
    expect(logoUploadSchema.safeParse(input).success).toBe(false);
});
it("creates server-selected keys scoped to one verified workspace", () => {
  const key = logoKeyFor(workspace, "image/png");
  expect(isWorkspaceLogoKey(workspace, key)).toBe(true);
  for (const other of [
    key.replace(workspace, "00000000-0000-4000-8000-000000000002"),
    `${workspace}/logos/../image.png`,
    `${workspace}/logos/foo.svg`,
    `/${key}`,
    `${key}?x=1`,
  ])
    expect(isWorkspaceLogoKey(workspace, other)).toBe(false);
});
it("serves SVG with sandboxed no-script headers", () => {
  const headers = logoResponseHeaders("image/svg+xml");
  expect(headers["Content-Security-Policy"]).toContain("sandbox");
  expect(headers["Content-Security-Policy"]).toContain("default-src 'none'");
  expect(headers["X-Content-Type-Options"]).toBe("nosniff");
});
