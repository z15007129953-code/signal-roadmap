import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { createRateLimiter, type RateCheck } from "./rate-limit";

function remoteAdapter(): RateCheck | undefined {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (
    !url ||
    !token ||
    !URL.canParse(url) ||
    new URL(url).protocol !== "https:"
  )
    return;
  const redis = new Redis({ url, token, retry: { retries: 0 } });
  const limiters = new Map<string, Ratelimit>();
  return async (subject, route, limit, windowMs) => {
    const key = `${route}:${limit}:${windowMs}`;
    let limiter = limiters.get(key);
    if (!limiter) {
      limiter = new Ratelimit({
        redis,
        limiter: Ratelimit.fixedWindow(limit, `${windowMs} ms`),
        prefix: `signal:rate:${key}`,
        analytics: false,
        ephemeralCache: false,
        timeout: 3000,
      });
      limiters.set(key, limiter);
    }
    const result = await limiter.limit(subject);
    // The SDK timeout is fail-open by default; never accept it as an authorization.
    if (result.reason === "timeout")
      throw new Error("Rate limiting unavailable");
    return { allowed: result.success, reset: result.reset };
  };
}

export const runtimeLimiter = createRateLimiter({
  production: process.env.NODE_ENV === "production",
  remote: remoteAdapter(),
});
