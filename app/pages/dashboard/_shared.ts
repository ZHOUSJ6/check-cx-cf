/**
 * Shared client-side helpers for dashboard pages.
 * Kept browser-only (uses window.location). Not a route module.
 */

import type {
  AdminUserRecord,
  CheckConfigRecord,
  CheckHistoryRecord,
  CheckModelRecord,
  CheckRequestTemplateRecord,
  GroupInfoRecord,
  ProviderType,
  SystemNotificationRecord,
} from "@/lib/admin-types"

/** Read a single-valued query-string param from the current URL. */
export function searchParam(key: string): string {
  try {
    const value = new URL(window.location.href).searchParams.get(key)
    return value ?? ""
  } catch {
    return ""
  }
}

function asProviderType(value: unknown): ProviderType {
  return value === "gemini" || value === "anthropic" ? value : "openai"
}

/** Map a /api/admin/configs row (camelCase) to the snake_case record shape. */
export function mapConfig(row: Record<string, unknown>): CheckConfigRecord {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    type: asProviderType(row.type),
    model_id: String(row.modelId ?? ""),
    endpoint: String(row.endpoint ?? ""),
    api_key: typeof row.apiKey === "string" ? row.apiKey : null,
    enabled: Boolean(row.enabled),
    is_maintenance: Boolean(row.isMaintenance),
    group_name: typeof row.groupName === "string" ? row.groupName : null,
    template_id: typeof row.templateId === "string" ? row.templateId : null,
    template_name: null,
    model: null,
    created_at: null,
    updated_at: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : (row.updatedAt as string | null) ?? null,
  }
}

/** Map a /api/admin/models row (camelCase) to the snake_case record shape. */
export function mapModel(row: Record<string, unknown>): CheckModelRecord {
  return {
    id: String(row.id ?? ""),
    type: asProviderType(row.type),
    model: String(row.model ?? ""),
    template_id: typeof row.templateId === "string" ? row.templateId : null,
    template_name: null,
    config_count: null,
    created_at: null,
    updated_at: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : (row.updatedAt as string | null) ?? null,
  }
}

/** Map a /api/admin/templates row (camelCase JSON) to the record shape. */
export function mapTemplate(row: Record<string, unknown>): CheckRequestTemplateRecord {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    type: asProviderType(row.type),
    request_header:
      row.requestHeader && typeof row.requestHeader === "object"
        ? (row.requestHeader as Record<string, string>)
        : null,
    metadata:
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : null,
    model_count: null,
    created_at: (row.createdAt as string | null) ?? null,
    updated_at: (row.updatedAt as string | null) ?? null,
  }
}

/** Map a /api/admin/groups row (camelCase JSON) to the record shape. */
export function mapGroup(row: Record<string, unknown>): GroupInfoRecord {
  return {
    id: String(row.id ?? ""),
    group_name: String(row.groupName ?? ""),
    website_url: typeof row.websiteUrl === "string" ? row.websiteUrl : null,
    tags: typeof row.tags === "string" ? row.tags : null,
    created_at: (row.createdAt as string | null) ?? null,
    updated_at: (row.updatedAt as string | null) ?? null,
  }
}

/** Map a /api/admin/notifications row (camelCase JSON) to the record shape. */
export function mapNotification(row: Record<string, unknown>): SystemNotificationRecord {
  const level = row.level
  return {
    id: String(row.id ?? ""),
    message: String(row.message ?? ""),
    level:
      level === "info" || level === "warning" || level === "error" ? level : null,
    is_active: Boolean(row.isActive),
    created_at: (row.createdAt as string | null) ?? null,
    updated_at: (row.updatedAt as string | null) ?? null,
  }
}

/** Map a /api/admin/history row (camelCase) to the snake_case record shape. */
export function mapHistory(row: Record<string, unknown>): CheckHistoryRecord {
  return {
    id: String(row.id ?? ""),
    config_id: String(row.configId ?? ""),
    status: (row.status as CheckHistoryRecord["status"]) ?? "operational",
    latency_ms: typeof row.latencyMs === "number" ? row.latencyMs : null,
    ping_latency_ms: typeof row.pingLatencyMs === "number" ? row.pingLatencyMs : null,
    checked_at:
      row.checkedAt instanceof Date
        ? row.checkedAt.toISOString()
        : (row.checkedAt as string | null) ?? null,
    message: typeof row.message === "string" ? row.message : null,
    config_name: typeof row.configName === "string" ? row.configName : null,
    config_type:
      row.configType === "openai" || row.configType === "gemini" || row.configType === "anthropic"
        ? row.configType
        : null,
    group_name: typeof row.groupName === "string" ? row.groupName : null,
  }
}

/** Map a /api/admin/users row (camelCase) to the snake_case record shape. */
export function mapAdminUser(row: Record<string, unknown>): AdminUserRecord {
  return {
    id: String(row.id ?? ""),
    email: String(row.email ?? ""),
    role: row.role === "admin" ? "admin" : "member",
    group_name: typeof row.groupName === "string" ? row.groupName : null,
    auth_user_id: typeof row.authUserId === "string" ? row.authUserId : null,
    is_active: row.isActive !== false,
    invited_at:
      row.invitedAt instanceof Date
        ? row.invitedAt.toISOString()
        : (row.invitedAt as string | null) ?? null,
    activated_at:
      row.activatedAt instanceof Date
        ? row.activatedAt.toISOString()
        : (row.activatedAt as string | null) ?? null,
  }
}
