// @vitest-environment node
import { DrizzleQueryError } from "drizzle-orm/errors";
import NextAuth from "next-auth";
import type { Adapter } from "next-auth/adapters";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { parseEnv } from "@/lib/env";
import { createAuthConfig } from "./auth-config";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("Auth.js adapter error logging", () => {
  it("does not disclose a bearer token when the real session flow encounters a query failure", async () => {
    const token = "synthetic-secret-session-token-for-logging-regression";
    const origin = "https://signal.example.com";
    vi.stubEnv("AUTH_URL", origin);
    const output = ["error", "warn", "log", "info", "debug"].map((method) =>
      vi.spyOn(console, method as "error").mockImplementation(() => {}),
    );
    const unusedMethod = async () => {
      throw new Error("Unexpected adapter method during session lookup");
    };
    const getSessionAndUser = vi.fn(async (sessionToken: string) => {
      // Drizzle includes bind parameters in the error message. Auth.js wraps
      // this error twice and passes its nested causes to its configured logger.
      throw new DrizzleQueryError(
        "select sessions where session_token = $1",
        [sessionToken],
        new Error("Database connection unavailable"),
      );
    });
    const adapter = {
      createUser: unusedMethod,
      getUser: unusedMethod,
      getUserByEmail: unusedMethod,
      getUserByAccount: unusedMethod,
      updateUser: unusedMethod,
      linkAccount: unusedMethod,
      createSession: unusedMethod,
      updateSession: unusedMethod,
      deleteSession: unusedMethod,
      createVerificationToken: unusedMethod,
      useVerificationToken: unusedMethod,
      getSessionAndUser,
    } satisfies Adapter;
    const config = createAuthConfig(
      parseEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://local@127.0.0.1:1/signal",
        APP_URL: origin,
        AUTH_SECRET: "a".repeat(32),
        DEMO_COOKIE_SECRET: "b".repeat(32),
        CRON_SECRET: "c".repeat(32),
        EMAIL_SERVER: "smtps://smtp.example.com:465",
        EMAIL_FROM: "login@signal.example.com",
      }),
      adapter,
    );

    // Keep NextAuth and its Auth.js core real; only the database adapter fails.
    const { handlers } = NextAuth(config);
    const response = await handlers.GET(
      new NextRequest(`${origin}/api/auth/session`, {
        headers: { cookie: `__Secure-authjs.session-token=${token}` },
      }),
    );

    expect(getSessionAndUser).toHaveBeenCalledExactlyOnceWith(token);
    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
    expect(output[0]).toHaveBeenCalledWith(
      "[auth] Authentication operation failed",
    );
    const messages = JSON.stringify(output.flatMap((spy) => spy.mock.calls));
    expect(messages).not.toContain(token);
    expect(messages).not.toContain("session_token = $1");
    expect(messages).not.toContain("Database connection unavailable");
  });
});
