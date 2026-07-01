/**
 * GET /api/group/:name — group-scoped dashboard data with ETag.
 * Migrated from check-cx app/api/group/[groupName]/route.ts.
 */

import { Hono } from "hono";

import type { AppEnv } from "#/api/app";
import { loadGroupDashboardData } from "#/core/group-data";
import { getOfficialStatusFromDO } from "#/api/do-helper";
import type { AvailabilityPeriod } from "#/types";

const VALID_PERIODS: AvailabilityPeriod[] = ["7d", "15d", "30d"];

export const groupRouter = new Hono<AppEnv>();

groupRouter.get("/:name", async (c) => {
  const db = c.get("db");
  const groupName = decodeURIComponent(c.req.param("name"));

  const periodParam = c.req.query("trendPeriod");
  const forceRefreshParam = c.req.query("forceRefresh");
  const shouldForceRefresh = forceRefreshParam === "1" || forceRefreshParam === "true";
  const trendPeriod = VALID_PERIODS.includes(periodParam as AvailabilityPeriod)
    ? (periodParam as AvailabilityPeriod)
    : undefined;

  const officialStatusMap = await getOfficialStatusFromDO(c.env as unknown as { POLLER?: DurableObjectNamespace });

  const result = await loadGroupDashboardData(
    db,
    groupName,
    {
      env: c.env,
      ctx: c.executionCtx,
      officialStatusByType: officialStatusMap ?? undefined,
    },
    { refreshMode: shouldForceRefresh ? "always" : "never", trendPeriod },
  );

  if (!result) {
    return c.json({ error: "分组不存在或没有配置" }, 404);
  }

  const ifNoneMatch = c.req.header("If-None-Match");
  if (ifNoneMatch === result.etag) {
    return new Response(null, { status: 304 });
  }

  return c.json(result.data, 200, {
    ETag: result.etag,
    "Cache-Control": "no-store",
  });
});
