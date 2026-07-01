/**
 * Database client factory — Turso (libSQL) via drizzle-orm/libsql.
 *
 * Workers have no global env; a fresh client is created per request/handler
 * from the request `env` (spec: backend/database.md, backend/environment.md).
 *
 * Uses the explicit HTTP driver for edge compatibility and embeds authToken
 * in the URL to work around known @libsql/client version quirks.
 */

import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";

import * as schema from "./schema";

export type Database = LibSQLDatabase<typeof schema>;

interface DatabaseEnv {
  DATABASE_URL: string;
  DATABASE_AUTH_TOKEN: string;
}

/**
 * Create a Drizzle instance bound to this request's environment.
 * Call inside handlers, never at module top-level.
 */
export function createDb(env: DatabaseEnv): Database {
  const url = `${env.DATABASE_URL}?authToken=${env.DATABASE_AUTH_TOKEN}`;
  const client: Client = createClient({ url });
  return drizzle(client, { schema });
}

export { schema };
