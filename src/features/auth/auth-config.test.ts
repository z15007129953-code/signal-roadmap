// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { Adapter } from "next-auth/adapters";
import type { NodemailerConfig } from "next-auth/providers/nodemailer";

import { parseEnv } from "@/lib/env";
import { createAuthConfig, createDevelopmentSender } from "./auth-config";

const settings = {
  NODE_ENV: "development",
  DATABASE_URL: "postgresql://local@localhost/signal",
  APP_URL: "http://localhost:3000",
  AUTH_SECRET: "a".repeat(32),
  DEMO_COOKIE_SECRET: "b".repeat(32),
  CRON_SECRET: "c".repeat(32),
};
const adapter: Adapter = {};
const config = () => createAuthConfig(parseEnv(settings), adapter);
const provider = (value = config()): NodemailerConfig => {
  const item = value.providers[0] as NodemailerConfig;
  return { ...item, ...item.options };
};
const mail = () => ({
  identifier: "reader@example.com",
  url: "http://localhost:3000/api/auth/callback/nodemailer?token=local-token",
  expires: new Date("2030-01-01"),
  provider: provider(),
  token: "local-token",
  theme: {},
  request: new Request("http://localhost:3000/api/auth/signin/nodemailer"),
});

describe("email authentication configuration", () => {
  it("redacts nested adapter failures from auth logs", () => {
    const output = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const failure = Object.assign(new Error("secret-session-token"), {
        type: "SessionTokenError",
        cause: new Error("SQL params secret-session-token"),
      });
      config().logger.error(failure);
      expect(output).toHaveBeenCalledWith(
        "[auth] Authentication operation failed",
      );
      expect(JSON.stringify(output.mock.calls)).not.toContain(
        "secret-session-token",
      );
    } finally {
      output.mockRestore();
    }
  });
  it("uses the supplied adapter with database sessions and explicit secret", () => {
    expect(config()).toMatchObject({
      adapter,
      secret: settings.AUTH_SECRET,
      session: { strategy: "database" },
      basePath: "/api/auth",
    });
    expect(provider()).toMatchObject({
      id: "nodemailer",
      type: "email",
      maxAge: 15 * 60,
    });
  });

  it.each([
    ["/roadmap?sort=new", "http://localhost:3000/roadmap?sort=new"],
    ["http://localhost:3000/settings", "http://localhost:3000/settings"],
    ["https://attacker.example/stolen", "http://localhost:3000"],
    ["//attacker.example/stolen", "http://localhost:3000"],
    ["/\\attacker.example/stolen", "http://localhost:3000"],
    ["javascript:alert(1)", "http://localhost:3000"],
    ["http://name:password@localhost:3000/", "http://localhost:3000"],
    ["http://[", "http://localhost:3000"],
  ])(
    "restricts redirect %s to the canonical APP_URL",
    async (url, expected) => {
      expect(
        await config().callbacks.redirect({
          url,
          baseUrl: "https://poisoned-host.example",
        }),
      ).toBe(expected);
    },
  );

  it("includes the database user id in the browser session", async () => {
    const user = {
      id: "user-123",
      email: "reader@example.com",
      emailVerified: null,
    };
    const session = {
      user: { ...user, id: "" },
      expires: new Date("2030-01-01") as Date & string,
      sessionToken: "opaque",
      userId: user.id,
    };
    const result = await config().callbacks.session({
      session,
      user,
      token: {},
      newSession: undefined,
    });
    expect(result.user.id).toBe(user.id);
  });

  it("selects the real SMTP sender in production without a logging override", () => {
    const production = createAuthConfig(
      parseEnv({
        ...settings,
        NODE_ENV: "production",
        APP_URL: "https://signal.example.com",
        EMAIL_SERVER: "smtps://smtp.example.com:465",
        EMAIL_FROM: "login@signal.example.com",
      }),
      adapter,
    );
    const email = production.providers[0] as NodemailerConfig;
    expect(email.options).toMatchObject({
      server: "smtps://smtp.example.com:465",
      from: "login@signal.example.com",
    });
    expect(email.options?.sendVerificationRequest).toBeUndefined();
    expect(production.useSecureCookies).toBe(true);
    expect(production.debug).toBe(false);
  });

  it("refuses a console sender in test mode without SMTP", () => {
    expect(() =>
      createAuthConfig(parseEnv({ ...settings, NODE_ENV: "test" }), adapter),
    ).toThrow(/SMTP/);
  });
});

describe("development-only magic-link sender", () => {
  it("logs the link locally without a transport", async () => {
    const log = vi.fn();
    await createDevelopmentSender("development", log)(mail());
    expect(log).toHaveBeenCalledWith(
      "[development only] Sign-in link for reader@example.com: http://localhost:3000/api/auth/callback/nodemailer?token=local-token",
    );
  });

  it.each(["production", "test"] as const)(
    "refuses to log links in %s",
    async (mode) => {
      const log = vi.fn();
      await expect(createDevelopmentSender(mode, log)(mail())).rejects.toThrow(
        /development/,
      );
      expect(log).not.toHaveBeenCalled();
    },
  );
});
