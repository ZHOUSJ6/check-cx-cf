/**
 * PollerDO — global singleton Durable Object (id "1").
 *
 * Replaces the Node long-running poller + DB-lease leadership (design §5):
 *  - Cron (1/min) calls wake() via the scheduled() handler to re-seed the alarm.
 *  - alarm() drives BOTH loops: main health check (~60s) + official status (~300s).
 *  - DO is the single leader (one instance per fixed name), so check_poller_leases
 *    is gone. storage holds the re-entrancy guard + loop cursors + official cache.
 *  - alarm() runs outside the fetch wall-clock budget, safe for batch AI checks.
 */

import { DurableObject } from "cloudflare:workers";

import { runTickSafely } from "#/core/poller";
import { runOfficialTick } from "#/core/official-status";
import {
  getOfficialStatusIntervalMs,
  getPollingIntervalMs,
} from "#/core/polling-config";
import type { OfficialStatusResult, ProviderType } from "#/types";

interface PollerEnv {
  CHECK_POLL_INTERVAL_SECONDS?: string;
  OFFICIAL_STATUS_CHECK_INTERVAL_SECONDS?: string;
  DATABASE_URL: string;
  DATABASE_AUTH_TOKEN: string;
  CHECK_CONCURRENCY?: string;
  HISTORY_RETENTION_DAYS?: string;
  CHECK_NODE_ID?: string;
}

const STORAGE_KEYS = {
  running: "running",
  lastMainMs: "lastMainMs",
  lastOfficialMs: "lastOfficialMs",
  officialStatus: "officialStatus",
} as const;

export class PollerDO extends DurableObject<PollerEnv> {
  /**
   * Called by the scheduled() handler on every Cron tick. If no alarm is
   * pending, schedule one immediately (re-seeds after eviction).
   */
  async wake(): Promise<void> {
    const alarm = await this.ctx.storage.getAlarm();
    if (!alarm) {
      await this.ctx.storage.setAlarm(Date.now());
    }
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Read-path: expose the cached official-status map to the API layer.
    if (url.pathname === "/internal/official-status") {
      const map = await this.getOfficialStatusMap();
      const record: Record<string, OfficialStatusResult> = {};
      for (const [type, result] of map) {
        record[type] = result;
      }
      return Response.json(record);
    }

    // Debug / manual trigger: wake the alarm.
    await this.wake();
    return Response.json({ ok: true });
  }

  /**
   * Drives both loops. After running due work, re-arms the alarm for the next
   * due loop so cadences stay precise regardless of Cron's 1-min floor.
   */
  override async alarm(): Promise<void> {
    const now = Date.now();
    const mainInterval = getPollingIntervalMs(this.env);
    const officialInterval = getOfficialStatusIntervalMs(this.env);

    const lastMainMs = (await this.ctx.storage.get<number>(STORAGE_KEYS.lastMainMs)) ?? 0;
    const lastOfficialMs =
      (await this.ctx.storage.get<number>(STORAGE_KEYS.lastOfficialMs)) ?? 0;
    const running = (await this.ctx.storage.get<boolean>(STORAGE_KEYS.running)) ?? false;

    // MAIN loop — guarded re-entrancy (replaces globalThis.__checkCxPollerRunning).
    if (!running && now - lastMainMs >= mainInterval) {
      await this.ctx.storage.put(STORAGE_KEYS.running, true);
      await this.ctx.storage.put(STORAGE_KEYS.lastMainMs, now);
      // Run without blocking the alarm: use blockConcurrencyWhile-free path.
      // We await so the alarm invocation is accounted, but the tick itself is
      // resilient (runTickSafely swallows errors). DO alarms have generous limits.
      try {
        await runTickSafely({ env: this.env, ctx: this.ctx });
      } finally {
        await this.ctx.storage.put(STORAGE_KEYS.running, false);
      }
    }

    // OFFICIAL loop
    if (now - lastOfficialMs >= officialInterval) {
      await this.ctx.storage.put(STORAGE_KEYS.lastOfficialMs, now);
      try {
        const statuses = await runOfficialTick();
        const record: Record<string, OfficialStatusResult> = {};
        for (const [type, result] of statuses) {
          record[type] = result;
        }
        await this.ctx.storage.put(STORAGE_KEYS.officialStatus, record);
      } catch (error) {
        console.error("[check-cx] 官方状态轮询失败", error);
      }
    }

    // Re-arm: next wakeup = whichever loop is due sooner.
    const nextMainDue = lastMainMs + mainInterval;
    const nextOfficialDue = lastOfficialMs + officialInterval;
    const nextDue = Math.min(nextMainDue, nextOfficialDue);
    // Ensure at least a small delay so we don't spin.
    const nextAlarm = Math.max(nextDue, Date.now() + 1000);
    await this.ctx.storage.setAlarm(nextAlarm);
  }

  /**
   * Expose the cached official-status map to the read path (dashboard API).
   * Returns a Map keyed by ProviderType.
   */
  async getOfficialStatusMap(): Promise<Map<ProviderType, OfficialStatusResult>> {
    const record = await this.ctx.storage.get<Record<string, OfficialStatusResult>>(
      STORAGE_KEYS.officialStatus,
    );
    const map = new Map<ProviderType, OfficialStatusResult>();
    if (record) {
      for (const [type, result] of Object.entries(record)) {
        map.set(type as ProviderType, result);
      }
    }
    return map;
  }
}
