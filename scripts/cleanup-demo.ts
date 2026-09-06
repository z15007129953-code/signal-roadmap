import { createDatabase } from "../src/lib/db/index.ts";
import { getEnv } from "../src/lib/env.ts";
import { createDemoRepository } from "../src/features/auth/demo-repository.ts";

async function run() {
  const { client, db } = createDatabase(getEnv().DATABASE_URL);
  try {
    const deleted = await createDemoRepository(db).deleteExpiredBatch(
      new Date(),
      100,
    );
    console.info(JSON.stringify({ deleted }));
  } finally {
    await client.end();
  }
}
run().catch(() => {
  console.error(
    "Demo cleanup failed. Check server configuration and database availability.",
  );
  process.exitCode = 1;
});
