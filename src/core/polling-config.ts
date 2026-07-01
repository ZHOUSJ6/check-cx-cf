/**
 * Polling configuration — reads from Workers env (NOT process.env), per spec
 * backend/environment.md. Migrated from check-cx lib/core/polling-config.ts.
 *
 * All clamps identical to the source so behavior is preserved.
 */

interface PollingEnv {
  CHECK_POLL_INTERVAL_SECONDS?: string;
  OFFICIAL_STATUS_CHECK_INTERVAL_SECONDS?: string;
  CHECK_CONCURRENCY?: string;
  HISTORY_RETENTION_DAYS?: string;
}

const DEFAULT_INTERVAL_SECONDS = 60;
const MIN_INTERVAL_SECONDS = 15;
const MAX_INTERVAL_SECONDS = 600;

const DEFAULT_OFFICIAL_STATUS_INTERVAL_SECONDS = 300;
const MIN_OFFICIAL_STATUS_INTERVAL_SECONDS = 60;
const MAX_OFFICIAL_STATUS_INTERVAL_SECONDS = 3600;

const DEFAULT_CHECK_CONCURRENCY = 5;
const MIN_CHECK_CONCURRENCY = 1;
const MAX_CHECK_CONCURRENCY = 20;

const DEFAULT_RETENTION_DAYS = 30;
const MIN_RETENTION_DAYS = 7;
const MAX_RETENTION_DAYS = 365;

function clamp(raw: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.max(min, Math.min(max, parsed));
  }
  return fallback;
}

export function getPollingIntervalSeconds(env: PollingEnv): number {
  return clamp(
    env.CHECK_POLL_INTERVAL_SECONDS,
    DEFAULT_INTERVAL_SECONDS,
    MIN_INTERVAL_SECONDS,
    MAX_INTERVAL_SECONDS,
  );
}

export function getPollingIntervalMs(env: PollingEnv): number {
  return getPollingIntervalSeconds(env) * 1000;
}

export function getPollingIntervalLabel(env: PollingEnv): string {
  const seconds = getPollingIntervalSeconds(env);
  if (seconds % 60 === 0) {
    return `${seconds / 60} 分钟`;
  }
  return `${seconds} 秒`;
}

export function getOfficialStatusIntervalSeconds(env: PollingEnv): number {
  return clamp(
    env.OFFICIAL_STATUS_CHECK_INTERVAL_SECONDS,
    DEFAULT_OFFICIAL_STATUS_INTERVAL_SECONDS,
    MIN_OFFICIAL_STATUS_INTERVAL_SECONDS,
    MAX_OFFICIAL_STATUS_INTERVAL_SECONDS,
  );
}

export function getOfficialStatusIntervalMs(env: PollingEnv): number {
  return getOfficialStatusIntervalSeconds(env) * 1000;
}

export function getCheckConcurrency(env: PollingEnv): number {
  return clamp(
    env.CHECK_CONCURRENCY,
    DEFAULT_CHECK_CONCURRENCY,
    MIN_CHECK_CONCURRENCY,
    MAX_CHECK_CONCURRENCY,
  );
}

export function getHistoryRetentionDays(env: PollingEnv): number {
  return clamp(
    env.HISTORY_RETENTION_DAYS,
    DEFAULT_RETENTION_DAYS,
    MIN_RETENTION_DAYS,
    MAX_RETENTION_DAYS,
  );
}
