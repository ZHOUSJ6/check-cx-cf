/**
 * Health snapshot service — migrated from check-cx lib/core/health-snapshot-service.ts.
 *
 * Key architectural change: in the Workers model the PollerDO owns all
 * active polling, so the dashboard read path NEVER triggers checks at
 * request time. This collapses the "missing"/"always" refresh-on-read logic
 * (which depended on in-process leadership) into pure history reads.
 * buildProviderTimelines is preserved (incl. maintenance + official status).
 */

import type { Database } from "#/db/client";
import type {
  CheckResult,
  HistorySnapshot,
  ProviderConfig,
  ProviderTimeline,
} from "#/types";
import { loadHistory } from "#/db/queries/history";
import type { OfficialStatusResult, ProviderType } from "#/types";

/** Read history scoped to a set of config ids (no on-read triggering). */
export async function loadSnapshotForScope(
  db: Database,
  allowedIds: Set<string>,
  limitPerConfig?: number,
): Promise<HistorySnapshot> {
  if (allowedIds.size === 0) {
    return {};
  }
  return loadHistory(db, { allowedIds, limitPerConfig });
}

export interface SnapshotScope {
  pollIntervalMs: number;
  activeConfigs: ProviderConfig[];
  allowedIds: Set<string>;
  limitPerConfig?: number;
}

export async function loadSnapshot(
  db: Database,
  scope: SnapshotScope,
): Promise<HistorySnapshot> {
  return loadSnapshotForScope(db, scope.allowedIds, scope.limitPerConfig);
}

/**
 * Assemble provider timelines from history + maintenance configs.
 * Official status is attached from the provided map (kept by the DO).
 */
export function buildProviderTimelines(
  history: HistorySnapshot,
  maintenanceConfigs: ProviderConfig[],
  officialStatusByType?: ReadonlyMap<ProviderType, OfficialStatusResult>,
): ProviderTimeline[] {
  const mapped: ProviderTimeline[] = [];
  for (const [id, items] of Object.entries(history)) {
    if (items.length === 0) {
      continue;
    }
    const latest = attachOfficialStatus(items[0], officialStatusByType);
    if (latest) {
      mapped.push({ id, items, latest });
    }
  }

  const maintenanceTimelines = maintenanceConfigs.map((config) =>
    createMaintenanceTimeline(config, officialStatusByType),
  );

  return [...mapped, ...maintenanceTimelines].sort((a, b) =>
    a.latest.name.localeCompare(b.latest.name),
  );
}

function attachOfficialStatus(
  result: CheckResult | undefined,
  officialStatusByType?: ReadonlyMap<ProviderType, OfficialStatusResult>,
): CheckResult | undefined {
  if (!result) {
    return undefined;
  }
  if (!officialStatusByType) {
    return result;
  }
  const officialStatus = officialStatusByType.get(result.type);
  if (!officialStatus) {
    return result;
  }
  return { ...result, officialStatus };
}

function createMaintenanceTimeline(
  config: ProviderConfig,
  officialStatusByType?: ReadonlyMap<ProviderType, OfficialStatusResult>,
): ProviderTimeline {
  const base: CheckResult = {
    id: config.id,
    name: config.name,
    type: config.type,
    endpoint: config.endpoint,
    model: config.model,
    status: "maintenance",
    latencyMs: null,
    pingLatencyMs: null,
    message: "配置处于维护模式",
    checkedAt: new Date().toISOString(),
    groupName: config.groupName || null,
  };

  return {
    id: config.id,
    items: [],
    latest: attachOfficialStatus(base, officialStatusByType) ?? base,
  };
}
