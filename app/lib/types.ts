/**
 * Client-side type definitions. Source components import from "@/lib/types".
 *
 * These mirror the server-side #/types but are defined locally so the client
 * bundle never imports server modules. Types are erased at build time.
 */

export type ProviderType = "openai" | "gemini" | "anthropic";

export type HealthStatus =
  | "operational"
  | "degraded"
  | "failed"
  | "validation_failed"
  | "maintenance"
  | "error";

export type OfficialHealthStatus = "operational" | "degraded" | "down" | "unknown";

export interface OfficialStatusResult {
  status: OfficialHealthStatus;
  message: string;
  checkedAt: string;
  affectedComponents?: string[];
}

export interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  endpoint: string;
  model: string;
  isMaintenance: boolean;
  groupName?: string | null;
}

export interface CheckResult {
  id: string;
  name: string;
  type: ProviderType;
  endpoint: string;
  model: string;
  status: HealthStatus;
  latencyMs: number | null;
  pingLatencyMs: number | null;
  checkedAt: string;
  message: string;
  officialStatus?: OfficialStatusResult;
  groupName?: string | null;
}

export type AvailabilityPeriod = "7d" | "15d" | "30d";

export interface AvailabilityStat {
  period: AvailabilityPeriod;
  totalChecks: number;
  operationalCount: number;
  availabilityPct: number | null;
}

export type AvailabilityStatsMap = Record<string, AvailabilityStat[]>;

export interface GroupInfoSummary {
  groupName: string;
  websiteUrl?: string | null;
  tags: string;
}

export type TimelineItem = CheckResult;

export interface ProviderTimeline {
  id: string;
  items: TimelineItem[];
  latest: TimelineItem;
}

export interface GroupedProviderTimelines {
  groupName: string;
  displayName: string;
  timelines: ProviderTimeline[];
  websiteUrl?: string | null;
  tags: string;
}

export interface DashboardData {
  providerTimelines: ProviderTimeline[];
  groupInfos: GroupInfoSummary[];
  lastUpdated: string | null;
  total: number;
  pollIntervalLabel: string;
  pollIntervalMs: number;
  availabilityStats?: AvailabilityStatsMap;
  trendPeriod: AvailabilityPeriod;
  generatedAt: number;
}

export const UNGROUPED_KEY = "__ungrouped__";
export const UNGROUPED_DISPLAY_NAME = "未分组";

// Alias for source-component compatibility (notification-banner uses SystemNotificationRow).
export interface SystemNotificationRow {
  id: string;
  message: string;
  isActive: boolean;
  level: "info" | "warning" | "error";
  createdAt: string;
}
