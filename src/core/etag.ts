/**
 * ETag helper — djb2 hash, identical to the source's generateETag.
 * Used by /api/dashboard and /api/group/:name for conditional requests (304).
 */

/** djb2 string hash → quoted hex ETag. */
export function generateETag(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
  }
  return `"${(hash >>> 0).toString(16)}"`;
}
