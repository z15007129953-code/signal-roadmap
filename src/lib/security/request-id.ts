import { randomUUID } from "node:crypto";

export function requestId(supplied?: string | null) {
  return supplied && /^[A-Za-z0-9_-]{8,64}$/.test(supplied)
    ? supplied
    : randomUUID();
}

/** Allowlist diagnostics; never traverse raw exceptions, requests, or user data. */
export function safeLogContext(context: Record<string, unknown>) {
  const safe: Record<string, string | number> = {};
  for (const key of ["requestId", "code"] as const) {
    const value = context[key];
    if (typeof value === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(value))
      safe[key] = value;
  }
  if (
    typeof context.status === "number" &&
    Number.isInteger(context.status) &&
    context.status >= 100 &&
    context.status <= 599
  )
    safe.status = context.status;
  return safe;
}

export function logFailure(context: Record<string, unknown>) {
  console.error(JSON.stringify(safeLogContext(context)));
}
