/**
 * Seed a test provider config into the dev Turso DB for local DO testing.
 * Run with: npx tsx scripts/seed-dev.ts
 *
 * Uses a dummy API key by default — the tick will record a failed/error
 * result, which is enough to verify the poll→append→history write path.
 * Pass a real key via SEED_API_KEY env to get an operational check.
 */
import { createClient } from "@libsql/client";
import { config } from "dotenv";

config({ path: ".env" });

const url = process.env.DATABASE_URL;
const token = process.env.DATABASE_AUTH_TOKEN;
if (!url || !token) {
  console.error("DATABASE_URL / DATABASE_AUTH_TOKEN missing in .env");
  process.exit(1);
}

const db = createClient({ url, authToken: token });

async function seed() {
  const apiKey = process.env.SEED_API_KEY ?? "sk-test-dummy-key-for-mechanism-check";
  const now = Date.now();

  // Template
  await db.execute({
    sql: `insert into check_request_templates (id, name, type, created_at, updated_at)
          values (?, ?, ?, ?, ?)
          on conflict(name) do nothing`,
    args: [crypto.randomUUID(), "openai-default", "openai", now, now],
  });

  const tpl = await db.execute(
    "select id from check_request_templates where name = ?",
    ["openai-default"],
  );
  const templateId = tpl.rows[0]?.id as string | undefined;

  // Model
  const modelId = crypto.randomUUID();
  await db.execute({
    sql: `insert into check_models (id, type, model, template_id, created_at, updated_at)
          values (?, ?, ?, ?, ?, ?)
          on conflict(type, model) do nothing`,
    args: [modelId, "openai", "gpt-4o-mini", templateId ?? null, now, now],
  });

  // Resolve model id (in case of conflict reuse)
  const ml = await db.execute(
    "select id from check_models where type = ? and model = ?",
    ["openai", "gpt-4o-mini"],
  );
  const resolvedModelId = (ml.rows[0]?.id as string) ?? modelId;

  // Config
  await db.execute({
    sql: `insert into check_configs (id, name, type, model_id, endpoint, api_key, enabled, is_maintenance, group_name, created_at, updated_at)
          values (?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?)`,
    args: [
      crypto.randomUUID(),
      "OpenAI GPT-4o-mini (test)",
      "openai",
      resolvedModelId,
      "https://api.openai.com/v1/chat/completions",
      apiKey,
      "默认分组",
      now,
      now,
    ],
  });

  console.log("✓ seeded test config (openai / gpt-4o-mini)");
  const count = await db.execute("select count(*) as n from check_configs");
  console.log("  check_configs count:", count.rows[0]?.n);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
