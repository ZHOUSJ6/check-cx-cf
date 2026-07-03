/**
 * Small JSON helpers used by admin forms. Browser-safe (no server-only deps).
 */

export function stringifyJson(value: unknown): string {
  if (value === null || value === undefined) {
    return ""
  }

  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) {
      return ""
    }
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2)
    } catch {
      return trimmed
    }
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return ""
    }
  }

  return String(value)
}

export function parseJson(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) {
    return null
  }

  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}
