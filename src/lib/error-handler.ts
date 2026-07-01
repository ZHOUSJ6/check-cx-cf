/**
 * Error handling utilities — migrated from check-cx lib/utils/error-handler.ts.
 *
 * Includes the sensitive-field sanitizer (parent R-PARENT-3 defense #2):
 * keys matching api_key/secret/token/password/authorization/bearer/credential
 * are masked in logs and error detail.
 */

const SENSITIVE_PATTERNS =
  /api[_-]?key|secret|token|password|authorization|bearer|credential/i;

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    if (value.length <= 8) {
      return value;
    }
    return `${value.slice(0, 4)}***${value.slice(-4)}`;
  }
  return value;
}

function sanitizeError(error: unknown): unknown {
  if (error === null || error === undefined) {
    return error;
  }
  if (typeof error !== "object") {
    return error;
  }
  if (Array.isArray(error)) {
    return error.map((item) => sanitizeError(item));
  }
  if (error instanceof Error) {
    const sanitized: Record<string, unknown> = {
      name: error.name,
      message: error.message,
    };
    if (error.stack) {
      sanitized.stack = error.stack;
    }
    const errorObj = error as unknown as Record<string, unknown>;
    for (const key in error) {
      if (
        Object.prototype.hasOwnProperty.call(error, key) &&
        !["name", "message", "stack"].includes(key)
      ) {
        const value = errorObj[key];
        sanitized[key] = SENSITIVE_PATTERNS.test(key)
          ? sanitizeValue(value)
          : sanitizeError(value);
      }
    }
    return sanitized;
  }
  const sanitized: Record<string, unknown> = {};
  for (const key in error) {
    if (Object.prototype.hasOwnProperty.call(error, key)) {
      const value = (error as Record<string, unknown>)[key];
      sanitized[key] = SENSITIVE_PATTERNS.test(key)
        ? sanitizeValue(value)
        : sanitizeError(value);
    }
  }
  return sanitized;
}

function stringifySanitizedError(error: unknown): string {
  const sanitized = sanitizeError(error);
  if (typeof sanitized === "string") {
    return sanitized;
  }
  try {
    return JSON.stringify(sanitized, null, 2);
  } catch {
    return String(sanitized);
  }
}

/** Log an error with sensitive fields sanitized (spec: error-logging.md). */
export function logError(context: string, error: unknown): void {
  console.error(`[check-cx] ${context}:`, sanitizeError(error));
}

export function getSanitizedErrorDetail(error: unknown): string {
  return stringifySanitizedError(error);
}

interface AIAPICallError extends Error {
  statusCode?: number;
  responseBody?: string;
  url?: string;
}

function extractErrorFromResponseBody(responseBody: string): string | null {
  const sseMatch = responseBody.match(/data:\s*(\{.*\})/);
  const sseJson = sseMatch?.[1];
  if (sseJson) {
    try {
      const data = JSON.parse(sseJson);
      if (data.message) return data.message;
      if (data.error?.message) return data.error.message;
    } catch {
      // fall through
    }
  }
  try {
    const data = JSON.parse(responseBody);
    if (data.message) return data.message;
    if (data.error?.message) return data.error.message;
  } catch {
    if (responseBody.length > 0) {
      return responseBody.slice(0, 100);
    }
  }
  return null;
}

/** Extract a human-readable message, including AI SDK API call detail. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const apiError = error as AIAPICallError;
    if (apiError.responseBody) {
      const extracted = extractErrorFromResponseBody(apiError.responseBody);
      if (extracted) {
        const statusPrefix = apiError.statusCode
          ? `[${apiError.statusCode}] `
          : "";
        return `${statusPrefix}${extracted}`;
      }
    }
    if (apiError.statusCode) {
      return `[${apiError.statusCode}] ${error.message}`;
    }
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "未知错误";
}
