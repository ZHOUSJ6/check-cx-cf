/**
 * DO accessor for the read path — fetches the cached official-status map
 * from the singleton PollerDO without coupling API code to DO internals.
 */

import type { OfficialStatusResult, ProviderType } from "#/types";

/** Accept any env that may carry a POLLER binding (typed or generic namespace). */
interface PollerCarrier {
  POLLER?: DurableObjectNamespace;
}

/**
 * Get the official-status map cached in the PollerDO storage.
 * Returns null if the DO binding is unavailable (e.g. during local SSR dev).
 */
export async function getOfficialStatusFromDO(
  env: PollerCarrier,
): Promise<Map<ProviderType, OfficialStatusResult> | null> {
  const poller = env.POLLER;
  if (!poller) {
    return null;
  }
  try {
    const id = poller.idFromName("1");
    const stub = poller.get(id);
    const res = await stub.fetch("https://do/internal/official-status");
    if (!res.ok) {
      return null;
    }
    const record = (await res.json()) as Record<string, OfficialStatusResult>;
    const map = new Map<ProviderType, OfficialStatusResult>();
    for (const [type, result] of Object.entries(record)) {
      map.set(type as ProviderType, result);
    }
    return map;
  } catch {
    return null;
  }
}
