import { spawn } from "node:child_process";
import { assertSafeTestDatabaseUrl, envSchema } from "../env.ts";
import { createDatabase } from "./index.ts";
import { migrateDatabase, resetTestDatabase } from "./migrate.ts";

async function run() {
  const command = process.argv[2];
  if (!["migrate", "reset-test", "test"].includes(command)) {
    throw new Error("Unknown database command");
  }
  const key = command === "migrate" ? "DATABASE_URL" : "TEST_DATABASE_URL";
  const url = process.env[key];
  if (!url) {
    console.error(`${key} is required. Configure a dedicated local database.`);
    process.exitCode = 1;
    return;
  }
  if (command !== "migrate")
    assertSafeTestDatabaseUrl(url, process.env.DATABASE_URL ?? "");
  else envSchema.shape.DATABASE_URL.parse(url);

  if (command === "test") {
    const child = spawn(
      process.execPath,
      ["node_modules/vitest/vitest.mjs", "run", "src/test/database.test.ts"],
      { stdio: "inherit" },
    );
    process.exitCode = await new Promise<number>((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code) => resolve(code ?? 1));
    });
    return;
  }
  const { client, db } = createDatabase(url);
  try {
    if (command === "migrate") await migrateDatabase(db);
    else await resetTestDatabase(client, url);
    console.info(
      command === "migrate"
        ? "Migrations applied."
        : "Local test database reset.",
    );
  } finally {
    await client.end();
  }
}

run().catch(() => {
  // Driver and validation errors can contain credentials; never echo them here.
  console.error(
    "Database command failed. Check the configured local database, its availability, and migration files.",
  );
  process.exitCode = 1;
});
