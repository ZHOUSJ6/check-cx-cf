/**
 * GET /api/notifications — active system notifications.
 * Migrated from check-cx app/api/notifications/route.ts.
 */

import { Hono } from "hono";

import type { AppEnv } from "#/api/app";
import { getActiveSystemNotifications } from "#/db/queries/notifications";

export const notificationsRouter = new Hono<AppEnv>();

notificationsRouter.get("/", async (c) => {
  const db = c.get("db");
  const notifications = await getActiveSystemNotifications(db);
  return c.json(notifications, 200, {
    "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
  });
});
