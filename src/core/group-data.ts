/**
 * Group dashboard data — migrated from check-cx lib/core/group-data.ts.
 * Module-level Map cache → Cache API (design §4). On-read refresh dropped (DO polls).
 */

import type { Database } from "#/db/client";
import { loadProviderConfigsFromDB } from "#/db/queries/config-loader";
import { getGroupInfo, loadGroupInfos } from "#/db/queries/group-info";
import { getAvailabilityStats } from "#/db/queries/availability";
import {
  getPollingIntervalLabel,
  getPollingIntervalMs,
} from "#/core/polling-config";
import { buildProviderTimelines, loadSnapshot } from "#/core/health-snapshot";
import { generateETag } from "#/core/etag";
import { cacheGet, cachePut } from "#/cache/cache-api";
import {
  UNGROUPED_DISPLAY_NAME,
  UNGROUPED_KEY,
} from "#/types";
import type {
  AvailabilityPeriod,
  AvailabilityStatsMap,
  GroupInfoSummary,
  OfficialStatusResult,
  ProviderTimeline,
  ProviderType,
  RefreshMode,
} from "#/types";

export interface GroupDashboardLoadResult {
  data: GroupDashboardData;
  etag: string;
}

export interface GroupDashboardData {
  groupName: string;
  displayName: string;
  tags: string;
  providerTimelines: ProviderTimeline[];
  lastUpdated: string | null;
  total: number;
  pollIntervalLabel: string;
  pollIntervalMs: number;
  availabilityStats: AvailabilityStatsMap;
  trendPeriod: AvailabilityPeriod;
  generatedAt: number;
  websiteUrl?: string | null;
}

interface FullEnv {
  CHECK_POLL_INTERVAL_SECONDS?: string;
}

interface RequestContext {
  env: FullEnv;
  ctx: Pick<ExecutionContext, "waitUntil">;
  officialStatusByType?: ReadonlyMap<ProviderType, OfficialStatusResult>;
}

function getGroupCacheKey(
  groupName: string,
  pollIntervalMs: number,
  providerKey: string,
  trendPeriod: AvailabilityPeriod,
): string {
  return `group:${groupName}:${pollIntervalMs}:${trendPeriod}:${providerKey}`;
}

/** All available group names (including the synthetic ungrouped key). */
export async function getAvailableGroups(
  db: Database,
  req: RequestContext,
): Promise<string[]> {
  const allConfigs = await loadProviderConfigsFromDB(db, req);
  const groupSet = new Set<string>();
  for (const config of allConfigs) {
    if (config.groupName) {
      groupSet.add(config.groupName);
    }
  }
  const hasUngrouped = allConfigs.some((config) => !config.groupName);
  if (hasUngrouped) {
    groupSet.add(UNGROUPED_KEY);
  }
  return [...groupSet].sort();
}

export async function loadGroupDashboardData(
  db: Database,
  targetGroupName: string,
  req: RequestContext,
  options?: { refreshMode?: RefreshMode; trendPeriod?: AvailabilityPeriod },
): Promise<GroupDashboardLoadResult | null> {
  const allConfigs = await loadProviderConfigsFromDB(db, req);

  const isTargetUngrouped = targetGroupName === UNGROUPED_KEY;
  const groupConfigs = allConfigs.filter((config) =>
    isTargetUngrouped ? !config.groupName : config.groupName === targetGroupName,
  );

  if (groupConfigs.length === 0) {
    return null;
  }

  const maintenanceConfigs = groupConfigs.filter((cfg) => cfg.isMaintenance);
  const activeConfigs = groupConfigs.filter((cfg) => !cfg.isMaintenance);
  const allowedIds = new Set(activeConfigs.map((item) => item.id));
  const pollIntervalMs = getPollingIntervalMs(req.env);
  const pollIntervalLabel = getPollingIntervalLabel(req.env);
  const providerKey =
    allowedIds.size > 0 ? [...allowedIds].sort().join("|") : "__empty__";
  const refreshMode = options?.refreshMode ?? "never";
  const trendPeriod = options?.trendPeriod ?? "7d";
  const cacheKey = getGroupCacheKey(
    targetGroupName,
    pollIntervalMs,
    providerKey,
    trendPeriod,
  );
  const shouldBypassCache = refreshMode === "always";

  if (!shouldBypassCache) {
    const cached = await cacheGet<GroupDashboardLoadResult>(cacheKey);
    if (cached) {
      cached.data.generatedAt = Date.now();
      return cached;
    }
  }

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

  const configIds = groupConfigs.map((config) => config.id);
  const availabilityStats = await getAvailabilityStats(db, configIds);

  let websiteUrl: string | null = null;
  let tags = "";
  if (!isTargetUngrouped) {
    const info = await getGroupInfo(db, targetGroupName);
    websiteUrl = info?.websiteUrl ?? null;
    tags = info?.tags ?? "";
  }

  const data: GroupDashboardData = {
    groupName: targetGroupName,
    displayName: isTargetUngrouped ? UNGROUPED_DISPLAY_NAME : targetGroupName,
    tags,
    providerTimelines,
    lastUpdated,
    total: providerTimelines.length,
    pollIntervalLabel,
    pollIntervalMs,
    availabilityStats,
    trendPeriod,
    generatedAt: Date.now(),
    websiteUrl,
  };

  const { generatedAt: _ignored, ...etagPayload } = data;
  void _ignored;
  const etag = generateETag(JSON.stringify(etagPayload));
  const result: GroupDashboardLoadResult = { data, etag };

  if (!shouldBypassCache) {
    cachePut(cacheKey, result, pollIntervalMs, req.ctx);
  }

  return result;
}

// Re-export for callers that need the typed group info summary list.
export type { GroupInfoSummary };
export { loadGroupInfos };
