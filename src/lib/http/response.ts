import { domainError, type DomainErrorCode } from "./errors";
import { err, type Result } from "./result";

const errorStatus: Readonly<Record<DomainErrorCode, number>> = Object.freeze({
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_FAILED: 422,
  RATE_LIMITED: 429,
  DEMO_QUOTA_EXCEEDED: 429,
  DEMO_EXPIRED: 410,
});

/** Rebuild failures from their code so internal diagnostics never reach clients. */
export function toHttpResponse<T>(result: Result<T>): Response {
  if (result.ok) return Response.json(result);
  return Response.json(err(domainError(result.error.code)), {
    status: errorStatus[result.error.code],
  });
}
