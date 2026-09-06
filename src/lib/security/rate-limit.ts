import { createHash } from "node:crypto";
import { isIP } from "node:net";

export type RateDecision = { allowed: boolean; reset: number };
export type RateCheck = (
  subject: string,
  route: string,
  limit: number,
  windowMs: number,
) => Promise<RateDecision>;

export function createMemoryLimiter(now = Date.now, capacity = 10000) {
  const buckets = new Map<string, { count: number; reset: number }>();
  const check: RateCheck = async (subject, route, limit, windowMs) => {
    const time = now();
    const key = JSON.stringify([subject, route]);
    let bucket = buckets.get(key);
    if (!bucket || bucket.reset <= time) {
      for (const [id, value] of buckets) {
        if (value.reset <= time) buckets.delete(id);
      }
      // Never evict active buckets: that would let callers reset their limits.
      if (buckets.size >= capacity)
        return { allowed: false, reset: time + windowMs };
      bucket = { count: 0, reset: time + windowMs };
      buckets.set(key, bucket);
    }
    if (bucket.count >= limit) return { allowed: false, reset: bucket.reset };
    bucket.count += 1;
    return { allowed: true, reset: bucket.reset };
  };
  return { check };
}

export function createRateLimiter(options: {
  production: boolean;
  remote?: RateCheck;
}) {
  const memory = createMemoryLimiter();
  const check: RateCheck = async (...args) => {
    if (!options.production) return memory.check(...args);
    try {
      if (!options.remote) throw new Error();
      return await options.remote(...args);
    } catch {
      throw new Error("Rate limiting unavailable");
    }
  };
  return { check };
}

export function rateSubject(
  request: Request,
  identity: { kind: "demo" | "user"; id: string } | null,
  trustVercelProxy: boolean,
) {
  if (identity)
    return `${identity.kind}:${createHash("sha256").update(identity.id).digest("hex")}`;
  // Only enable on Vercel, which replaces this header at its trusted ingress.
  const supplied = trustVercelProxy
    ? request.headers.get("x-vercel-forwarded-for")?.trim()
    : undefined;
  const ip = supplied && isIP(supplied) ? supplied : "shared-anonymous";
  return `anonymous:${createHash("sha256").update(ip).digest("hex")}`;
}
