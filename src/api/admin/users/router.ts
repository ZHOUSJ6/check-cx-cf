/** /api/admin/users — directory CRUD + invite/activate/role (admin only). */
import { eq } from "drizzle-orm";
import { Hono } from "hono";

import type { AdminEnv } from "#/api/admin/app";
import { isAdminUser } from "#/middleware/require-session";
import { adminUsers } from "#/db/schema";
import type { AdminRole } from "#/db/schema";

export const usersRouter = new Hono<AdminEnv>();

function isRole(v: string): v is AdminRole {
  return v === "admin" || v === "member";
}

usersRouter.get("/", async (c) => {
  if (!isAdminUser(c.get("appUser"))) return c.json({ error: "仅管理员可操作" }, 403);
  const db = c.get("db");
  const rows = await db
    .select({
      id: adminUsers.id,
      email: adminUsers.email,
      role: adminUsers.role,
      groupName: adminUsers.groupName,
      authUserId: adminUsers.authUserId,
      isActive: adminUsers.isActive,
      invitedAt: adminUsers.invitedAt,
      activatedAt: adminUsers.activatedAt,
    })
    .from(adminUsers);
  return c.json({ users: rows });
});

// POST / — invite a new directory user (pre-bind, auth_user_id NULL until first login).
usersRouter.post("/", async (c) => {
  if (!isAdminUser(c.get("appUser"))) return c.json({ error: "仅管理员可操作" }, 403);
  const db = c.get("db");
  const body = await c.req.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const role = isRole(String(body.role ?? "member")) ? (body.role as AdminRole) : "member";
  if (!email) return c.json({ error: "邮箱不能为空" }, 400);

  const groupName = role === "admin" ? null : String(body.groupName ?? body.group_name ?? "").trim() || null;
  if (role === "member" && !groupName) {
    return c.json({ error: "成员必须绑定分组" }, 400);
  }

  const id = crypto.randomUUID();
  await db.insert(adminUsers).values({ id, email, role, groupName, isActive: true });
  return c.json({ id }, 201);
});

usersRouter.put("/:id", async (c) => {
  if (!isAdminUser(c.get("appUser"))) return c.json({ error: "仅管理员可操作" }, 403);
  const db = c.get("db");
  const body = await c.req.json().catch(() => ({}));
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof body.role === "string" && isRole(body.role)) updates.role = body.role;
  if (typeof body.groupName !== "undefined") updates.groupName = body.groupName?.trim() || null;
  if (typeof body.isActive === "boolean") updates.isActive = body.isActive;
  await db.update(adminUsers).set(updates).where(eq(adminUsers.id, c.req.param("id")));
  return c.json({ ok: true });
});

usersRouter.delete("/:id", async (c) => {
  if (!isAdminUser(c.get("appUser"))) return c.json({ error: "仅管理员可操作" }, 403);
  const db = c.get("db");
  // Unbind auth_user_id rather than hard-delete (preserves audit trail).
  await db.update(adminUsers).set({ authUserId: null, isActive: false, updatedAt: new Date() }).where(eq(adminUsers.id, c.req.param("id")));
  return c.json({ ok: true });
});
