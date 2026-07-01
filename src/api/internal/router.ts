/**
 * GET /api/internal/cache-metrics — cache hit/miss metrics (gated by token).
 * Migrated from check-cx app/api/internal/cache-metrics/route.ts.
 */

import { Hono } from "hono";

import type { AppEnv } from "#/api/app";
import {
  getAvailabilityCacheMetrics,
  resetAvailabilityCacheMetrics,
} from "#/db/queries/availability";
import {
  getConfigCacheMetrics,
  resetConfigCacheMetrics,
} from "#/db/queries/config-loader";
import {
  getGroupInfoCacheMetrics,
  resetGroupInfoCacheMetrics,
} from "#/db/queries/group-info";
import {
  getDashboardCacheMetrics,
  resetDashboardCacheMetrics,
} from "#/core/dashboard-data";

export const internalRouter = new Hono<AppEnv>();

/** Env may carry INTERNAL_METRICS_TOKEN as a secret (not a [var]). */
function isAuthorized(env: Record<string, unknown>, headerToken: string | null | undefined): boolean {
  const token = env.INTERNAL_METRICS_TOKEN;
  if (typeof token !== "string" || !token) {
    return false;
  }
  return headerToken === token;
}

internalRouter.get("/cache-metrics", async (c) => {
  if (!isAuthorized(c.env as unknown as Record<string,unknown>, c.req.header("x-internal-token"))) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const availability = getAvailabilityCacheMetrics();
  const config = getConfigCacheMetrics();
  const groupInfo = getGroupInfoCacheMetrics();
  const dashboard = getDashboardCacheMetrics();

  return c.json({
    availabilityCache: availability,
    configCache: config,
    groupInfoCache: groupInfo,
    dashboardCache: dashboard,
    combinedDbCache: {
      hits: availability.hits + config.hits + groupInfo.hits,
      misses: availability.misses + config.misses + groupInfo.misses,
    },
    generatedAt: new Date().toISOString(),
  });
});

internalRouter.post("/cache-metrics/reset", async (c) => {
  if (!isAuthorized(c.env as unknown as Record<string,unknown>, c.req.header("x-internal-token"))) {
    return c.json({ error: "unauthorized" }, 401);
  }
  resetAvailabilityCacheMetrics();
  resetConfigCacheMetrics();
  resetGroupInfoCacheMetrics();
  resetDashboardCacheMetrics();
  return c.json({ ok: true });
});
