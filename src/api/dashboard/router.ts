/**
 * GET /api/dashboard — aggregated dashboard data with ETag conditional requests.
 * Migrated from check-cx app/api/dashboard/route.ts.
 */

import { Hono } from "hono";

import type { AppEnv } from "#/api/app";
import { loadDashboardDataWithEtag } from "#/core/dashboard-data";
import { getOfficialStatusFromDO } from "#/api/do-helper";
import type { AvailabilityPeriod } from "#/types";

const VALID_PERIODS: AvailabilityPeriod[] = ["7d", "15d", "30d"];

export const dashboardRouter = new Hono<AppEnv>();

dashboardRouter.get("/", async (c) => {
  const db = c.get("db");
  const periodParam = c.req.query("trendPeriod");
  const forceRefreshParam = c.req.query("forceRefresh");
  const shouldForceRefresh = forceRefreshParam === "1" || forceRefreshParam === "true";
  const trendPeriod = VALID_PERIODS.includes(periodParam as AvailabilityPeriod)
    ? (periodParam as AvailabilityPeriod)
    : undefined;

  const officialStatusMap = await getOfficialStatusFromDO(c.env as unknown as { POLLER?: DurableObjectNamespace });

  const { data, etag } = await loadDashboardDataWithEtag(
    db,
    {
      env: c.env,
      ctx: c.executionCtx,
      officialStatusByType: officialStatusMap ?? undefined,
    },
    { refreshMode: shouldForceRefresh ? "always" : "never", trendPeriod },
  );

  // Conditional request
  const ifNoneMatch = c.req.header("If-None-Match");
  if (ifNoneMatch === etag) {
    return new Response(null, { status: 304 });
  }

  return c.json(data, 200, { ETag: etag, "Cache-Control": "no-store" });
});
