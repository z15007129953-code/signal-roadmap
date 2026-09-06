// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
const limit = vi.hoisted(() => vi.fn());
vi.mock("@upstash/redis", () => ({ Redis: class {} }));
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static fixedWindow() {
      return {};
    }
    limit = limit;
  },
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  limit.mockReset();
});
it("rejects the SDK's fail-open timeout response", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "fake-token");
  limit.mockResolvedValue({
    success: true,
    reset: Date.now() + 60000,
    reason: "timeout",
  });
  const { runtimeLimiter } = await import("./rate-runtime");
  await expect(
    runtimeLimiter.check("demo:a", "vote", 30, 60000),
  ).rejects.toThrow("Rate limiting unavailable");
});
it("passes actual allowed and blocked Redis decisions through", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "fake-token");
  limit
    .mockResolvedValueOnce({ success: true, reset: 1000 })
    .mockResolvedValueOnce({ success: false, reset: 1000 });
  const { runtimeLimiter } = await import("./rate-runtime");
  expect(await runtimeLimiter.check("demo:a", "vote", 30, 60000)).toEqual({
    allowed: true,
    reset: 1000,
  });
  expect(await runtimeLimiter.check("demo:a", "vote", 30, 60000)).toEqual({
    allowed: false,
    reset: 1000,
  });
});
