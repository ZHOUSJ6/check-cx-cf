/** /api/admin/system — overview stats + cache reset (admin only). */
import { count, sql } from "drizzle-orm";
import { Hono } from "hono";

import type { AdminEnv } from "#/api/admin/app";
import { isAdminUser } from "#/middleware/require-session";
import {
  adminUsers,
  checkConfigs,
  checkHistory,
  checkModels,
  checkRequestTemplates,
  groupInfo,
  systemNotifications,
} from "#/db/schema";
import { resetAvailabilityCacheMetrics } from "#/db/queries/availability";
import { resetConfigCacheMetrics } from "#/db/queries/config-loader";
import { resetGroupInfoCacheMetrics } from "#/db/queries/group-info";
import { resetDashboardCacheMetrics } from "#/core/dashboard-data";

export const systemRouter = new Hono<AdminEnv>();

systemRouter.get("/", async (c) => {
  if (!isAdminUser(c.get("appUser"))) return c.json({ error: "仅管理员可操作" }, 403);
  const db = c.get("db");

  const [configs, models, templates, groups, notifications, users, history] = await Promise.all([
    db.select({ n: count() }).from(checkConfigs),
    db.select({ n: count() }).from(checkModels),
    db.select({ n: count() }).from(checkRequestTemplates),
    db.select({ n: count() }).from(groupInfo),
    db.select({ n: count() }).from(systemNotifications),
    db.select({ n: count() }).from(adminUsers),
    db.select({ n: count() }).from(checkHistory),
  ]);

  // Latest check time.
  const latest = await db
    .select({ latest: sql<number>`max(${checkHistory.checkedAt})` })
    .from(checkHistory);

  return c.json({
    counts: {
      configs: Number(configs[0]?.n ?? 0),
      models: Number(models[0]?.n ?? 0),
      templates: Number(templates[0]?.n ?? 0),
      groups: Number(groups[0]?.n ?? 0),
      notifications: Number(notifications[0]?.n ?? 0),
      users: Number(users[0]?.n ?? 0),
      history: Number(history[0]?.n ?? 0),
    },
    latestCheckAt: latest[0]?.latest ?? null,
  });
});

// POST /reset-cache — reset all in-process cache metrics counters.
systemRouter.post("/reset-cache", async (c) => {
  if (!isAdminUser(c.get("appUser"))) return c.json({ error: "仅管理员可操作" }, 403);
  resetConfigCacheMetrics();
  resetAvailabilityCacheMetrics();
  resetGroupInfoCacheMetrics();
  resetDashboardCacheMetrics();
  return c.json({ ok: true });
});
