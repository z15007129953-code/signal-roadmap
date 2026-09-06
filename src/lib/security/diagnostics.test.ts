// @vitest-environment node
import { expect, it, vi } from "vitest";
import { withDiagnostics } from "./diagnostics";
it("correlates a sanitized error response and server log with one request ID", async () => {
  const log = vi.fn();
  const response = await withDiagnostics(
    new Request("https://signal.example", {
      headers: { "x-request-id": "request-1234" },
    }),
    async () => {
      throw Error("email@example.com secret");
    },
    log,
  );
  expect(response.status).toBe(503);
  const result = await response.json();
  expect(result.error.requestId).toBe("request-1234");
  expect(JSON.stringify(result)).not.toContain("secret");
  expect(log).toHaveBeenCalledWith({
    requestId: "request-1234",
    code: "UNAVAILABLE",
    status: 503,
  });
});
it("adds correlation to handled domain errors without breaking success cookies", async () => {
  const req = new Request("https://signal.example");
  const error = await withDiagnostics(req, async () =>
    Response.json(
      { ok: false, error: { code: "FORBIDDEN", message: "No access" } },
      { status: 403 },
    ),
  );
  expect((await error.json()).error.requestId).toBe(
    error.headers.get("X-Request-Id"),
  );
  const success = await withDiagnostics(req, async () =>
    Response.json(
      { ok: true },
      { headers: { "Set-Cookie": "test=value; HttpOnly" } },
    ),
  );
  expect(success.headers.get("Set-Cookie")).toBe("test=value; HttpOnly");
});
