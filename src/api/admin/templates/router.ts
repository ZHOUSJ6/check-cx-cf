/** /api/admin/templates — request template CRUD (admin only). */
import { eq } from "drizzle-orm";
import { Hono } from "hono";

import type { AdminEnv } from "#/api/admin/app";
import { isAdminUser } from "#/middleware/require-session";
import { checkRequestTemplates } from "#/db/schema";
import type { ProviderType } from "#/db/schema";

export const templatesRouter = new Hono<AdminEnv>();

function isProviderType(v: string): v is ProviderType {
  return v === "openai" || v === "gemini" || v === "anthropic";
}

templatesRouter.get("/", async (c) => {
  const db = c.get("db");
  const rows = await db.select().from(checkRequestTemplates);
  return c.json({ templates: rows });
});

templatesRouter.post("/", async (c) => {
  if (!isAdminUser(c.get("appUser"))) return c.json({ error: "仅管理员可操作" }, 403);
  const db = c.get("db");
  const body = await c.req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const type = String(body.type ?? "");
  if (!name || !isProviderType(type)) {
    return c.json({ error: "缺少必填字段 (name/type)" }, 400);
  }
  const id = crypto.randomUUID();
  await db.insert(checkRequestTemplates).values({
    id,
    name,
    type,
    requestHeader: body.requestHeader ?? null,
    metadata: body.metadata ?? null,
  });
  return c.json({ id }, 201);
});

templatesRouter.put("/:id", async (c) => {
  if (!isAdminUser(c.get("appUser"))) return c.json({ error: "仅管理员可操作" }, 403);
  const db = c.get("db");
  const body = await c.req.json().catch(() => ({}));
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
  if (typeof body.requestHeader !== "undefined") updates.requestHeader = body.requestHeader;
  if (typeof body.metadata !== "undefined") updates.metadata = body.metadata;
  await db.update(checkRequestTemplates).set(updates).where(eq(checkRequestTemplates.id, c.req.param("id")));
  return c.json({ ok: true });
});

templatesRouter.delete("/:id", async (c) => {
  if (!isAdminUser(c.get("appUser"))) return c.json({ error: "仅管理员可操作" }, 403);
  const db = c.get("db");
  await db.delete(checkRequestTemplates).where(eq(checkRequestTemplates.id, c.req.param("id")));
  return c.json({ ok: true });
});
