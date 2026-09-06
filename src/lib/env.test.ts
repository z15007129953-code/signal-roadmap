// @vitest-environment node
import { describe, expect, it } from "vitest";

import { assertSafeTestDatabaseUrl, envSchema, parseEnv } from "./env";

const valid = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://local:local@127.0.0.1:54329/signal",
  TEST_DATABASE_URL: "postgresql://local:local@127.0.0.1:54330/signal_test",
  AUTH_SECRET: "a".repeat(32),
  DEMO_COOKIE_SECRET: "b".repeat(32),
  CRON_SECRET: "c".repeat(32),
  APP_URL: "http://localhost:3000",
};

describe("environment validation", () => {
  it("recognizes encoded aliases of the same database", () => {
    expect(
      envSchema.safeParse({
        ...valid,
        DATABASE_URL: "postgres://local@localhost:54330/signal_test",
        TEST_DATABASE_URL: "postgres://local@127.0.0.1:54330/%73ignal_test",
      }).success,
    ).toBe(false);
  });
  it.each(["DATABASE_URL", "TEST_DATABASE_URL", "APP_URL", "EMAIL_SERVER"])(
    "safely rejects malformed credential-bearing %s",
    (key) => {
      const source = {
        ...valid,
        [key]: "postgres://user:private-password@localhost:invalid/db",
      };
      const result = envSchema.safeParse(source);
      expect(result.success).toBe(false);
      if (!result.success)
        expect(JSON.stringify(result.error)).not.toContain("private-password");
      try {
        parseEnv(source);
      } catch (error) {
        expect(String(error)).not.toContain("private-password");
        expect(error).not.toBeInstanceOf(TypeError);
      }
    },
  );
  it("accepts explicit local settings and defaults no secrets", () => {
    expect(parseEnv(valid).DATABASE_URL).toBe(valid.DATABASE_URL);
    expect(() => parseEnv({ NODE_ENV: "production" })).toThrow();
  });

  it("rejects matching development and test databases", () => {
    expect(() =>
      parseEnv({ ...valid, DATABASE_URL: valid.TEST_DATABASE_URL }),
    ).toThrow();
  });

  it("requires PostgreSQL and an adequately sized auth secret", () => {
    expect(() =>
      parseEnv({ ...valid, DATABASE_URL: "https://example.com/db" }),
    ).toThrow();
    expect(() => parseEnv({ ...valid, AUTH_SECRET: "short" })).toThrow();
  });

  it("requires HTTPS for the production auth origin", () => {
    expect(() => parseEnv({ ...valid, NODE_ENV: "production" })).toThrow();
    expect(
      parseEnv({
        ...valid,
        NODE_ENV: "production",
        APP_URL: "https://signal.example.com",
        EMAIL_SERVER: "smtps://mail.example.com:465",
        EMAIL_FROM: "login@signal.example.com",
      }).NODE_ENV,
    ).toBe("production");
  });

  it("permits absent external services but rejects incomplete credentials", () => {
    expect(
      parseEnv({ ...valid, R2_BUCKET: "", UPSTASH_REDIS_REST_URL: "" })
        .R2_BUCKET,
    ).toBeUndefined();
    expect(() => parseEnv({ ...valid, R2_BUCKET: "uploads" })).toThrow();
    expect(() =>
      parseEnv({
        ...valid,
        UPSTASH_REDIS_REST_URL: "https://redis.example.com",
      }),
    ).toThrow();
  });

  it("recognizes host aliases as the same database", () => {
    expect(() =>
      parseEnv({
        ...valid,
        DATABASE_URL: "postgres://other:password@localhost:54330/signal_test",
      }),
    ).toThrow();
  });

  it("requires SMTP and sender together, and requires both in production", () => {
    expect(
      parseEnv({ ...valid, EMAIL_SERVER: "", EMAIL_FROM: "" }).EMAIL_SERVER,
    ).toBeUndefined();
    expect(() =>
      parseEnv({ ...valid, EMAIL_SERVER: "smtp://localhost:1025" }),
    ).toThrow();
    expect(() =>
      parseEnv({ ...valid, EMAIL_FROM: "login@example.com" }),
    ).toThrow();
    expect(() =>
      parseEnv({
        ...valid,
        NODE_ENV: "production",
        APP_URL: "https://signal.example.com",
      }),
    ).toThrow();
    expect(
      parseEnv({
        ...valid,
        EMAIL_SERVER: "smtp://localhost:1025",
        EMAIL_FROM: "login@example.com",
      }).EMAIL_FROM,
    ).toBe("login@example.com");
  });

  it.each([
    {
      EMAIL_SERVER: "https://mail.example.com",
      EMAIL_FROM: "login@example.com",
    },
    { EMAIL_SERVER: "smtp://mail.example.com", EMAIL_FROM: "not-an-email" },
    {
      EMAIL_SERVER: "smtp://mail.example.com",
      EMAIL_FROM: "login@example.com\r\nBcc: victim@example.com",
    },
  ])("rejects invalid email transport settings", (email) => {
    expect(() => parseEnv({ ...valid, ...email })).toThrow();
  });

  it.each([
    "https://user:password@signal.example.com",
    "https://signal.example.com/subpath",
    "https://signal.example.com/?redirect=elsewhere",
    "https://signal.example.com/#fragment",
  ])("requires a credential-free canonical APP_URL origin: %s", (APP_URL) => {
    expect(() => parseEnv({ ...valid, APP_URL })).toThrow();
  });

  it.each(["AUTH_SECRET", "DEMO_COOKIE_SECRET", "CRON_SECRET"])(
    "rejects missing production %s",
    (key) => {
      expect(() =>
        parseEnv({
          ...valid,
          NODE_ENV: "production",
          APP_URL: "https://signal.example.com",
          [key]: undefined,
        }),
      ).toThrow();
    },
  );
});

describe("destructive test database guard", () => {
  it.each(["localhost", "127.0.0.1", "[::1]"])(
    "accepts a local test database on %s",
    (host) => {
      expect(() =>
        assertSafeTestDatabaseUrl(
          `postgresql://local:local@${host}:54330/signal_test`,
        ),
      ).not.toThrow();
    },
  );

  it.each([
    "postgresql://local:local@db.example.com/signal_test",
    "postgresql://local:local@localhost/signal",
    "postgresql://local:local@127.0.0.1/signal_test_backup",
    "postgresql://local:local@localhost/%2e%2e%2fsignal_test",
    "postgresql://local:local@localhost/signal_test?host=db.example.com",
    "postgresql://local:local@localhost/signal_test?options=-csearch_path%3Dpublic",
    "https://localhost/signal_test",
  ])("rejects unsafe reset targets: %s", (url) => {
    expect(() => assertSafeTestDatabaseUrl(url)).toThrow();
  });
});
