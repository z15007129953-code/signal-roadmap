// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Next.js supplies this marker; Vitest runs the server module directly.
vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Auth.js entry point", () => {
  it("imports without environment secrets or a database connection", async () => {
    vi.stubEnv("DATABASE_URL", undefined);
    vi.stubEnv("AUTH_SECRET", undefined);
    const { handlers, auth } = await import("./auth");
    expect(handlers.GET).toBeTypeOf("function");
    expect(auth).toBeTypeOf("function");
    expect(process.env.DATABASE_URL).toBeUndefined();
  });

  it("pins provider URLs to APP_URL despite poisoned host and forwarded headers", async () => {
    const variables = {
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://local@127.0.0.1:1/signal",
      APP_URL: "http://localhost:3000",
      AUTH_URL: "https://stale-environment.example",
      AUTH_SECRET: "a".repeat(32),
      DEMO_COOKIE_SECRET: "b".repeat(32),
      CRON_SECRET: "c".repeat(32),
    };
    for (const [key, value] of Object.entries(variables))
      vi.stubEnv(key, value);
    // Provider metadata does not run adapter queries or send email.
    const { handlers } = await import("./auth");
    const response = await handlers.GET(
      new NextRequest("https://poisoned.example/api/auth/providers", {
        headers: {
          host: "poisoned.example",
          "x-forwarded-host": "forwarded.example",
          "x-forwarded-proto": "https",
        },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      nodemailer: {
        signinUrl: "http://localhost:3000/api/auth/signin/nodemailer",
        callbackUrl: "http://localhost:3000/api/auth/callback/nodemailer",
      },
    });
  });
});
