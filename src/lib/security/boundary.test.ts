// @vitest-environment node
import { expect, it } from "vitest";
import { createMemoryLimiter } from "./rate-limit";
import { checkBoundary, routePolicy } from "./boundary";
import { requestId, safeLogContext } from "./request-id";
import { securityHeaders } from "./headers";

it("bounds memory without evicting an active quota", async () => {
  const limiter = createMemoryLimiter(() => 1000, 1);
  await limiter.check("a", "write", 1, 60000);
  expect((await limiter.check("b", "write", 1, 60000)).allowed).toBe(false);
  expect((await limiter.check("a", "write", 1, 60000)).allowed).toBe(false);
});
it("uses bounded route families, not user-controlled path segments", () => {
  expect(routePolicy("/api/workspaces/a/feedback/x/vote", "POST")).toEqual(
    routePolicy("/api/workspaces/b/feedback/y/vote", "POST"),
  );
  expect(routePolicy("/api/demo/start", "POST").limit).toBe(5);
  expect(routePolicy("/login", "POST").route).toBe("auth-write");
});
it("enforces the aggregate demo quota across routes", async () => {
  const limiter = createMemoryLimiter(() => 1000);
  const request = new Request(
    "https://signal.example/api/workspaces/a/feedback/x/vote",
    { method: "POST" },
  );
  for (let i = 0; i < 60; i++)
    await limiter.check("demo:a", "aggregate", 60, 60000);
  const response = await checkBoundary(
    request,
    "demo:a",
    limiter.check,
    "request-1234",
  );
  expect(response?.status).toBe(429);
  expect(response?.headers.has("Retry-After")).toBe(true);
  expect((await response?.json()).error.requestId).toBe("request-1234");
});
it("only accepts bounded diagnostic IDs and allowlisted nonprivate context", () => {
  expect(requestId("request-1234")).toBe("request-1234");
  expect(requestId("person@example.com")).not.toContain("@");
  expect(
    safeLogContext({
      requestId: "request-1234",
      code: "UNAVAILABLE",
      email: "private@example.com",
      cookie: "secret",
      body: "private",
      error: Error("secret"),
      route: "/?token=secret",
    }),
  ).toEqual({ requestId: "request-1234", code: "UNAVAILABLE" });
});
it("production CSP forbids executable inline code and only permits exact upload origin", () => {
  const headers = securityHeaders({
    nonce: "test-nonce",
    production: true,
    r2Account: "a".repeat(32),
  });
  const csp = headers["Content-Security-Policy"];
  expect(csp).toContain(
    "script-src 'self' 'nonce-test-nonce' 'strict-dynamic'",
  );
  expect(csp).not.toContain("unsafe-eval");
  expect(csp).toContain(`https://${"a".repeat(32)}.r2.cloudflarestorage.com`);
  expect(headers["Strict-Transport-Security"]).toBeTruthy();
  expect(
    securityHeaders({ nonce: "test", production: false })[
      "Strict-Transport-Security"
    ],
  ).toBeUndefined();
});
