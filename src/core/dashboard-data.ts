/**
 * Dashboard data aggregation — migrated from check-cx lib/core/dashboard-data.ts.
 *
 * Architectural change: module-level Map cache → Cloudflare Cache API
 * (design §4). The on-read "refresh" modes are dropped (DO polls actively);
 * refreshMode now only controls cache bypass for forceRefresh requests.
 */

import type { Database } from "#/db/client";
import { loadProviderConfigsFromDB } from "#/db/queries/config-loader";
import { loadGroupInfos } from "#/db/queries/group-info";
import { getAvailabilityStats } from "#/db/queries/availability";
import {
  getPollingIntervalLabel,
  getPollingIntervalMs,
} from "#/core/polling-config";
import { buildProviderTimelines, loadSnapshot } from "#/core/health-snapshot";
import { generateETag } from "#/core/etag";
import { cacheGet, cachePut } from "#/cache/cache-api";
import type {
  AvailabilityPeriod,
  AvailabilityStatsMap,
  DashboardData,
  GroupInfoSummary,
  OfficialStatusResult,
  ProviderType,
  RefreshMode,
} from "#/types";

export interface DashboardLoadResult {
  data: DashboardData;
  etag: string;
}

const METRICS = { hits: 0, misses: 0, inflightHits: 0 };

export function getDashboardCacheMetrics() {
  return { ...METRICS };
}
export function resetDashboardCacheMetrics(): void {
  METRICS.hits = 0;
  METRICS.misses = 0;
  METRICS.inflightHits = 0;
}

interface FullEnv {
  CHECK_POLL_INTERVAL_SECONDS?: string;
}

interface RequestContext {
  env: FullEnv;
  ctx: Pick<ExecutionContext, "waitUntil">;
  officialStatusByType?: ReadonlyMap<ProviderType, OfficialStatusResult>;
}

function getDashboardCacheKey(
  pollIntervalMs: number,
  providerKey: string,
  trendPeriod: AvailabilityPeriod,
): string {
  return `dashboard:${pollIntervalMs}:${trendPeriod}:${providerKey}`;
}

function getDashboardCacheTtlMs(pollIntervalMs: number): number {
  return Number.isFinite(pollIntervalMs) && pollIntervalMs > 0
    ? pollIntervalMs
    : 5 * 60 * 1000;
}

function buildDashboardEtag(data: DashboardData): string {
  const { generatedAt: _ignored, ...etagPayload } = data;
  void _ignored;
  return generateETag(JSON.stringify(etagPayload));
}

export async function loadDashboardDataWithEtag(
  db: Database,
  req: RequestContext,
  options?: { refreshMode?: RefreshMode; trendPeriod?: AvailabilityPeriod },
): Promise<DashboardLoadResult> {
  const allConfigs = await loadProviderConfigsFromDB(db, req);
  const maintenanceConfigs = allConfigs.filter((cfg) => cfg.isMaintenance);
  const activeConfigs = allConfigs.filter((cfg) => !cfg.isMaintenance);

  const allowedIds = new Set(activeConfigs.map((item) => item.id));
  const pollIntervalMs = getPollingIntervalMs(req.env);
  const pollIntervalLabel = getPollingIntervalLabel(req.env);
  const providerKey =
    allowedIds.size > 0 ? [...allowedIds].sort().join("|") : "__empty__";
  const refreshMode = options?.refreshMode ?? "never";
  const trendPeriod = options?.trendPeriod ?? "7d";
  const cacheKey = getDashboardCacheKey(pollIntervalMs, providerKey, trendPeriod);
  const shouldBypassCache = refreshMode === "always";

  // Cache hit (unless force-refresh)
  if (!shouldBypassCache) {
    const cached = await cacheGet<DashboardLoadResult>(cacheKey);
    if (cached) {
      METRICS.hits += 1;
      cached.data.generatedAt = Date.now();
      return cached;
    }
  }

  METRICS.misses += 1;

  const history = await loadSnapshot(db, {
    pollIntervalMs,
    activeConfigs,
    allowedIds,
  });

  const providerTimelines = buildProviderTimelines(
    history,
    maintenanceConfigs,
    req.officialStatusByType,
  );

  let lastUpdated: string | null = null;
  let lastUpdatedMs = 0;
  for (const timeline of providerTimelines) {
    const checkedAtMs = Date.parse(timeline.latest.checkedAt);
    if (Number.isFinite(checkedAtMs) && checkedAtMs > lastUpdatedMs) {
      lastUpdatedMs = checkedAtMs;
      lastUpdated = timeline.latest.checkedAt;
    }
  }

  const groupInfos = await loadGroupInfos(db, req);
  const groupInfoSummaries: GroupInfoSummary[] = groupInfos.map((info) => ({
    groupName: info.groupName,
    websiteUrl: info.websiteUrl ?? null,
    tags: info.tags,
  }));
  const configIds = allConfigs.map((config) => config.id);
  const availabilityStats: AvailabilityStatsMap = await getAvailabilityStats(
    db,
    configIds,
  );

  const data: DashboardData = {
    providerTimelines,
    groupInfos: groupInfoSummaries,
    lastUpdated,
    total: providerTimelines.length,
    pollIntervalLabel,
    pollIntervalMs,
    availabilityStats,
    trendPeriod,
    generatedAt: Date.now(),
  };

  const etag = buildDashboardEtag(data);
  const result: DashboardLoadResult = { data, etag };

  if (!shouldBypassCache) {
    cachePut(cacheKey, result, getDashboardCacheTtlMs(pollIntervalMs), req.ctx);
  }

  return result;
}
