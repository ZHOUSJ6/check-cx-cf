/**
 * Security helpers — Web Crypto based (spec: backend/security.md).
 *
 * IMPORTANT: all functions must be called inside request handlers, never at
 * module top-level (crypto.getRandomValues / crypto.subtle need the runtime).
 */

/** Generate a cryptographically secure base62 string. Default 32 chars (~190 bits). */
export function generateSecureCode(length = 32): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join("");
}

/** SHA-256 hex hash of a token (store the hash, return the raw token to client). */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string comparison (defends against timing attacks). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/** Verify a raw token against its stored SHA-256 hash. */
export async function verifyToken(
  token: string,
  hash: string,
): Promise<boolean> {
  const tokenHash = await hashToken(token);
  return timingSafeEqual(tokenHash, hash);
}
