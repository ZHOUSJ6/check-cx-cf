export type ProviderType = "openai" | "gemini" | "anthropic";
export type UserRole = "admin" | "member";
export type NotificationLevel = "info" | "warning" | "error";
export type HistoryStatus = "operational" | "degraded" | "failed" | "validation_failed" | "error";

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
}

export interface AppUser extends AdminUser {
  role: UserRole;
  groupName: string | null;
  directoryUserId: string | null;
  isBootstrapAdmin: boolean;
}

export interface CheckConfigRecord {
  id: string;
  name: string;
  type: ProviderType;
  model_id: string;
  /** Model name, resolved client-side from the models list. */
  model?: string | null;
  endpoint: string;
  /** Not returned by the API; masked client-side when absent. */
  api_key: string | null;
  enabled: boolean;
  is_maintenance: boolean;
  group_name: string | null;
  template_id?: string | null;
  /** Template name, resolved client-side from the templates list. */
  template_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CheckModelRecord {
  id: string;
  type: ProviderType;
  model: string;
  template_id: string | null;
  /** Template name, resolved client-side from the templates list. */
  template_name?: string | null;
  /** Number of configs referencing this model, derived client-side. */
  config_count?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CheckRequestTemplateRecord {
  id: string;
  name: string;
  type: ProviderType;
  request_header: Record<string, string> | null;
  metadata: Record<string, unknown> | null;
  /** Number of models referencing this template, derived client-side. */
  model_count?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface GroupInfoRecord {
  id: string;
  group_name: string;
  website_url: string | null;
  tags: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface SystemNotificationRecord {
  id: string;
  message: string;
  level: NotificationLevel | null;
  is_active: boolean;
  created_at: string | null;
  updated_at?: string | null;
}

export interface AdminUserRecord {
  id: string;
  email: string;
  role: UserRole;
  group_name: string | null;
  auth_user_id: string | null;
  is_active: boolean;
  invited_at: string | null;
  activated_at: string | null;
}

export interface CheckHistoryRecord {
  id: string;
  config_id: string;
  status: HistoryStatus;
  latency_ms: number | null;
  ping_latency_ms: number | null;
  checked_at: string | null;
  message: string | null;
  config_name: string | null;
  config_type: ProviderType | null;
  group_name: string | null;
}

/** Summary returned by /api/admin/system. */
export interface DashboardSummary {
  modelCount: number;
  configCount: number;
  enabledConfigCount: number;
  maintenanceConfigCount: number;
  templateCount: number;
  groupCount: number;
  activeNotificationCount: number;
  recentErrorCount: number;
  latestCheckAt: string | null;
}
