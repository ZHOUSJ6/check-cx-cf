/** /api/admin/models — model CRUD + template link (admin only). */
import { eq } from "drizzle-orm";
import { Hono } from "hono";

import type { AdminEnv } from "#/api/admin/app";
import { isAdminUser } from "#/middleware/require-session";
import { checkModels, checkRequestTemplates } from "#/db/schema";
import type { ProviderType } from "#/db/schema";

export const modelsRouter = new Hono<AdminEnv>();

function isProviderType(v: string): v is ProviderType {
  return v === "openai" || v === "gemini" || v === "anthropic";
}

modelsRouter.get("/", async (c) => {
  const db = c.get("db");
  const rows = await db
    .select({
      id: checkModels.id,
      type: checkModels.type,
      model: checkModels.model,
      templateId: checkModels.templateId,
      updatedAt: checkModels.updatedAt,
    })
    .from(checkModels);
  return c.json({ models: rows });
});

modelsRouter.post("/", async (c) => {
  if (!isAdminUser(c.get("appUser"))) return c.json({ error: "仅管理员可操作" }, 403);
  const db = c.get("db");
  const body = await c.req.json().catch(() => ({}));
  const type = String(body.type ?? "");
  const model = String(body.model ?? "").trim();
  const templateId = typeof body.templateId === "string" && body.templateId.trim() ? body.templateId.trim() : null;

  if (!isProviderType(type) || !model) {
    return c.json({ error: "缺少必填字段 (type/model)" }, 400);
  }
  if (templateId) {
    const tpl = await db.select({ type: checkRequestTemplates.type }).from(checkRequestTemplates).where(eq(checkRequestTemplates.id, templateId));
    if (!tpl[0]) return c.json({ error: "指定的模板不存在" }, 400);
    if (tpl[0].type !== type) return c.json({ error: "模板类型不匹配" }, 400);
  }

  const id = crypto.randomUUID();
  await db.insert(checkModels).values({ id, type, model, templateId });
  return c.json({ id }, 201);
});

modelsRouter.put("/:id", async (c) => {
  if (!isAdminUser(c.get("appUser"))) return c.json({ error: "仅管理员可操作" }, 403);
  const db = c.get("db");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.model === "string" && body.model.trim()) updates.model = body.model.trim();
  if (typeof body.templateId === "string") {
    updates.templateId = body.templateId.trim() || null;
  }

  await db.update(checkModels).set(updates).where(eq(checkModels.id, id));
  return c.json({ ok: true });
});

modelsRouter.delete("/:id", async (c) => {
  if (!isAdminUser(c.get("appUser"))) return c.json({ error: "仅管理员可操作" }, 403);
  const db = c.get("db");
  await db.delete(checkModels).where(eq(checkModels.id, c.req.param("id")));
  return c.json({ ok: true });
});
