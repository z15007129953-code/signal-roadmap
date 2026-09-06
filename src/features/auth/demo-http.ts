import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { domainError, type DomainErrorCode } from "@/lib/http/errors";
import { err } from "@/lib/http/result";
import { toHttpResponse } from "@/lib/http/response";
import {
  cleanupDemoSessions,
  createDemoSession,
  demoCookieName,
  switchDemoPersona,
  type DemoRepository,
} from "./demo-session";

const personaSchema = z
  .object({ persona: z.enum(["member", "moderator"]) })
  .strict();
function failure(code: DomainErrorCode) {
  const response = toHttpResponse(err(domainError(code)));
  response.headers.set("Cache-Control", "no-store");
  return response;
}
export function unavailable() {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "UNAVAILABLE",
        message: "The demo is temporarily unavailable. Please try again later.",
      },
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
function success(value: unknown, status = 200) {
  return NextResponse.json(
    { ok: true, value },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
async function readSmallJson(request: Request): Promise<unknown> {
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json") ||
    !request.body
  )
    throw new Error("Invalid body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 256) {
        await reader.cancel();
        throw new Error("Body too large");
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    reader.releaseLock();
  }
}

export function createDemoHandlers(options: {
  repository: DemoRepository;
  secret: string;
  secure: boolean;
  appUrl: string;
  cronSecret: string;
}) {
  const origin = new URL(options.appUrl).origin;
  function mutationGuard(request: Request) {
    if (request.method !== "POST")
      return new Response(null, {
        status: 405,
        headers: { Allow: "POST", "Cache-Control": "no-store" },
      });
    if (request.headers.get("origin") !== origin) return failure("FORBIDDEN");
  }
  return {
    async start(request: Request) {
      const denied = mutationGuard(request);
      if (denied) return denied;
      try {
        const session = await createDemoSession(options);
        const response = success(session.workspace, 201);
        response.cookies.set(session.cookie);
        return response;
      } catch {
        return unavailable();
      }
    },
    async switchPersona(request: Request) {
      const denied = mutationGuard(request);
      if (denied) return denied;
      let persona: "member" | "moderator";
      try {
        persona = personaSchema.parse(await readSmallJson(request)).persona;
      } catch {
        return failure("VALIDATION_FAILED");
      }
      try {
        const value =
          new NextRequest(request.url, {
            headers: request.headers,
          }).cookies.get(demoCookieName)?.value ?? "";
        const result = await switchDemoPersona(value, persona, options);
        if (!result.ok) return failure(result.error.code);
        const response = success(result.value.workspace);
        response.cookies.set(result.value.cookie);
        return response;
      } catch {
        return unavailable();
      }
    },
    async cleanup(request: Request) {
      if (request.method !== "GET")
        return new Response(null, {
          status: 405,
          headers: { Allow: "GET", "Cache-Control": "no-store" },
        });
      const supplied = request.headers.get("authorization") ?? "";
      const expected = `Bearer ${options.cronSecret}`;
      if (
        options.cronSecret.length < 32 ||
        Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
        !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
      )
        return failure("UNAUTHENTICATED");
      try {
        return success(await cleanupDemoSessions(options.repository));
      } catch {
        return unavailable();
      }
    },
  };
}
