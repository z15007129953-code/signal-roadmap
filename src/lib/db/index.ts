import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { getEnv } from "../env.ts";
import * as schema from "./schema.ts";

export function createDatabase(url: string) {
  const client = postgres(url, { max: 10, prepare: false });
  return { client, db: drizzle(client, { schema }) };
}

export type Database = ReturnType<typeof createDatabase>["db"];
type Connection = ReturnType<typeof createDatabase>;
const databaseGlobal = globalThis as typeof globalThis & {
  signalRoadmapConnection?: Connection;
};
let connection: Connection | undefined;

export function getDatabase(): Database {
  // Next development reloads modules; retain one pool across those reloads.
  connection ??=
    databaseGlobal.signalRoadmapConnection ??
    createDatabase(getEnv().DATABASE_URL);
  if (process.env.NODE_ENV !== "production")
    databaseGlobal.signalRoadmapConnection = connection;
  return connection.db;
}
