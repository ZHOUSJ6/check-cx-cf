/** /api/admin/groups — group info CRUD (admin only). */
import { eq } from "drizzle-orm";
import { Hono } from "hono";

import type { AdminEnv } from "#/api/admin/app";
import { isAdminUser } from "#/middleware/require-session";
import { groupInfo } from "#/db/schema";

export const groupsRouter = new Hono<AdminEnv>();

groupsRouter.get("/", async (c) => {
  const db = c.get("db");
  const rows = await db.select().from(groupInfo);
  return c.json({ groups: rows });
});

groupsRouter.post("/", async (c) => {
  if (!isAdminUser(c.get("appUser"))) return c.json({ error: "仅管理员可操作" }, 403);
  const db = c.get("db");
  const body = await c.req.json().catch(() => ({}));
  const groupName = String(body.groupName ?? body.group_name ?? "").trim();
  if (!groupName) return c.json({ error: "分组名称不能为空" }, 400);
  const id = crypto.randomUUID();
  await db.insert(groupInfo).values({
    id,
    groupName,
    websiteUrl: typeof body.websiteUrl === "string" ? body.websiteUrl : (body.website_url ?? null),
    tags: typeof body.tags === "string" ? body.tags : "",
  });
  return c.json({ id }, 201);
});

groupsRouter.put("/:id", async (c) => {
  if (!isAdminUser(c.get("appUser"))) return c.json({ error: "仅管理员可操作" }, 403);
  const db = c.get("db");
  const body = await c.req.json().catch(() => ({}));
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.groupName === "string" && body.groupName.trim()) updates.groupName = body.groupName.trim();
  if (typeof body.websiteUrl !== "undefined") updates.websiteUrl = body.websiteUrl;
  if (typeof body.website_url !== "undefined") updates.websiteUrl = body.website_url;
  if (typeof body.tags !== "undefined") updates.tags = body.tags;
  await db.update(groupInfo).set(updates).where(eq(groupInfo.id, c.req.param("id")));
  return c.json({ ok: true });
});

groupsRouter.delete("/:id", async (c) => {
  if (!isAdminUser(c.get("appUser"))) return c.json({ error: "仅管理员可操作" }, 403);
  const db = c.get("db");
  await db.delete(groupInfo).where(eq(groupInfo.id, c.req.param("id")));
  return c.json({ ok: true });
});
