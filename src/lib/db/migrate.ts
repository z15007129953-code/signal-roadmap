import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import type { Sql } from "postgres";

import { assertSafeTestDatabaseUrl } from "../env.ts";
import type { Database } from "./index.ts";

export async function migrateDatabase(db: Database) {
  await migrate(db, {
    migrationsFolder: fileURLToPath(
      new URL("../../../drizzle", import.meta.url),
    ),
  });
}

export async function resetTestDatabase(client: Sql, url: string) {
  assertSafeTestDatabaseUrl(url);
  // Verify the live connection too; callers cannot pass a safe URL for an unrelated client.
  const expected = new URL(url);
  const expectedDatabase = decodeURIComponent(expected.pathname.slice(1));
  const allowedHosts = ["localhost", "127.0.0.1", "::1", "[::1]"];
  if (
    !client.options.host.every((host) => allowedHosts.includes(host)) ||
    client.options.database !== expectedDatabase ||
    !client.options.port.every((port) => port === Number(expected.port || 5432))
  ) {
    throw new Error(
      "Refusing to reset: client is not configured for the declared loopback test database",
    );
  }
  const [actual] = await client<
    { database: string }[]
  >`SELECT current_database() AS database`;
  if (actual.database !== expectedDatabase) {
    throw new Error(
      "Refusing to reset: active connection is not the declared loopback test database",
    );
  }
  await client`TRUNCATE TABLE workspaces, users, verification_tokens CASCADE`;
}
