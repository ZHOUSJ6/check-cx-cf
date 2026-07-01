/**
 * Poller tick — migrated from check-cx lib/core/poller.ts tick().
 *
 * Pure function invoked by the PollerDO alarm. The DO is the single leader
 * (no DB lease), so leadership/re-entrancy guards live in DO storage, not here.
 */

import type { Database } from "#/db/client";
import { createDb } from "#/db/client";
import { loadProviderConfigsFromDB } from "#/db/queries/config-loader";
import { appendHistory } from "#/db/queries/history";
import { runProviderChecks } from "#/providers";
import type { CheckResult, HealthStatus } from "#/types";
import { logError } from "#/lib/error-handler";

const FAILURE_STATUSES: ReadonlySet<HealthStatus> = new Set([
  "failed",
  "validation_failed",
  "error",
]);

interface TickEnv {
  DATABASE_URL: string;
  DATABASE_AUTH_TOKEN: string;
  CHECK_POLL_INTERVAL_SECONDS?: string;
  CHECK_CONCURRENCY?: string;
  HISTORY_RETENTION_DAYS?: string;
  CHECK_NODE_ID?: string;
}

function isFailureResult(result: CheckResult): boolean {
  return FAILURE_STATUSES.has(result.status);
}

function formatDuration(value: number | null): string {
  return typeof value === "number" ? `${value}ms` : "N/A";
}

function normalizeGroupName(groupName: string | null | undefined): string {
  return groupName?.trim() || "默认分组";
}

function logFailedResultsByGroup(results: CheckResult[]): void {
  const failedResults = results.filter(isFailureResult);
  if (failedResults.length === 0) {
    return;
  }

  const grouped = new Map<string, CheckResult[]>();
  for (const result of failedResults) {
    const groupName = normalizeGroupName(result.groupName);
    const items = grouped.get(groupName);
    if (items) {
      items.push(result);
    } else {
      grouped.set(groupName, [result]);
    }
  }

  console.error(
    `[check-cx] 本轮检测失败批次：共 ${failedResults.length} 条，分为 ${grouped.size} 组`,
  );
  for (const [groupName, items] of [...grouped.entries()].sort(([l], [r]) =>
    l.localeCompare(r),
  )) {
    console.error(`[check-cx] [${groupName}] ${items.length} 条`);
    for (const result of items.sort((l, r) => l.name.localeCompare(r.name))) {
      console.error(
        `[check-cx]   - ${result.name}(${result.type}/${result.model}) -> ${result.status} | latency=${formatDuration(result.latencyMs)} | ping=${formatDuration(result.pingLatencyMs)}`,
      );
    }
  }
}

export interface TickContext {
  env: TickEnv;
  ctx: Pick<ExecutionContext, "waitUntil">;
}

/**
 * Execute one polling round: load configs → exclude maintenance →
 * run checks (concurrency-limited) → append history → prune.
 */
export async function runTick(tick: TickContext): Promise<void> {
  const db: Database = createDb(tick.env);

  const allConfigs = await loadProviderConfigsFromDB(db, tick);
  const configs = allConfigs.filter((cfg) => !cfg.isMaintenance);

  if (configs.length === 0) {
    return;
  }

  const results = await runProviderChecks(configs, tick.env);
  await appendHistory(db, results, tick.env);
  logFailedResultsByGroup(results);
}

export async function runTickSafely(tick: TickContext): Promise<void> {
  try {
    await runTick(tick);
  } catch (error) {
    logError("轮询检测失败", error);
  }
}
