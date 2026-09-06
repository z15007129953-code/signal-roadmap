import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { verifyDemoToken } from "@/features/auth/demo-token";
import { demoCookieName } from "@/features/auth/demo-session";
import { rateSubject } from "@/lib/security/rate-limit";
import { runtimeLimiter } from "@/lib/security/rate-runtime";
import { checkBoundary } from "@/lib/security/boundary";
import { logFailure, requestId } from "@/lib/security/request-id";
import { securityHeaders } from "@/lib/security/headers";
import { documentFailure } from "@/lib/security/document-failure";

export async function proxy(request: NextRequest) {
  const id = requestId();
  const path = request.nextUrl.pathname;
  const protection = securityHeaders({
    nonce: randomBytes(24).toString("base64"),
    production: process.env.NODE_ENV === "production",
    r2Account: process.env.R2_ACCOUNT_ID,
  });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", id);
  requestHeaders.set(
    "Content-Security-Policy",
    protection["Content-Security-Policy"],
  );
  let response: Response | null = null;
  const isApi = path.startsWith("/api/");
  const isWrite = !["GET", "HEAD", "OPTIONS"].includes(request.method);
  const isWorkspaceRead =
    /^\/[^/]+\/(feedback|roadmap|changelog|notifications|admin)(\/|$)/.test(
      path,
    );
  if (
    (isApi || isWrite || isWorkspaceRead) &&
    path !== "/api/cron/cleanup-demo"
  ) {
    try {
      const secret = process.env.DEMO_COOKIE_SECRET;
      const cookie = request.cookies.get(demoCookieName)?.value;
      const verified =
        secret &&
        secret.length >= 32 &&
        cookie &&
        path !== "/api/demo/start" &&
        !path.startsWith("/api/auth/")
          ? verifyDemoToken(cookie, secret)
          : null;
      const subject = rateSubject(
        request,
        verified ? { kind: "demo", id: verified.token } : null,
        process.env.VERCEL === "1",
      );
      response = await checkBoundary(
        request,
        subject,
        runtimeLimiter.check,
        id,
      );
    } catch {
      logFailure({
        requestId: id,
        code: "RATE_LIMIT_UNAVAILABLE",
        status: 503,
      });
      response = Response.json(
        {
          ok: false,
          error: {
            code: "UNAVAILABLE",
            message:
              "The service is temporarily unavailable. Please try again later.",
            requestId: id,
          },
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
  }
  if (response && !isApi) response = documentFailure(response, id);
  response ??= NextResponse.next({ request: { headers: requestHeaders } });
  for (const [key, value] of Object.entries(protection)) {
    // Logo route supplies a more restrictive sandbox policy for uploaded content.
    if (
      key === "Content-Security-Policy" &&
      /^\/api\/workspaces\/[^/]+\/logo$/.test(path)
    )
      continue;
    response.headers.set(key, value);
  }
  response.headers.set("X-Request-Id", id);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts/).*)"],
};
