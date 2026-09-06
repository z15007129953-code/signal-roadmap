import { createDatabase } from "../src/lib/db/index.ts";
import { getEnv } from "../src/lib/env.ts";
import { resetCanonical } from "../src/features/demo/seed.ts";

async function run() {
  const { client, db } = createDatabase(getEnv().DATABASE_URL);
  try {
    console.info(JSON.stringify(await resetCanonical(db)));
  } finally {
    await client.end();
  }
}
run().catch(() => {
  console.error(
    "Showcase reset refused or failed. Only the existing, explicitly marked canonical showcase can be reset.",
  );
  process.exitCode = 1;
});
