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
  endpoint: string;
  api_key: string;
  enabled: boolean;
  is_maintenance: boolean;
  group_name: string | null;
}

export interface CheckModelRecord {
  id: string;
  type: ProviderType;
  model: string;
  template_id: string | null;
}

export interface CheckRequestTemplateRecord {
  id: string;
  name: string;
  type: ProviderType;
  request_header: Record<string, string> | null;
  metadata: Record<string, unknown> | null;
}
