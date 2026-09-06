import type { RateCheck } from "./rate-limit";

export function routePolicy(path: string, method: string) {
  const write = !["GET", "HEAD", "OPTIONS"].includes(method);
  if (path === "/api/demo/start")
    return { route: "demo-start", limit: 5, windowMs: 3600000 };
  if (path.startsWith("/api/auth/") || (write && !path.startsWith("/api/")))
    return { route: "auth-write", limit: 10, windowMs: 60000 };
  if (path.startsWith("/api/uploads/"))
    return { route: "upload", limit: 10, windowMs: 60000 };
  if (!write) return { route: "read", limit: 120, windowMs: 60000 };
  const action = path.split("/").at(-1);
  const family = [
    "vote",
    "follow",
    "comments",
    "moderation",
    "persona",
  ].includes(action ?? "")
    ? action
    : "write";
  return { route: family!, limit: 30, windowMs: 60000 };
}

export async function checkBoundary(
  request: Request,
  subject: string,
  check: RateCheck,
  requestId: string,
) {
  const policy = routePolicy(new URL(request.url).pathname, request.method);
  const aggregate = await check(
    subject,
    "aggregate",
    subject.startsWith("demo:") ? 60 : 180,
    60000,
  );
  const decision = aggregate.allowed
    ? await check(subject, policy.route, policy.limit, policy.windowMs)
    : aggregate;
  if (decision.allowed) return null;
  return Response.json(
    {
      ok: false,
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests. Wait a moment before trying again.",
        requestId,
        retryAt: decision.reset,
      },
    },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "X-Request-Id": requestId,
        "Retry-After": String(
          Math.max(1, Math.ceil((decision.reset - Date.now()) / 1000)),
        ),
      },
    },
  );
}
