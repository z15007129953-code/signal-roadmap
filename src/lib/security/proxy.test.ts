// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { signDemoToken } from "@/features/auth/demo-token";
import { demoCookieName } from "@/features/auth/demo-session";
const check = vi.hoisted(() =>
  vi.fn<import("./rate-limit").RateCheck>(async () => ({
    allowed: true,
    reset: Date.now() + 60000,
  })),
);
vi.mock("./rate-runtime", () => ({ runtimeLimiter: { check } }));
import { proxy } from "@/proxy";
afterEach(() => {
  vi.unstubAllEnvs();
  check.mockClear();
});
it("generates fresh CSP nonces and propagates diagnostic IDs upstream", async () => {
  const a = await proxy(new NextRequest("https://signal.example/"));
  const b = await proxy(new NextRequest("https://signal.example/"));
  expect(a.headers.get("Content-Security-Policy")).not.toBe(
    b.headers.get("Content-Security-Policy"),
  );
  expect(a.headers.get("x-middleware-request-x-request-id")).toBe(
    a.headers.get("x-request-id"),
  );
  expect(check).not.toHaveBeenCalled();
});
it("counts workspace document reads even when a caller claims to prefetch", async () => {
  await proxy(
    new NextRequest("https://signal.example/signal-roadmap/feedback", {
      headers: { purpose: "prefetch" },
    }),
  );
  expect(check).toHaveBeenCalledTimes(2);
});
it("returns a navigable recovery page for denied document and RSC reads", async () => {
  check.mockResolvedValueOnce({ allowed: false, reset: Date.now() + 30000 });
  const response = await proxy(
    new NextRequest("https://signal.example/signal-roadmap/feedback", {
      headers: { rsc: "1" },
    }),
  );
  expect(response.status).toBe(429);
  expect(response.headers.get("Content-Type")).toContain("text/html");
  expect(await response.text()).toContain('href="/"');
});
it("uses the same signed bearer quota across personas, including forged prefetch headers", async () => {
  vi.stubEnv("DEMO_COOKIE_SECRET", "s".repeat(32));
  const token = "b".repeat(43);
  for (const persona of ["member", "moderator"] as const)
    await proxy(
      new NextRequest("https://signal.example/api/demo/persona", {
        method: "POST",
        headers: {
          cookie: `${demoCookieName}=${signDemoToken(token, persona, "s".repeat(32))}`,
          purpose: "prefetch",
        },
      }),
    );
  expect(check.mock.calls).toHaveLength(4);
  expect(check.mock.calls[0][0]).toBe(check.mock.calls[2][0]);
});
it("does not let a signed demo bypass the anonymous demo-creation bucket", async () => {
  vi.stubEnv("DEMO_COOKIE_SECRET", "s".repeat(32));
  await proxy(
    new NextRequest("https://signal.example/api/demo/start", {
      method: "POST",
      headers: {
        cookie: `${demoCookieName}=${signDemoToken("b".repeat(43), "member", "s".repeat(32))}`,
      },
    }),
  );
  expect(check.mock.calls[0][0]).toMatch(/^anonymous:/);
});
it("returns a sanitized unavailable response when limiting fails", async () => {
  check.mockRejectedValueOnce(Error("private-token"));
  const response = await proxy(
    new NextRequest("https://signal.example/api/demo/start", {
      method: "POST",
    }),
  );
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("private-token");
});
