/** /api/admin/notifications — system notification CRUD (admin only). */
import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";

import type { AdminEnv } from "#/api/admin/app";
import { isAdminUser } from "#/middleware/require-session";
import { systemNotifications } from "#/db/schema";
import type { NotificationLevel } from "#/db/schema";

export const notificationsRouter = new Hono<AdminEnv>();

function isLevel(v: string): v is NotificationLevel {
  return v === "info" || v === "warning" || v === "error";
}

notificationsRouter.get("/", async (c) => {
  const db = c.get("db");
  const rows = await db.select().from(systemNotifications).orderBy(desc(systemNotifications.createdAt));
  return c.json({ notifications: rows });
});

notificationsRouter.post("/", async (c) => {
  if (!isAdminUser(c.get("appUser"))) return c.json({ error: "仅管理员可操作" }, 403);
  const db = c.get("db");
  const body = await c.req.json().catch(() => ({}));
  const message = String(body.message ?? "").trim();
  if (!message) return c.json({ error: "通知内容不能为空" }, 400);
  const level = isLevel(String(body.level ?? "info")) ? (body.level as NotificationLevel) : "info";
  const id = crypto.randomUUID();
  await db.insert(systemNotifications).values({
    id,
    message,
    isActive: body.isActive !== false,
    level,
  });
  return c.json({ id }, 201);
});

notificationsRouter.put("/:id", async (c) => {
  if (!isAdminUser(c.get("appUser"))) return c.json({ error: "仅管理员可操作" }, 403);
  const db = c.get("db");
  const body = await c.req.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};
  if (typeof body.message === "string" && body.message.trim()) updates.message = body.message.trim();
  if (typeof body.isActive === "boolean") updates.isActive = body.isActive;
  if (typeof body.level === "string" && isLevel(body.level)) updates.level = body.level;
  await db.update(systemNotifications).set(updates).where(eq(systemNotifications.id, c.req.param("id")));
  return c.json({ ok: true });
});

notificationsRouter.delete("/:id", async (c) => {
  if (!isAdminUser(c.get("appUser"))) return c.json({ error: "仅管理员可操作" }, 403);
  const db = c.get("db");
  await db.delete(systemNotifications).where(eq(systemNotifications.id, c.req.param("id")));
  return c.json({ ok: true });
});
