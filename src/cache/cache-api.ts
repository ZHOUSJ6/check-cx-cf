/**
 * Cloudflare Cache API wrapper — replaces module-level globalThis caches
 * (design §4). Workers recycle isolates, so in-memory state is unreliable;
 * caches.default is shared across isolates within a colo.
 *
 * Pattern: stale-read with non-blocking async refresh (waitUntil).
 * Each cached value carries an `expiresAt`; on miss/stale we recompute and
 * write back via waitUntil so the response isn't blocked.
 */

const KEY_PREFIX = "https://cx.internal/";

function keyUrl(key: string): string {
  return `${KEY_PREFIX}${key}`;
}

interface CacheEnvelope<T> {
  data: T;
  expiresAt: number;
}

// Cloudflare Workers extends CacheStorage with a `.default` cache. The lib
// dom typings don't include it, so cast through the runtime global.
interface CloudflareCacheStorage extends CacheStorage {
  default: Cache;
}

function getDefaultCache(): Cache {
  return (caches as CloudflareCacheStorage).default;
}

/** Read a cached value if present and not expired. */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const res = await getDefaultCache().match(keyUrl(key));
    if (!res) {
      return null;
    }
    const env = (await res.json()) as CacheEnvelope<T>;
    if (Date.now() > env.expiresAt) {
      return null;
    }
    return env.data;
  } catch {
    return null;
  }
}

/**
 * Write a value to the cache with a TTL, non-blocking via waitUntil.
 * Call inside a request/alarm handler where `ctx` is available.
 */
export function cachePut<T>(
  key: string,
  data: T,
  ttlMs: number,
  ctx: Pick<ExecutionContext, "waitUntil">,
): void {
  const envelope: CacheEnvelope<T> = {
    data,
    expiresAt: Date.now() + ttlMs,
  };
  const maxAge = Math.max(1, Math.ceil(ttlMs / 1000));
  ctx.waitUntil(
    getDefaultCache().put(
      keyUrl(key),
      new Response(JSON.stringify(envelope), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": `max-age=${maxAge}`,
        },
      }),
    ),
  );
}

/**
 * Convenience: get-or-compute. Returns cached value if fresh; otherwise
 * computes `loader`, returns it immediately, and writes back asynchronously.
 */
export async function cacheGetOrSet<T>(
  key: string,
  ttlMs: number,
  ctx: Pick<ExecutionContext, "waitUntil">,
  loader: () => Promise<T>,
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) {
    return cached;
  }
  const data = await loader();
  cachePut(key, data, ttlMs, ctx);
  return data;
}
