export type DomainErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "VALIDATION_FAILED"
  | "RATE_LIMITED"
  | "DEMO_QUOTA_EXCEEDED"
  | "DEMO_EXPIRED";
export type DomainError = Readonly<{ code: DomainErrorCode; message: string }>;

const publicMessages: Readonly<Record<DomainErrorCode, string>> = Object.freeze(
  {
    UNAUTHENTICATED: "Sign in to continue.",
    FORBIDDEN: "You do not have permission to perform this action.",
    NOT_FOUND: "The requested resource was not found.",
    CONFLICT:
      "This action conflicts with the current state. Refresh and try again.",
    VALIDATION_FAILED: "Check the submitted information and try again.",
    RATE_LIMITED: "Too many requests. Please try again later.",
    DEMO_QUOTA_EXCEEDED: "This demo has reached its usage limit.",
    DEMO_EXPIRED: "This demo has expired. Start a new demo to continue.",
  },
);

export function domainError(code: DomainErrorCode): DomainError {
  return Object.freeze({ code, message: publicMessages[code] });
}
