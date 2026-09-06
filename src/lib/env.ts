import { z } from "zod";

function decodedPath(url: URL): string | null {
  try {
    return decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
}

const postgresUrl = z
  .url()
  .refine(
    (value) =>
      URL.canParse(value) &&
      ["postgres:", "postgresql:"].includes(new URL(value).protocol),
    "Must be a PostgreSQL URL",
  );
const optionalValue = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

export function assertSafeTestDatabaseUrl(value: string): string {
  const url = new URL(postgresUrl.parse(value));
  const database = decodeURIComponent(url.pathname.slice(1));
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    !/^[a-zA-Z0-9_]+_test$/.test(database) ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "Database reset requires a loopback PostgreSQL URL, a database ending in _test, and no URL parameters",
    );
  }
  return value;
}

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    DATABASE_URL: postgresUrl,
    TEST_DATABASE_URL: postgresUrl.optional(),
    APP_URL: z.url(),
    AUTH_SECRET: z.string().min(32),
    DEMO_COOKIE_SECRET: z.string().min(32),
    CRON_SECRET: z.string().min(32),
    EMAIL_SERVER: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z
        .url()
        .refine((value) => {
          if (!URL.canParse(value)) return false;
          const url = new URL(value);
          return (
            ["smtp:", "smtps:"].includes(url.protocol) && Boolean(url.hostname)
          );
        }, "Must be an SMTP or SMTPS URL")
        .optional(),
    ),
    EMAIL_FROM: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.email().optional(),
    ),
    R2_ACCOUNT_ID: optionalValue,
    R2_ACCESS_KEY_ID: optionalValue,
    R2_SECRET_ACCESS_KEY: optionalValue,
    R2_BUCKET: optionalValue,
    UPSTASH_REDIS_REST_URL: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.url().optional(),
    ),
    UPSTASH_REDIS_REST_TOKEN: optionalValue,
  })
  .superRefine((env, context) => {
    // Field validators already report malformed URLs; never throw credential-bearing native errors.
    if (
      ![env.DATABASE_URL, env.APP_URL, env.TEST_DATABASE_URL].every(
        (value) => !value || URL.canParse(value),
      )
    )
      return;
    if (env.TEST_DATABASE_URL) {
      try {
        assertSafeTestDatabaseUrl(env.TEST_DATABASE_URL);
      } catch {
        context.addIssue({
          code: "custom",
          path: ["TEST_DATABASE_URL"],
          message:
            "Must point to a loopback *_test database without URL parameters",
        });
      }
      const development = new URL(env.DATABASE_URL);
      const test = new URL(env.TEST_DATABASE_URL);
      const host = (url: URL) =>
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
          ? "loopback"
          : url.hostname;
      if (
        host(development) === host(test) &&
        (development.port || "5432") === (test.port || "5432") &&
        decodedPath(development) !== null &&
        decodedPath(development) === decodedPath(test)
      ) {
        context.addIssue({
          code: "custom",
          path: ["TEST_DATABASE_URL"],
          message: "Development and test databases must be separate",
        });
      }
    }
    const appUrl = new URL(env.APP_URL);
    if (
      appUrl.username ||
      appUrl.password ||
      appUrl.pathname !== "/" ||
      appUrl.search ||
      appUrl.hash
    ) {
      context.addIssue({
        code: "custom",
        path: ["APP_URL"],
        message:
          "APP_URL must be an origin without credentials, path, query, or fragment",
      });
    }
    if (
      !["http:", "https:"].includes(appUrl.protocol) ||
      (env.NODE_ENV === "production" && appUrl.protocol !== "https:")
    ) {
      context.addIssue({
        code: "custom",
        path: ["APP_URL"],
        message: "APP_URL must use HTTP(S), and HTTPS in production",
      });
    }
    for (const keys of [
      ["EMAIL_SERVER", "EMAIL_FROM"],
      [
        "R2_ACCOUNT_ID",
        "R2_ACCESS_KEY_ID",
        "R2_SECRET_ACCESS_KEY",
        "R2_BUCKET",
      ],
      ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
    ] as const) {
      if (keys.some((key) => env[key]) && !keys.every((key) => env[key])) {
        context.addIssue({
          code: "custom",
          path: [keys[0]],
          message: `Configure all or none of: ${keys.join(", ")}`,
        });
      }
    }
    if (
      env.NODE_ENV === "production" &&
      (!env.EMAIL_SERVER || !env.EMAIL_FROM)
    ) {
      context.addIssue({
        code: "custom",
        path: ["EMAIL_SERVER"],
        message: "Production requires EMAIL_SERVER and EMAIL_FROM",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;
export function parseEnv(source: Record<string, string | undefined>): Env {
  return envSchema.parse(source);
}

// Validation is deliberately lazy: importing modules during a build does not require secrets.
export function getEnv(): Env {
  return parseEnv(process.env);
}
