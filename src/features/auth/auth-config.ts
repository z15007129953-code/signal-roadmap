import type { DefaultSession, NextAuthConfig } from "next-auth";
import type { Adapter } from "next-auth/adapters";
import Nodemailer, {
  type NodemailerConfig,
} from "next-auth/providers/nodemailer";
import type { Env } from "@/lib/env";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

export function createDevelopmentSender(
  mode: Env["NODE_ENV"],
  log: (message: string) => void = console.info,
): NodemailerConfig["sendVerificationRequest"] {
  return async ({ identifier, url }) => {
    if (mode !== "development") {
      throw new Error("Console magic links are available only in development");
    }
    log(`[development only] Sign-in link for ${identifier}: ${url}`);
  };
}

export function createAuthConfig(env: Env, adapter: Adapter) {
  const origin = new URL(env.APP_URL).origin;
  const smtpConfigured = Boolean(env.EMAIL_SERVER && env.EMAIL_FROM);
  if (!smtpConfigured && env.NODE_ENV !== "development") {
    throw new Error("SMTP must be configured outside development");
  }

  return {
    adapter,
    secret: env.AUTH_SECRET,
    basePath: "/api/auth",
    // auth.ts pins AUTH_URL to APP_URL before Auth.js reads any request headers.
    trustHost: true,
    useSecureCookies: origin.startsWith("https:"),
    debug: false,
    logger: {
      error(_error: Error) {
        void _error;
        // Adapter errors may contain raw bearer tokens in SQL parameters.
        // Never serialize library errors, their messages, or nested causes.
        console.error("[auth] Authentication operation failed");
      },
      warn() {
        console.warn("[auth] Authentication configuration warning");
      },
      debug() {},
    },
    session: { strategy: "database" },
    providers: [
      Nodemailer({
        maxAge: 15 * 60,
        ...(smtpConfigured
          ? { server: env.EMAIL_SERVER, from: env.EMAIL_FROM }
          : {
              server: { jsonTransport: true },
              from: "development@localhost.invalid",
              sendVerificationRequest: createDevelopmentSender(env.NODE_ENV),
            }),
      }),
    ],
    callbacks: {
      redirect({ url }: { url: string; baseUrl: string }) {
        try {
          const target = new URL(url, origin);
          if (
            target.origin === origin &&
            !target.username &&
            !target.password
          ) {
            return target.href;
          }
        } catch {
          // Invalid callback URLs return to the configured site origin.
        }
        return origin;
      },
      session({ session, user }) {
        session.user.id = user.id;
        return session;
      },
    },
  } satisfies NextAuthConfig;
}
