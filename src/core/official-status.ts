/**
 * Official status tick — migrated from check-cx lib/core/official-status-poller.ts.
 *
 * Stateless function: fetches fresh official statuses for all known provider
 * types. The PollerDO caches the result in its storage and exposes it to the
 * read path (replaces globalThis.__CHECK_CX_OFFICIAL_STATUS_CACHE__).
 */

import { checkAllOfficialStatuses } from "#/official-status";
import type { OfficialStatusResult, ProviderType } from "#/types";
import { logError } from "#/lib/error-handler";

const ALL_PROVIDER_TYPES: ProviderType[] = ["openai", "gemini", "anthropic"];

export async function runOfficialTick(): Promise<
  Map<ProviderType, OfficialStatusResult>
> {
  try {
    return await checkAllOfficialStatuses(ALL_PROVIDER_TYPES);
  } catch (error) {
    logError("官方状态轮询失败", error);
    return new Map();
  }
}
