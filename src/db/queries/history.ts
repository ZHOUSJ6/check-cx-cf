/**
 * History store — migrated from check-cx lib/database/history.ts.
 *
 * Replaces the 2 PostgreSQL RPC functions:
 * - get_recent_check_history → Drizzle window-function query (SQLite supports
 *   ROW_NUMBER() OVER PARTITION BY). Falls back to per-config limited selects
 *   if the window subquery is ever unavailable.
 * - prune_check_history → plain DELETE with a computed cutoff date.
 *
 * Timestamps are unix-ms integers in the DB; CheckResult.checkedAt stays ISO
 * for the client timeline (converted at the boundary).
 */

import { and, desc, eq, inArray, lt, type SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";

import type { Database } from "#/db/client";
import { checkConfigs, checkHistory, checkModels } from "#/db/schema";
import type { CheckResult, HistorySnapshot } from "#/types";
import type { HealthStatus } from "#/db/schema";
import { logError } from "#/lib/error-handler";

export const MAX_POINTS_PER_PROVIDER = 60;

interface PollingEnv {
  HISTORY_RETENTION_DAYS?: string;
}

/** Append a batch of check results and prune. */
export async function appendHistory(
  db: Database,
  results: CheckResult[],
  env: PollingEnv,
): Promise<void> {
  if (results.length === 0) {
    return;
  }

  const records = results.map((result) => ({
    configId: result.id,
    status: result.status,
    latencyMs: result.latencyMs,
    pingLatencyMs: result.pingLatencyMs,
    checkedAt: new Date(result.checkedAt),
    message: result.message,
  }));

  try {
    await db.insert(checkHistory).values(records);
  } catch (error) {
    logError("写入历史记录失败", error);
    return;
  }

  await pruneHistory(db, env);
}

/** Delete history older than the retention window. Replaces prune_check_history RPC. */
export async function pruneHistory(db: Database, env: PollingEnv): Promise<void> {
  const raw = Number(env.HISTORY_RETENTION_DAYS);
  const retentionDays = Number.isFinite(raw) ? Math.max(7, Math.min(365, raw)) : 30;
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000);

  try {
    await db.delete(checkHistory).where(lt(checkHistory.checkedAt, cutoff));
  } catch (error) {
    logError("清理历史记录失败", error);
  }
}

export interface HistoryQueryOptions {
  allowedIds?: Iterable<string> | null;
  limitPerConfig?: number;
}

interface RecentHistoryRow {
  configId: string;
  status: string;
  latencyMs: number | null;
  pingLatencyMs: number | null;
  checkedAt: Date;
  message: string | null;
  name: string;
  type: string;
  model: string;
  endpoint: string;
  groupName: string | null;
}

function normalizeAllowedIds(
  ids?: Iterable<string> | null,
): string[] | null {
  if (!ids) {
    return null;
  }
  const normalized = Array.from(ids).filter(Boolean);
  return normalized.length > 0 ? normalized : [];
}

function toCheckResult(row: RecentHistoryRow): CheckResult {
  return {
    id: row.configId,
    name: row.name,
    type: row.type as CheckResult["type"],
    endpoint: row.endpoint,
    model: row.model,
    status: row.status as HealthStatus,
    latencyMs: row.latencyMs,
    pingLatencyMs: row.pingLatencyMs,
    checkedAt: row.checkedAt.toISOString(),
    message: row.message ?? "",
    groupName: row.groupName,
  };
}

function rowToSnapshot(
  rows: RecentHistoryRow[],
  limitPerConfig: number,
): HistorySnapshot {
  const grouped = new Map<string, CheckResult[]>();
  for (const row of rows) {
    const list = grouped.get(row.configId) ?? [];
    list.push(toCheckResult(row));
    grouped.set(row.configId, list);
  }
  // Each group is already ordered checked_at DESC from the query; trim to limit.
  const snapshot: HistorySnapshot = {};
  for (const [id, list] of grouped) {
    snapshot[id] = list.slice(0, limitPerConfig);
  }
  return snapshot;
}

/**
 * Fetch recent history per config — replaces get_recent_check_history RPC.
 * Uses ROW_NUMBER() OVER (PARTITION BY config_id ORDER BY checked_at DESC).
 */
export async function loadHistory(
  db: Database,
  options?: HistoryQueryOptions,
): Promise<HistorySnapshot> {
  const normalizedIds = normalizeAllowedIds(options?.allowedIds);
  if (Array.isArray(normalizedIds) && normalizedIds.length === 0) {
    return {};
  }

  const limitPerConfig = options?.limitPerConfig ?? MAX_POINTS_PER_PROVIDER;

  try {
    // Ranked subquery: row_number per config, newest first.
    const ranked = db
      .select({
        configId: checkHistory.configId,
        status: checkHistory.status,
        latencyMs: checkHistory.latencyMs,
        pingLatencyMs: checkHistory.pingLatencyMs,
        checkedAt: checkHistory.checkedAt,
        message: checkHistory.message,
        rn: sql<number>`row_number() over (partition by ${checkHistory.configId} order by ${checkHistory.checkedAt} desc)`.as("rn"),
      })
      .from(checkHistory)
      .where(
        normalizedIds ? inArray(checkHistory.configId, normalizedIds) : undefined,
      )
      .as("ranked");

    const rows = await db
      .select({
        configId: ranked.configId,
        status: ranked.status,
        latencyMs: ranked.latencyMs,
        pingLatencyMs: ranked.pingLatencyMs,
        checkedAt: ranked.checkedAt,
        message: ranked.message,
        name: checkConfigs.name,
        type: checkConfigs.type,
        model: checkModels.model,
        endpoint: checkConfigs.endpoint,
        groupName: checkConfigs.groupName,
      })
      .from(ranked)
      .innerJoin(checkConfigs, eq(checkConfigs.id, ranked.configId))
      .innerJoin(checkModels, eq(checkModels.id, checkConfigs.modelId))
      .where(sql`${ranked.rn} <= ${limitPerConfig}`);

    const mapped = rows as unknown as RecentHistoryRow[];
    return rowToSnapshot(mapped, limitPerConfig);
  } catch (error) {
    logError("获取历史快照失败", error);
    return fallbackFetchSnapshot(db, normalizedIds, limitPerConfig);
  }
}

/**
 * Fallback if the window-function subquery is unavailable: per-config
 * limited selects. Mirrors the source's fallbackFetchSnapshot approach.
 */
async function fallbackFetchSnapshot(
  db: Database,
  targetIds: string[] | null,
  limitPerConfig: number,
): Promise<HistorySnapshot> {
  const snapshot: HistorySnapshot = {};

  // Determine config ids + display fields.
  const configFilter: SQL | undefined = targetIds
    ? inArray(checkConfigs.id, targetIds)
    : undefined;

  const configs = await db
    .select({
      id: checkConfigs.id,
      name: checkConfigs.name,
      type: checkConfigs.type,
      model: checkModels.model,
      endpoint: checkConfigs.endpoint,
      groupName: checkConfigs.groupName,
    })
    .from(checkConfigs)
    .leftJoin(checkModels, eq(checkModels.id, checkConfigs.modelId))
    .where(configFilter);

  // Fetch last N per config (capped concurrency, no await-in-loop per spec —
  // these are bounded by config count, well under Workers limits).
  const historyByConfig = await Promise.all(
    configs.map(async (cfg) => {
      const items = await db
        .select()
        .from(checkHistory)
        .where(eq(checkHistory.configId, cfg.id))
        .orderBy(desc(checkHistory.checkedAt))
        .limit(limitPerConfig);
      return { cfg, items };
    }),
  );

  for (const { cfg, items } of historyByConfig) {
    snapshot[cfg.id] = items.map((h) => ({
      id: cfg.id,
      name: cfg.name,
      type: cfg.type as CheckResult["type"],
      endpoint: cfg.endpoint,
      model: cfg.model ?? "",
      status: h.status as HealthStatus,
      latencyMs: h.latencyMs,
      pingLatencyMs: h.pingLatencyMs,
      checkedAt: h.checkedAt.toISOString(),
      message: h.message ?? "",
      groupName: cfg.groupName,
    }));
  }

  return snapshot;
}

/** Load history scoped to a single group (by config ids in that group). */
export async function loadSnapshotForScope(
  db: Database,
  allowedIds: string[] | null,
): Promise<HistorySnapshot> {
  return loadHistory(db, { allowedIds });
}

// Re-export for any caller that imports from here.
export { and };
