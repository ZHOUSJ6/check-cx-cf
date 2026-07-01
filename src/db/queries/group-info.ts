/**
 * Group info loader — migrated from check-cx lib/database/group-info.ts.
 * Supabase → Drizzle; module-level cache → Cache API (design §4).
 */

import { asc, eq } from "drizzle-orm";

import type { Database } from "#/db/client";
import { groupInfo } from "#/db/schema";
import type { GroupInfoSummary } from "#/types";
import { cacheGetOrSet } from "#/cache/cache-api";

interface PollingEnv {
  CHECK_POLL_INTERVAL_SECONDS?: string;
}

interface CacheContext {
  env: PollingEnv;
  ctx: Pick<ExecutionContext, "waitUntil">;
}

const CACHE_KEY = "group-info:all";
const METRICS = { hits: 0, misses: 0 };

export function getGroupInfoCacheMetrics() {
  return { ...METRICS };
}
export function resetGroupInfoCacheMetrics(): void {
  METRICS.hits = 0;
  METRICS.misses = 0;
}

export async function loadGroupInfos(
  db: Database,
  cache: CacheContext,
): Promise<GroupInfoSummary[]> {
  const ttlMs = Number(cache.env.CHECK_POLL_INTERVAL_SECONDS ?? "60") * 1000;
  return cacheGetOrSet(CACHE_KEY, ttlMs, cache.ctx, async () => fetchGroupInfos(db));
}

async function fetchGroupInfos(db: Database): Promise<GroupInfoSummary[]> {
  try {
    const rows = await db
      .select({
        groupName: groupInfo.groupName,
        websiteUrl: groupInfo.websiteUrl,
        tags: groupInfo.tags,
      })
      .from(groupInfo)
      .orderBy(asc(groupInfo.groupName));

    return rows;
  } catch (error) {
    console.error("Failed to load group info:", error);
    return [];
  }
}

export async function getAvailableGroups(
  db: Database,
  cache: CacheContext,
): Promise<string[]> {
  const infos = await loadGroupInfos(db, cache);
  return infos.map((info) => info.groupName);
}

export async function getGroupInfo(
  db: Database,
  groupName: string,
): Promise<GroupInfoSummary | null> {
  try {
    const row = await db
      .select({
        groupName: groupInfo.groupName,
        websiteUrl: groupInfo.websiteUrl,
        tags: groupInfo.tags,
      })
      .from(groupInfo)
      .where(eq(groupInfo.groupName, groupName))
      .get();
    return row ?? null;
  } catch (error) {
    console.error("Failed to load group info:", error);
    return null;
  }
}
