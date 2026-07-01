/**
 * Drizzle Kit config (Node-only toolchain, per spec backend/database.md).
 * Reads DATABASE_URL / DATABASE_AUTH_TOKEN from .env — NOT import.meta.env.
 */
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env" });

const url = process.env.DATABASE_URL ?? "";
const authToken = process.env.DATABASE_AUTH_TOKEN ?? "";

if (!url) {
  // drizzle-kit runs in Node; warn loudly instead of silently failing.
  console.warn(
    "[drizzle.config] DATABASE_URL missing. Copy .env.example to .env and fill Turso credentials.",
  );
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url,
    authToken,
  },
});
