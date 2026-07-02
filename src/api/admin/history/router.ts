/** /api/admin/history — list (scoped) + clear (scoped). */
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { Hono } from "hono";

import type { AdminEnv } from "#/api/admin/app";
import {
  getRequiredGroupName,
  isAdminUser,
} from "#/middleware/require-session";
import { checkConfigs, checkHistory } from "#/db/schema";

export const historyRouter = new Hono<AdminEnv>();

historyRouter.get("/", async (c) => {
  const db = c.get("db");
  const user = c.get("appUser");
  const limit = Math.min(Number(c.req.query("limit") ?? "100"), 500);

  // Scoped join: members only see history for their group's configs.
  const group = isAdminUser(user) ? null : getRequiredGroupName(user);
  const scope = group ? eq(checkConfigs.groupName, group) : undefined;

  const rows = await db
    .select({
      id: checkHistory.id,
      configId: checkHistory.configId,
      status: checkHistory.status,
      latencyMs: checkHistory.latencyMs,
      pingLatencyMs: checkHistory.pingLatencyMs,
      checkedAt: checkHistory.checkedAt,
      message: checkHistory.message,
      configName: checkConfigs.name,
      groupName: checkConfigs.groupName,
    })
    .from(checkHistory)
    .innerJoin(checkConfigs, eq(checkConfigs.id, checkHistory.configId))
    .where(scope)
    .orderBy(desc(checkHistory.checkedAt))
    .limit(limit);

  return c.json({ history: rows });
});

// POST /clear — delete history older than a cutoff (days), scoped.
historyRouter.post("/clear", async (c) => {
  const db = c.get("db");
  const user = c.get("appUser");
  const body = await c.req.json().catch(() => ({}));
  const days = Number(body.days ?? 30);
  const cutoff = new Date(Date.now() - days * 86_400_000);

  // Find scoped config ids first, then delete their old history.
  const group = isAdminUser(user) ? null : getRequiredGroupName(user);
  const scope = group ? eq(checkConfigs.groupName, group) : undefined;
  const configs = await db.select({ id: checkConfigs.id }).from(checkConfigs).where(scope);
  const configIds = configs.map((r) => r.id);

  if (configIds.length === 0) {
    return c.json({ deleted: 0 });
  }

  const result = await db
    .delete(checkHistory)
    .where(and(inArray(checkHistory.configId, configIds), lt(checkHistory.checkedAt, cutoff)));

  return c.json({ deleted: (result as unknown as { meta?: { changes?: number } }).meta?.changes ?? 0 });
});
