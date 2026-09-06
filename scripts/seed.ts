import { createDatabase } from "../src/lib/db/index.ts";
import { getEnv } from "../src/lib/env.ts";
import { seedCanonical } from "../src/features/demo/seed.ts";

async function run() {
  const { client, db } = createDatabase(getEnv().DATABASE_URL);
  try {
    console.info(JSON.stringify(await seedCanonical(db)));
  } finally {
    await client.end();
  }
}
run().catch(() => {
  console.error(
    "Showcase seed failed. Check configuration, database availability, and whether the canonical ID or slug belongs to an unrelated workspace.",
  );
  process.exitCode = 1;
});
