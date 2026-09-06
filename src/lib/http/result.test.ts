// @vitest-environment node
import { describe, expect, it } from "vitest";

import { domainError, type DomainErrorCode } from "./errors";
import { toHttpResponse } from "./response";
import { err, ok, type Result } from "./result";

describe("domain results", () => {
  it("preserves a successful value including null", () => {
    expect(ok({ id: "feedback-1" })).toEqual({
      ok: true,
      value: { id: "feedback-1" },
    });
    expect(ok(null)).toEqual({ ok: true, value: null });
  });

  it("preserves a typed domain failure", () => {
    const error = domainError("FORBIDDEN");
    const result: Result<string> = err(error);
    expect(result).toEqual({ ok: false, error });
  });
});

describe("HTTP result mapping", () => {
  it.each<[DomainErrorCode, number]>([
    ["UNAUTHENTICATED", 401],
    ["FORBIDDEN", 403],
    ["NOT_FOUND", 404],
    ["CONFLICT", 409],
    ["VALIDATION_FAILED", 422],
    ["RATE_LIMITED", 429],
    ["DEMO_QUOTA_EXCEEDED", 429],
    ["DEMO_EXPIRED", 410],
  ])("maps %s to %i with a safe public message", async (code, status) => {
    const error = domainError(code);
    expect(error.code).toBe(code);
    expect(error.message.length).toBeGreaterThan(0);
    const response = toHttpResponse(err(error));
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ ok: false, error });
  });

  it("returns successful results as JSON", async () => {
    const response = toHttpResponse(ok({ id: "feedback-1" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({
      ok: true,
      value: { id: "feedback-1" },
    });
  });

  it("does not expose internal messages or extra error properties", async () => {
    const response = toHttpResponse(
      err({
        code: "CONFLICT" as const,
        message: "secret SQL query with user@example.com",
        cause: new Error("database password"),
        stack: "private trace",
      }),
    );
    expect(await response.json()).toEqual({
      ok: false,
      error: domainError("CONFLICT"),
    });
  });
});
