import { logFailure, requestId } from "./request-id";

/** Wrap public handlers, never logging raw library exceptions or request content. */
export async function withDiagnostics(
  request: Request,
  run: () => Promise<Response>,
  log = logFailure,
) {
  const id = requestId(request.headers.get("x-request-id"));
  let response: Response;
  try {
    response = await run();
  } catch {
    response = Response.json(
      {
        ok: false,
        error: {
          code: "UNAVAILABLE",
          message:
            "The service is temporarily unavailable. Please try again later.",
        },
      },
      { status: 503 },
    );
  }
  response.headers.set("X-Request-Id", id);
  if (response.status >= 400) {
    response.headers.set("Cache-Control", "no-store");
    if (response.status >= 500)
      log({ requestId: id, code: "UNAVAILABLE", status: response.status });
    if (response.headers.get("Content-Type")?.includes("application/json")) {
      const body = await response
        .clone()
        .json()
        .catch(() => null);
      if (body?.ok === false && body.error && typeof body.error === "object") {
        return Response.json(
          { ...body, error: { ...body.error, requestId: id } },
          { status: response.status, headers: response.headers },
        );
      }
    }
  }
  return response;
}
