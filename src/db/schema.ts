/**
 * Drizzle schema — Cloudflare Workers + Turso (libSQL) + SQLite.
 *
 * Source: PostgreSQL schema from check-cx (supabase/schema.sql), rewritten for
 * SQLite per the project timestamp spec (unix milliseconds) and design §3.
 *
 * Migration notes (see design.md §3.2):
 * - `check_poller_leases` DROPPED — PollerDO singleton replaces leadership.
 * - `availability_stats` VIEW → app-layer query (src/db/queries/availability.ts).
 * - `update_updated_at_column()` trigger → app sets updatedAt on each mutation.
 * - type-match triggers → app-layer validation (phase-2 admin).
 * - RLS → removed; access control via Hono auth middleware.
 * - uuid → text (crypto.randomUUID); enum → text + union; timestamptz → integer ms.
 */

import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Unix-millisecond timestamp columns (project spec: timestamp.md). */
const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
};

type JsonRecord = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Domain enums (SQLite has no native enum — text + union + CHECK)
// ---------------------------------------------------------------------------

export const providerTypes = ["openai", "gemini", "anthropic"] as const;
export type ProviderType = (typeof providerTypes)[number];

export const healthStatuses = [
  "operational",
  "degraded",
  "failed",
  "validation_failed",
  "error",
] as const;

/**
 * Stored health statuses (the CHECK constraint allows exactly these).
 * The broader `HealthStatus` below adds the synthetic display-only
 * "maintenance" state used by CheckResult when a config is in maintenance.
 */
export type StoredHealthStatus = (typeof healthStatuses)[number];
export type HealthStatus = StoredHealthStatus | "maintenance";

export const availabilityPeriods = ["7d", "15d", "30d"] as const;
export type AvailabilityPeriod = (typeof availabilityPeriods)[number];

export const notificationLevels = ["info", "warning", "error"] as const;
export type NotificationLevel = (typeof notificationLevels)[number];

export const adminRoles = ["admin", "member"] as const;
export type AdminRole = (typeof adminRoles)[number];

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

/** Reusable request headers + metadata defaults for a provider type. */
export const checkRequestTemplates = sqliteTable(
  "check_request_templates",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull().unique(),
    type: text("type", { enum: providerTypes }).notNull(),
    requestHeader: text("request_header", { mode: "json" }).$type<JsonRecord>(),
    metadata: text("metadata", { mode: "json" }).$type<JsonRecord>(),
    ...timestamps,
  },
);

/** Reusable model definitions bound to a request template. */
export const checkModels = sqliteTable(
  "check_models",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    type: text("type", { enum: providerTypes }).notNull(),
    model: text("model").notNull(),
    templateId: text("template_id").references(() => checkRequestTemplates.id, {
      onDelete: "set null",
    }),
    ...timestamps,
  },
  (t) => [uniqueIndex("check_models_type_model").on(t.type, t.model)],
);

/** Per-provider API endpoint + key + runtime flags. */
export const checkConfigs = sqliteTable(
  "check_configs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    type: text("type", { enum: providerTypes }).notNull(),
    modelId: text("model_id")
      .notNull()
      .references(() => checkModels.id, { onDelete: "restrict" }),
    endpoint: text("endpoint").notNull(),
    /** Plaintext provider API key. Secured by the 3 defenses (parent R-PARENT-3):
     *  Turso token in CF Secret, sanitized logs, never in read DTOs. */
    apiKey: text("api_key").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    isMaintenance: integer("is_maintenance", { mode: "boolean" })
      .notNull()
      .default(false),
    groupName: text("group_name"),
    ...timestamps,
  },
  (t) => [index("idx_check_configs_model_id").on(t.modelId)],
);

/** Health-check history (high-write table). */
export const checkHistory = sqliteTable(
  "check_history",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    configId: text("config_id")
      .notNull()
      .references(() => checkConfigs.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    latencyMs: integer("latency_ms"),
    pingLatencyMs: real("ping_latency_ms"),
    checkedAt: integer("checked_at", { mode: "timestamp_ms" }).notNull(),
    message: text("message"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (t) => [
    check(
      "check_status_valid",
      sql`${t.status} in ('operational','degraded','failed','validation_failed','error')`,
    ),
    check(
      "check_latency_positive",
      sql`${t.latencyMs} is null or ${t.latencyMs} >= 0`,
    ),
    index("idx_check_history_config_id").on(t.configId),
    index("idx_check_history_checked_at").on(t.checkedAt),
    index("idx_history_config_checked").on(t.configId, t.checkedAt),
  ],
);

/** Extra display info per group (website, tags). */
export const groupInfo = sqliteTable(
  "group_info",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    groupName: text("group_name").notNull().unique(),
    websiteUrl: text("website_url"),
    tags: text("tags").notNull().default(""),
    ...timestamps,
  },
);

/** Global system notifications (markdown, level). */
export const systemNotifications = sqliteTable("system_notifications", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  message: text("message").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  level: text("level", { enum: notificationLevels }).notNull().default("info"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

/** Backend user directory — roles + group binding (phase-2 admin). */
export const adminUsers = sqliteTable(
  "admin_users",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    email: text("email").notNull().unique(),
    role: text("role", { enum: adminRoles }).notNull(),
    groupName: text("group_name"),
    /** Bound to a Better Auth user after first login (phase 2). */
    authUserId: text("auth_user_id").unique(),
    invitedBy: text("invited_by"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    invitedAt: integer("invited_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    activatedAt: integer("activated_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (t) => [
    check(
      "admin_users_role_check",
      sql`${t.role} in ('admin','member')`,
    ),
    index("idx_admin_users_role_group").on(t.role, t.groupName),
  ],
);

// ---------------------------------------------------------------------------
// Better Auth tables (session storage; phase-2 login uses them, but the
// schema is created now so phase 1 does not need a second migration).
// ---------------------------------------------------------------------------

export const authUsers = sqliteTable("user", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  name: text("name"),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const authSessions = sqliteTable("session", {
  id: text("id").primaryKey(),
  /** Expires at — unix ms. */
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => authUsers.id, { onDelete: "cascade" }),
});

export const authAccounts = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    index("idx_account_provider").on(t.providerId),
    index("account_userId_idx").on(t.userId),
  ],
);

export const authVerifications = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);
