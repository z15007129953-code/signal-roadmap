import "server-only";

import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";

import { getDatabase } from "@/lib/db";
import {
  accounts,
  sessions,
  users,
  verificationTokens,
} from "@/lib/db/auth-schema";
import { getEnv } from "@/lib/env";
import { createAuthConfig } from "./auth-config";

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const env = getEnv();
  // Auth.js uses AUTH_URL for route handlers, server actions, and server sessions.
  // Pin its origin before the library can infer any URL from request headers.
  process.env.AUTH_URL = new URL(env.APP_URL).origin;

  return createAuthConfig(
    env,
    DrizzleAdapter(getDatabase(), {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    }),
  );
});
