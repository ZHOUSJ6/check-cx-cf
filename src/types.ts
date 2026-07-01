/**
 * Shared domain types — single source of truth for the backend.
 *
 * Migrated from check-cx lib/types/*. The DB-layer enums live in
 * src/db/schema.ts; these are the in-flight DTO types used across the
 * poller, queries, API, and frontend.
 */

import type { ProviderType, HealthStatus } from "#/db/schema";

export type { ProviderType, HealthStatus } from "#/db/schema";
import type { AvailabilityPeriod } from "#/db/schema";
export type { AvailabilityPeriod } from "#/db/schema";

/** Default API endpoints per provider type. */
export const DEFAULT_ENDPOINTS: Record<ProviderType, string> = {
  openai: "https://api.openai.com/v1/chat/completions",
  gemini: "https://generativelanguage.googleapis.com",
  anthropic: "https://api.anthropic.com/v1/messages",
};

/** Provider config loaded from check_configs (+ model + template). */
export interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  endpoint: string;
  model: string;
  apiKey: string;
  isMaintenance: boolean;
  requestHeaders?: Record<string, string> | null;
  metadata?: Record<string, unknown> | null;
  groupName?: string | null;
}

/** A single health-check result. */
export interface CheckResult {
  id: string;
  name: string;
  type: ProviderType;
  endpoint: string;
  model: string;
  status: HealthStatus;
  latencyMs: number | null;
  pingLatencyMs: number | null;
  /** ISO 8601 — kept as string for the client timeline. */
  checkedAt: string;
  message: string;
  logMessage?: string;
  officialStatus?: OfficialStatusResult;
  groupName?: string | null;
}

/** Official service-status health. */
export type OfficialHealthStatus =
  | "operational"
  | "degraded"
  | "down"
  | "unknown";

export interface OfficialStatusResult {
  status: OfficialHealthStatus;
  message: string;
  checkedAt: string;
  affectedComponents?: string[];
}

// ---------------------------------------------------------------------------
// Availability / dashboard aggregates
// ---------------------------------------------------------------------------

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

export type RefreshMode = "always" | "missing" | "never";

export type HistorySnapshot = Record<string, CheckResult[]>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Internal key for configs without a group. */
export const UNGROUPED_KEY = "__ungrouped__";
export const UNGROUPED_DISPLAY_NAME = "未分组";
