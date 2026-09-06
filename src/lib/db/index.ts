import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getEnv } from "../env.ts";
import * as schema from "./schema.ts";

export function createDatabase(url: string) {
  const client = postgres(url, { max: 10, prepare: false });
  return { client, db: drizzle(client, { schema }) };
}

export type Database = ReturnType<typeof createDatabase>["db"];
let connection: ReturnType<typeof createDatabase> | undefined;

export function getDatabase(): Database {
  connection ??= createDatabase(getEnv().DATABASE_URL);
  return connection.db;
}
