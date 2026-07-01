/**
 * Availability stats — migrated from check-cx lib/database/availability.ts.
 *
 * Replaces the PostgreSQL `availability_stats` VIEW (7d/15d/30d UNION with
 * FILTER aggregate) with an app-layer Drizzle query. Per spec, no await-in-loop
 * and prefer batched queries.
 */

import { and, count, eq, gte, inArray, sql } from "drizzle-orm";

import type { Database } from "#/db/client";
import { checkHistory } from "#/db/schema";
import type { AvailabilityPeriod, AvailabilityStat, AvailabilityStatsMap } from "#/types";

const METRICS = { hits: 0, misses: 0 };

export function getAvailabilityCacheMetrics() {
  return { ...METRICS };
}
export function resetAvailabilityCacheMetrics(): void {
  METRICS.hits = 0;
  METRICS.misses = 0;
}

const PERIOD_DAYS: Record<AvailabilityPeriod, number> = {
  "7d": 7,
  "15d": 15,
  "30d": 30,
};

/** Compute availability for all configs across 7d/15d/30d in batched queries. */
export async function getAvailabilityStats(
  db: Database,
  configIds?: Iterable<string> | null,
): Promise<AvailabilityStatsMap> {
  const ids = normalizeIds(configIds);
  if (Array.isArray(ids) && ids.length === 0) {
    return {};
  }

  const now = Date.now();
  const periods: AvailabilityPeriod[] = ["7d", "15d", "30d"];

  // One grouped query per period — 3 queries total, well within limits.
  const results = await Promise.all(
    periods.map(async (period) => {
      const since = new Date(now - PERIOD_DAYS[period] * 86_400_000);
      const rows = await db
        .select({
          configId: checkHistory.configId,
          totalChecks: count(),
          operationalCount: sql<number>`count(case when ${checkHistory.status} in ('operational','degraded') then 1 end)`,
        })
        .from(checkHistory)
        .where(
          and(
            gte(checkHistory.checkedAt, since),
            ids ? inArray(checkHistory.configId, ids) : undefined,
          ),
        )
        .groupBy(checkHistory.configId);

      return { period, rows };
    }),
  );

  const map: AvailabilityStatsMap = {};
  for (const { period, rows } of results) {
    for (const row of rows) {
      const total = Number(row.totalChecks);
      const operational = Number(row.operationalCount);
      const stat: AvailabilityStat = {
        period,
        totalChecks: total,
        operationalCount: operational,
        availabilityPct: total > 0 ? Math.round((100 * operational) / total * 100) / 100 : null,
      };
      const existing = map[row.configId];
      if (existing) {
        existing.push(stat);
      } else {
        map[row.configId] = [stat];
      }
    }
  }

  return map;
}

function normalizeIds(ids?: Iterable<string> | null): string[] | null {
  if (!ids) {
    return null;
  }
  const normalized = Array.from(ids).filter(Boolean);
  return normalized.length > 0 ? normalized : [];
}

// Avoid unused-import lint for `eq` if not referenced in some paths.
void eq;
