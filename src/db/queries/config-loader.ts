/**
 * Provider config loader — migrated from check-cx lib/database/config-loader.ts.
 *
 * Change: Supabase → Drizzle; module-level cache → Cache API (design §4).
 * `api_key` IS selected here (poller needs it to call AI providers) but this
 * loader is server-only and never used by read DTOs (defense #3).
 */

import { eq } from "drizzle-orm";

import type { Database } from "#/db/client";
import { checkConfigs, checkModels, checkRequestTemplates } from "#/db/schema";
import type { ProviderConfig } from "#/types";
import { cacheGetOrSet } from "#/cache/cache-api";

interface PollingEnv {
  CHECK_POLL_INTERVAL_SECONDS?: string;
}

interface CacheContext {
  env: PollingEnv;
  ctx: Pick<ExecutionContext, "waitUntil">;
}

const CACHE_KEY = "config:enabled";
const METRICS = { hits: 0, misses: 0 };

export function getConfigCacheMetrics() {
  return { ...METRICS };
}
export function resetConfigCacheMetrics(): void {
  METRICS.hits = 0;
  METRICS.misses = 0;
}

export async function loadProviderConfigsFromDB(
  db: Database,
  cache: CacheContext,
  options?: { forceRefresh?: boolean },
): Promise<ProviderConfig[]> {
  const ttlMs = Number(cache.env.CHECK_POLL_INTERVAL_SECONDS ?? "60") * 1000;

  if (options?.forceRefresh) {
    METRICS.misses += 1;
    return fetchConfigs(db);
  }

  const cached = await cacheGetOrSet(
    CACHE_KEY,
    ttlMs,
    cache.ctx,
    async () => fetchConfigs(db),
  );
  METRICS.hits += 1;
  return cached;
}

async function fetchConfigs(db: Database): Promise<ProviderConfig[]> {
  const rows = await db
    .select({
      id: checkConfigs.id,
      name: checkConfigs.name,
      type: checkConfigs.type,
      endpoint: checkConfigs.endpoint,
      apiKey: checkConfigs.apiKey,
      isMaintenance: checkConfigs.isMaintenance,
      groupName: checkConfigs.groupName,
      modelType: checkModels.type,
      model: checkModels.model,
      templateType: checkRequestTemplates.type,
      requestHeader: checkRequestTemplates.requestHeader,
      metadata: checkRequestTemplates.metadata,
    })
    .from(checkConfigs)
    .leftJoin(checkModels, eq(checkModels.id, checkConfigs.modelId))
    .leftJoin(
      checkRequestTemplates,
      eq(checkRequestTemplates.id, checkModels.templateId),
    )
    .where(eq(checkConfigs.enabled, true));

  if (rows.length === 0) {
    console.warn("[check-cx] 数据库中没有找到启用的配置");
    return [];
  }

  const configs: ProviderConfig[] = [];
  for (const row of rows) {
    configs.push({
      id: row.id,
      name: row.name,
      type: row.type,
      endpoint: row.endpoint,
      model: row.model ?? "",
      apiKey: row.apiKey,
      isMaintenance: row.isMaintenance,
      requestHeaders:
        row.type === row.templateType
          ? (row.requestHeader as Record<string, string> | null)
          : null,
      metadata: row.type === row.templateType ? (row.metadata ?? null) : null,
      groupName: row.groupName ?? null,
    });
  }

  return configs;
}
