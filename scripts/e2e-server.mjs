import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { assertSafeTestDatabaseUrl } from "../src/lib/env.ts";
import { createDatabase } from "../src/lib/db/index.ts";
import { migrateDatabase, resetTestDatabase } from "../src/lib/db/migrate.ts";
import { seedCanonical } from "../src/features/demo/seed.ts";

async function run() {
  const url = assertSafeTestDatabaseUrl(
    process.env.TEST_DATABASE_URL ?? "",
    process.env.DATABASE_URL ?? "",
  );
  const { db, client } = createDatabase(url);
  try {
    await migrateDatabase(db);
    await resetTestDatabase(client, url);
    await seedCanonical(db);
  } finally {
    await client.end();
  }
  const secret = () => randomBytes(32).toString("hex");
  const child = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "dev",
      "--webpack",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3200",
    ],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        NODE_ENV: "development",
        E2E_RUN: "1",
        DATABASE_URL: url,
        // This child is the application under test, not the database test runner.
        // Remove the secondary URL after the guarded parent selected/reset it.
        TEST_DATABASE_URL: "",
        APP_URL: "http://127.0.0.1:3200",
        AUTH_SECRET: secret(),
        DEMO_COOKIE_SECRET: secret(),
        CRON_SECRET: secret(),
        EMAIL_SERVER: "",
        EMAIL_FROM: "",
        VERCEL: "",
      },
    },
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => child.kill(signal));
  child.on("exit", (code) => {
    process.exitCode = code ?? 1;
  });
}
run().catch(() => {
  console.error(
    "E2E setup failed. Check the dedicated loopback test database; development data was not selected.",
  );
  process.exitCode = 1;
});
