// Client-accessible GroupDashboardData type (mirrors server src/core/group-data.ts)
import type { AvailabilityPeriod, AvailabilityStatsMap, ProviderTimeline } from "#/types";

export interface GroupDashboardData {
  groupName: string;
  displayName: string;
  tags: string;
  providerTimelines: ProviderTimeline[];
  lastUpdated: string | null;
  total: number;
  pollIntervalLabel: string;
  pollIntervalMs: number;
  availabilityStats: AvailabilityStatsMap;
  trendPeriod: AvailabilityPeriod;
  generatedAt: number;
  websiteUrl?: string | null;
}
