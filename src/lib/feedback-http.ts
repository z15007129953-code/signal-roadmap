import type { FeedbackContext } from "./feedback-context";
import { err, type Result } from "./http/result";
import { domainError } from "./http/errors";
import { toHttpResponse } from "./http/response";

export function respond<T>(result: Result<T>, successStatus = 200) {
  const response = result.ok
    ? Response.json(result, { status: successStatus })
    : toHttpResponse(result);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
export function feedbackUnavailable() {
  return Response.json(
    {
      ok: false,
      error: {
        code: "UNAVAILABLE",
        message: "Feedback is temporarily unavailable. Please try again later.",
      },
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
export async function readBody(request: Request): Promise<unknown> {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
      "application/json" ||
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
      if (size > 65536) {
        await reader.cancel();
        throw new Error("Body limit");
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    reader.releaseLock();
  }
}
export function createFeedbackHandlers(options: {
  appUrl: string;
  loadContext: (slug: string) => Promise<Result<FeedbackContext>>;
}) {
  return {
    async create(request: Request, slug: string) {
      if (request.headers.get("origin") !== new URL(options.appUrl).origin)
        return respond(err(domainError("FORBIDDEN")));
      let body: unknown;
      try {
        body = await readBody(request);
      } catch {
        return respond(err(domainError("VALIDATION_FAILED")));
      }
      try {
        const context = await options.loadContext(slug);
        if (!context.ok) return respond(context);
        const { service, actor, workspace } = context.value;
        return respond(await service.create(actor, workspace.id, body), 201);
      } catch {
        return feedbackUnavailable();
      }
    },
    async suggest(request: Request, slug: string) {
      try {
        const context = await options.loadContext(slug);
        if (!context.ok) return respond(context);
        const { service, actor, workspace } = context.value;
        return respond(
          await service.suggest(
            actor,
            workspace.id,
            new URL(request.url).searchParams.get("title") ?? "",
          ),
        );
      } catch {
        return feedbackUnavailable();
      }
    },
  };
}
