// @vitest-environment node
import { expect, it } from "vitest";
import {
  createMemoryLimiter,
  createRateLimiter,
  rateSubject,
} from "./rate-limit";
it("separates trusted identities and routes and resets expired windows", async () => {
  let now = 1000;
  const limiter = createMemoryLimiter(() => now);
  expect((await limiter.check("member-a", "vote", 2, 60000)).allowed).toBe(
    true,
  );
  expect((await limiter.check("member-a", "vote", 2, 60000)).allowed).toBe(
    true,
  );
  expect(await limiter.check("member-a", "vote", 2, 60000)).toMatchObject({
    allowed: false,
    reset: 61000,
  });
  expect((await limiter.check("member-b", "vote", 2, 60000)).allowed).toBe(
    true,
  );
  expect((await limiter.check("member-a", "comment", 2, 60000)).allowed).toBe(
    true,
  );
  now = 61000;
  expect((await limiter.check("member-a", "vote", 2, 60000)).allowed).toBe(
    true,
  );
});
it("uses verified demo token identity rather than persona or client workspace claims", () => {
  const request = new Request("https://signal.example/api?workspace=forged", {
    headers: { "x-workspace-id": "forged", "x-forwarded-for": "198.51.100.1" },
  });
  expect(
    rateSubject(request, { kind: "demo", id: "verified-session" }, false),
  ).toBe(rateSubject(request, { kind: "demo", id: "verified-session" }, true));
  expect(rateSubject(request, null, false)).toBe(
    rateSubject(new Request("https://signal.example"), null, false),
  );
});
it("fails closed without production Redis configuration", async () => {
  const limiter = createRateLimiter({ production: true });
  await expect(limiter.check("identity", "route", 60, 60000)).rejects.toThrow(
    "Rate limiting unavailable",
  );
});
it("never falls back to memory after a production Redis failure", async () => {
  const limiter = createRateLimiter({
    production: true,
    remote: async () => {
      throw Error("secret-token");
    },
  });
  await expect(limiter.check("identity", "route", 60, 60000)).rejects.toThrow(
    "Rate limiting unavailable",
  );
});
