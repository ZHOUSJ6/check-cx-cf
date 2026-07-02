/**
 * /api/admin/configs — scoped config CRUD + batch operations.
 *
 * Scope: admin sees all; member sees only configs in their group_name.
 * Write ops validate config.type === model.type (replaces PG trigger).
 */

import { and, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";

import type { AdminEnv } from "#/api/admin/app";
import {
  getRequiredGroupName,
  isAdminUser,
  isGroupInUserScope,
} from "#/middleware/require-session";
import { checkConfigs, checkModels } from "#/db/schema";
import type { ProviderType } from "#/db/schema";

export const configsRouter = new Hono<AdminEnv>();

function isProviderType(value: string): value is ProviderType {
  return value === "openai" || value === "gemini" || value === "anthropic";
}

// GET / — list configs (scoped)
configsRouter.get("/", async (c) => {
  const db = c.get("db");
  const user = c.get("appUser");
  // getRequiredGroupName throws for members without a group, so for members it's non-null.
  const group = isAdminUser(user) ? null : getRequiredGroupName(user);
  const scope = group ? eq(checkConfigs.groupName, group) : undefined;

  const rows = await db
    .select({
      id: checkConfigs.id,
      name: checkConfigs.name,
      type: checkConfigs.type,
      modelId: checkConfigs.modelId,
      endpoint: checkConfigs.endpoint,
      enabled: checkConfigs.enabled,
      isMaintenance: checkConfigs.isMaintenance,
      groupName: checkConfigs.groupName,
      updatedAt: checkConfigs.updatedAt,
    })
    .from(checkConfigs)
    .where(scope);

  return c.json({ configs: rows });
});

// POST / — create
configsRouter.post("/", async (c) => {
  const db = c.get("db");
  const user = c.get("appUser");
  const body = await c.req.json().catch(() => ({}));

  const name = String(body.name ?? "").trim();
  const type = String(body.type ?? "");
  const modelId = String(body.modelId ?? "").trim();
  const endpoint = String(body.endpoint ?? "").trim();
  const apiKey = String(body.apiKey ?? "").trim();
  const groupName = String(body.groupName ?? "").trim() || null;
  const enabled = body.enabled !== false;
  const isMaintenance = body.isMaintenance === true;

  if (!name || !isProviderType(type) || !modelId || !endpoint || !apiKey) {
    return c.json({ error: "缺少必填字段 (name/type/modelId/endpoint/apiKey)" }, 400);
  }
  // Members can only create in their own group.
  if (!isAdminUser(user) && groupName !== getRequiredGroupName(user)) {
    return c.json({ error: "成员只能在自己分组下创建配置" }, 403);
  }
  // Type-match validation (replaces PG trigger).
  const modelRows = await db.select({ type: checkModels.type }).from(checkModels).where(eq(checkModels.id, modelId));
  const model = modelRows[0];
  if (!model) {
    return c.json({ error: "指定的模型不存在" }, 400);
  }
  if (model.type !== type) {
    return c.json({ error: `模型类型不匹配: config.type=${type}, model.type=${model.type}` }, 400);
  }

  const id = crypto.randomUUID();
  await db.insert(checkConfigs).values({
    id,
    name,
    type,
    modelId,
    endpoint,
    apiKey,
    enabled,
    isMaintenance,
    groupName,
  });

  return c.json({ id }, 201);
});

// PUT /:id — update
configsRouter.put("/:id", async (c) => {
  const db = c.get("db");
  const user = c.get("appUser");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));

  // Scope check: fetch existing, verify ownership.
  const existing = await db.select().from(checkConfigs).where(eq(checkConfigs.id, id));
  const config = existing[0];
  if (!config) {
    return c.json({ error: "配置不存在" }, 404);
  }
  if (!isGroupInUserScope(user, config.groupName)) {
    return c.json({ error: "无权修改该配置" }, 403);
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
  if (typeof body.endpoint === "string" && body.endpoint.trim()) updates.endpoint = body.endpoint.trim();
  if (typeof body.apiKey === "string" && body.apiKey.trim()) updates.apiKey = body.apiKey.trim();
  if (typeof body.enabled === "boolean") updates.enabled = body.enabled;
  if (typeof body.isMaintenance === "boolean") updates.isMaintenance = body.isMaintenance;
  if (typeof body.groupName === "string") {
    const gn = body.groupName.trim() || null;
    if (!isAdminUser(user) && gn !== getRequiredGroupName(user)) {
      return c.json({ error: "成员只能配置自己分组" }, 403);
    }
    updates.groupName = gn;
  }
  if (typeof body.modelId === "string" && body.modelId.trim()) {
    const modelRows = await db.select({ type: checkModels.type }).from(checkModels).where(eq(checkModels.id, body.modelId));
    const model = modelRows[0];
    if (!model) return c.json({ error: "指定的模型不存在" }, 400);
    if (model.type !== config.type) {
      return c.json({ error: "模型类型不匹配" }, 400);
    }
    updates.modelId = body.modelId;
  }

  await db.update(checkConfigs).set(updates).where(eq(checkConfigs.id, id));
  return c.json({ ok: true });
});

// DELETE /:id
configsRouter.delete("/:id", async (c) => {
  const db = c.get("db");
  const user = c.get("appUser");
  const id = c.req.param("id");

  const existing = await db.select({ groupName: checkConfigs.groupName }).from(checkConfigs).where(eq(checkConfigs.id, id));
  const config = existing[0];
  if (!config) {
    return c.json({ error: "配置不存在" }, 404);
  }
  if (!isGroupInUserScope(user, config.groupName)) {
    return c.json({ error: "无权删除该配置" }, 403);
  }

  await db.delete(checkConfigs).where(eq(checkConfigs.id, id));
  return c.json({ ok: true });
});

// POST /batch — batch operations
type BatchOp =
  | "enable"
  | "disable"
  | "maintenance_on"
  | "maintenance_off"
  | "delete";

configsRouter.post("/batch", async (c) => {
  const db = c.get("db");
  const user = c.get("appUser");
  const body = await c.req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.ids) ? body.ids.filter((x: unknown) => typeof x === "string") : [];
  const operation = String(body.operation ?? "") as BatchOp;

  if (ids.length === 0) {
    return c.json({ error: "先选中至少一条配置" }, 400);
  }
  if (!["enable", "disable", "maintenance_on", "maintenance_off", "delete"].includes(operation)) {
    return c.json({ error: "批量操作类型非法" }, 400);
  }

  // Scope the batch to the user's allowed configs.
  const group = isAdminUser(user) ? null : getRequiredGroupName(user);
  const scope = group ? eq(checkConfigs.groupName, group) : undefined;
  const target = await db.select({ id: checkConfigs.id }).from(checkConfigs).where(and(inArray(checkConfigs.id, ids), scope));
  const targetIds = target.map((r) => r.id);

  if (targetIds.length === 0) {
    return c.json({ error: "没有匹配的配置" }, 404);
  }

  if (operation === "delete") {
    await db.delete(checkConfigs).where(inArray(checkConfigs.id, targetIds));
  } else {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (operation === "enable") updates.enabled = true;
    if (operation === "disable") updates.enabled = false;
    if (operation === "maintenance_on") updates.isMaintenance = true;
    if (operation === "maintenance_off") updates.isMaintenance = false;
    await db.update(checkConfigs).set(updates).where(inArray(checkConfigs.id, targetIds));
  }

  return c.json({ affected: targetIds.length });
});
