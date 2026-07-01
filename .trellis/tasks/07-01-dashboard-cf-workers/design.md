# Design — check-cx dashboard → CF Workers (phase 1)

> Technical design for child task `07-01-dashboard-cf-workers`.
> Inherits all parent PRD decisions. This is a complex task: architecture,
> boundaries, contracts, data flow, compatibility, and rollout shape.

## 1. Target Architecture

```
                         Cloudflare (single Worker)
┌──────────────────────────────────────────────────────────────────┐
│  wrangler.jsonc                                                   │
│  triggers.crons: ["* * * * *"]   ← every 1 min                   │
│  durable_objects.bindings: [{ name:"POLLER", class_name:"PollerDO" }] │
│  (Turso via libSQL HTTP, env vars via [vars], secrets via CF)    │
│                                                                   │
│  ┌──────────────────────┐    scheduled(event)                     │
│  │  Cron (1/min)        │───────────────►  env.POLLER.idFrom("1") │
│  └──────────────────────┘                     .get().wake()       │
│                        │                                          │
│                        v                                          │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  PollerDO (Durable Object, global singleton, id="1")       │  │
│  │  - storage: { lastTickMs, lastOfficialMs, running }        │  │
│  │  - alarm() drives BOTH loops (main 60s, official 300s)     │  │
│  │  - wake(): if no alarm scheduled, schedule one immediately │  │
│  └───────────────┬────────────────────────────┬───────────────┘  │
│                  │ runTick()                   │ runOfficialTick()│
│                  v                             v                  │
│  ┌──────────────────────┐        ┌────────────────────────────┐ │
│  │  Provider checks     │        │  Official status poll      │ │
│  │  (Vercel AI SDK      │        │  (OpenAI / Anthropic pages)│ │
│  │   streamText, fetch) │        │  → DO storage cache        │ │
│  └──────────┬───────────┘        └────────────────────────────┘ │
│             │ append/prune                                       │
│             v                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Turso (libSQL) via drizzle-orm/libsql                     │  │
│  │  7 tables (poller_leases dropped)                          │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  HTTP (fetch) ──► Hono app ──┬─► /api/v1/status                  │
│                              ├─► /api/dashboard (ETag)           │
│                              ├─► /api/group/:name (ETag)         │
│                              ├─► /api/notifications              │
│                              └─► /api/internal/cache-metrics     │
│                ──► React Router v7 SSR ──► /  /group/:name       │
│                              (assets served by Workers)         │
│                                                                   │
│  Cache API (caches.default) ◄── dashboard/config/availability/   │
│                                  group-info/notifications caches  │
└──────────────────────────────────────────────────────────────────┘
```

### Why this shape

- **DO = the replacement for the long-running poller.** The singleton
  (fixed id `"1"`) is the natural leader — no DB lease needed, so
  `check_poller_leases` is dropped. `storage` holds re-entrancy guard +
  loop cursors, surviving across alarm wakeups within the DO's lifetime.
- **Cron only nudges the DO awake.** Cron min granularity is 1 min; the DO
  re-arms its own `alarm()` to keep the 60s / 300s cadences precisely,
  independent of Cron's 1-min floor. If the DO is evicted, the next Cron
  tick re-seeds the alarm via `wake()`.
- **`alarm()` is not bound by the single-request 30s wall-clock** the way
  a fetch handler is — it can run a full poll batch. (Guarded anyway:
  one tick = N configs × AI request, concurrency-limited.)
- **Cache API replaces module-level `globalThis` caches.** See §4.

## 2. Project Layout (merged Worker, phase-1 slice)

```
check-cx/                          ← this repo
├── wrangler.jsonc
├── drizzle.config.ts
├── vite.config.ts
├── react-router.config.ts
├── tsconfig.json
├── package.json
├── .dev.vars                      ← gitignored; local Turso token etc.
├── app/
│   ├── root.tsx                   ← RRv7 root (layout, theme, fonts)
│   ├── routes.ts                  ← RRv7 route config (public routes)
│   ├── routes/
│   │   ├── _index.tsx             ← "/" dashboard (loader → /api or DB)
│   │   ├── group.$groupName.tsx   ← "/group/:name"
│   │   └── api.*.tsx              ← RRv7 resource routes → Hono passthrough
│   │                              │   (or mount Hono directly, see §6)
│   ├── components/                ← migrated from source components/
│   ├── modules/                   ← feature modules (poller, providers…)
│   └── lib/                       ← auth-client, query-client, cn
├── src/                           ← Workers backend (Hono + DO)
│   ├── index.ts                   ← default export: fetch + scheduled
│   ├── do/
│   │   └── poller-do.ts           ← PollerDO class (singleton)
│   ├── api/
│   │   ├── app.ts                 ← Hono app, mounts /api/*
│   │   ├── status/router.ts
│   │   ├── dashboard/router.ts
│   │   ├── group/router.ts
│   │   ├── notifications/router.ts
│   │   └── internal/router.ts
│   ├── core/
│   │   ├── poller.ts              ← tick(): load→check→append→prune
│   │   ├── official-status.ts     ← official status tick
│   │   ├── dashboard-data.ts      ← aggregation (Cache API backed)
│   │   ├── health-snapshot.ts
│   │   └── polling-config.ts      ← reads c.env, not process.env
│   ├── providers/
│   │   ├── ai-sdk-check.ts        ← streamText check (fetch-based)
│   │   ├── challenge.ts           ← migrated verbatim
│   │   ├── endpoint-ping.ts       ← migrated verbatim
│   │   ├── concurrency.ts         ← p-limit replacement (see §7)
│   │   └── index.ts
│   ├── official-status/           ← openai.ts, anthropic.ts, index.ts
│   ├── db/
│   │   ├── schema.ts              ← Drizzle schema (7 tables)
│   │   ├── client.ts              ← createDb(env) per request
│   │   └── queries/               ← history, availability, config-loader…
│   ├── cache/
│   │   └── cache-api.ts           ← Cache API wrapper (see §4)
│   ├── middleware/
│   │   ├── request-context.ts     ← spec: mount first
│   │   └── auth.ts                ← Better Auth (phase-1: public passthrough)
│   ├── lib/
│   │   ├── logger.ts              ← structured, sanitized
│   │   └── security.ts            ← Web Crypto helpers
│   └── types.ts                   ← AppEnv, Bindings
└── drizzle/                       ← generated migrations (drizzle-kit)
```

> Phase-2 admin adds `app/routes/dashboard.*.tsx` + `src/api/admin/*` under
> the same Worker; routing partition defined in §6.

## 3. Data Layer — PostgreSQL → SQLite (Turso/libSQL)

### 3.1 Type mapping

| PostgreSQL | SQLite / Drizzle | Notes |
|---|---|---|
| `uuid PRIMARY KEY DEFAULT gen_random_uuid()` | `text("id").primaryKey().$defaultFn(() => crypto.randomUUID())` | Workers have `crypto.randomUUID` |
| `public.provider_type` ENUM | `text("type")` + app-layer union + CHECK via Drizzle | SQLite has no enum; validate in Zod + DB CHECK |
| `timestamptz DEFAULT now()` | `integer("created_at", {mode:"timestamp_ms"})` default `sql\`(unixepoch())\`` | spec timestamp.md → unix ms |
| `bigint GENERATED ... IDENTITY` | `integer("id").primaryKey({autoIncrement:true})` | check_history.id |
| `double precision` (ping_latency) | `real("ping_latency_ms")` | |
| `jsonb` (request_header, metadata) | `text` + `$type<Record<…>>()` + JSON.parse/stringify | Drizzle text+JSON pattern |
| `text[]` (target_config_ids in RPC) | n/a (RPC gone) | see §3.3 |
| CHECK constraints | Drizzle `check()` | status validity, role, latency≥0 |

### 3.2 PG constructs that disappear or move to app layer

| PG construct | Disposition |
|---|---|
| `check_poller_leases` table + seed row | **Dropped** — DO singleton replaces leadership |
| `availability_stats` VIEW (7d/15d/30d UNION) | **App-layer query** in `src/db/queries/availability.ts` — Drizzle can't easily express the FILTER aggregate; compute via grouped `count()` with `inArray` + period window per spec's batch guidance |
| `update_updated_at_column()` trigger | **App layer** — set `updatedAt: new Date()` in every update mutation (Drizzle `timestamps` helper, per spec) |
| `validate_check_model_template_type` trigger | **App-layer validation** in the create/update lib (check template.type === model.type before write). Phase-2 admin enforces; phase-1 read path unaffected |
| `validate_check_config_model_type` trigger | Same — app-layer check before write |
| RLS policies | **Gone** — Turso has no RLS; access control moves to Hono middleware (Better Auth in phase 2). Phase-1 public reads need no gating |
| `get_recent_check_history()` RPC | **Drizzle query** — window function `row_number() OVER (PARTITION BY config_id ORDER BY checked_at DESC)`; SQLite supports window functions. Reuse source's existing app-layer fallback logic as the canonical impl |
| `prune_check_history()` RPC | **Drizzle delete** with computed cutoff date |

### 3.3 Schema sketch (`src/db/schema.ts`)

```ts
// 7 tables. poller_leases removed. Timestamps = unix ms (integer, timestamp_ms).
export const providerTypes = ["openai","gemini","anthropic"] as const;
export type ProviderType = typeof providerTypes[number];

export const checkRequestTemplates = sqliteTable("check_request_templates", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().unique(),
  type: text("type", { enum: providerTypes }).notNull(),
  requestHeader: text("request_header", { mode: "json" }).$type<JsonRecord>(),
  metadata: text("metadata", { mode: "json" }).$type<JsonRecord>(),
  ...timestamps,
});

export const checkModels = sqliteTable("check_models", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  type: text("type", { enum: providerTypes }).notNull(),
  model: text("model").notNull(),
  templateId: text("template_id").references(() => checkRequestTemplates.id),
  ...timestamps,
}, (t) => [
  uniqueIndex("check_models_type_model").on(t.type, t.model),
]);

export const checkConfigs = sqliteTable("check_configs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  type: text("type", { enum: providerTypes }).notNull(),
  modelId: text("model_id").notNull().references(() => checkModels.id),
  endpoint: text("endpoint").notNull(),
  apiKey: text("api_key").notNull(),          // plaintext + 3 defenses (parent R-PARENT-3)
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  isMaintenance: integer("is_maintenance", { mode: "boolean" }).notNull().default(false),
  groupName: text("group_name"),
  ...timestamps,
});

export const checkHistory = sqliteTable("check_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  configId: text("config_id").notNull().references(() => checkConfigs.id),
  status: text("status").notNull(),   // CHECK enforced via check()
  latencyMs: integer("latency_ms"),
  pingLatencyMs: real("ping_latency_ms"),
  checkedAt: integer("checked_at", { mode: "timestamp_ms" }).notNull(),
  message: text("message"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
}, (t) => [
  check("check_status_valid", sql`${t.status} in ('operational','degraded','failed','validation_failed','error')`),
  check("check_latency_positive", sql`${t.latencyMs} is null or ${t.latencyMs} >= 0`),
  index("idx_history_config_checked").on(t.configId, desc(t.checkedAt)),
]);
// … group_info, admin_users (phase-2 but defined now), system_notifications
```

- **`api_key` never selected in read DTOs** — `db.select({...})` whitelists
  columns; a lint rule / type-level guard can enforce. Source already
  loads it only in the poller path.
- **`checked_at` stored as ms integer**; comparisons use ms math, not SQL
  intervals (`Date.now() - periodDays*86400000`).

### 3.4 The 2 RPC → Drizzle

```ts
// get_recent_check_history equivalent — window function (SQLite supports it)
const rows = await db.select({
  config_id: checkHistory.configId,
  status: checkHistory.status,
  latency_ms: checkHistory.latencyMs,
  ping_latency_ms: checkHistory.pingLatencyMs,
  checked_at: checkHistory.checkedAt,
  message: checkHistory.message,
  rn: sql<number>`row_number() over (partition by ${checkHistory.configId} order by ${checkHistory.checkedAt} desc)`,
}).from(checkHistory)
  .where(targetIds ? inArray(checkHistory.configId, targetIds) : undefined)
  .as("ranked");

// then filter rn <= limitPerConfig (Drizzle subquery), join configs+models.
```
If the window-function subquery proves awkward, fall back to fetching the
last N per config via `union all` of per-config `limit` selects (source's
`fallbackFetchSnapshot` already does a variant). Prune is a plain delete:
```ts
await db.delete(checkHistory).where(lt(checkHistory.checkedAt, cutoffDate));
```

## 4. Cache Migration — module-level `globalThis` → Cache API

Source uses 4 in-memory caches with TTLs tied to poll interval:
`config-loader`, `availability`, `dashboard-data` (Map, ETag, inflight),
`group-info`. These survive across requests **only because Node lingers**.
Workers recycle isolates → in-memory state is unreliable.

### Strategy: Cloudflare Cache API (`caches.default`)

| Cache | Key | TTL | Why Cache API |
|---|---|---|---|
| config | `https://cx.internal/config:enabled` | poll interval (~60s) | read-heavy by poller + dashboard; Cache API is shared across isolates |
| availability | `https://cx.internal/availability:all` | poll interval | recomputed only by poller write; dashboard reads stale-ok |
| dashboard aggregate | `https://cx.internal/dashboard:{period}:{scope}` | 5 min / poll interval | source uses 5-min cycle; ETag stays HTTP-level (304) |
| group-info | `https://cx.internal/group-info:all` | poll interval | |
| notifications | handled by `Cache-Control` header (unchanged) | 60s swr 300 | already HTTP-cached |

**Wrapper** (`src/cache/cache-api.ts`):
```ts
export async function cacheGet<T>(key: string): Promise<T | null> {
  const res = await caches.default.match(keyUrl(key));
  if (!res) return null;
  return (await res.json()) as T;          // embeds expiresAt in body
}
export async function cachePut(key: string, data: unknown, ttlMs: number, ctx: ExecutionContext) {
  const body = JSON.stringify({ data, expiresAt: Date.now() + ttlMs });
  ctx.waitUntil(caches.default.put(keyUrl(key), new Response(body, {
    headers: { "Cache-Control": `max-age=${Math.ceil(ttlMs/1000)}` },
  })));
}
```
- **Stale-read guard**: wrapper checks `expiresAt` in body; on miss/stale
  it recomputes and `waitUntil`-writes back (non-blocking), mirroring
  source's "return stale, refresh async" behavior.
- **Inflight dedup** (source tracks a `Promise` to coalesce concurrent
  misses): drop it — Cache API write is idempotent; at worst a couple of
  concurrent recomputes, acceptable for a monitoring dashboard.
- **DO-internal caches** (official status, last-tick cursors): stay in DO
  `storage` (transactional, per-DO), NOT Cache API — they're DO-private
  state, not shared request cache.

> Alternative considered: KV. Rejected for these — KV's eventual
> consistency (up to 60s write propagation) clashes with "poller writes,
> dashboard reads fresh within seconds". Cache API is per-colocated-edge,
> faster for this read-after-write pattern. KV remains an option for
> truly global low-churn data if Cache API edge-locality causes staleness
> across regions (decide after first deploy observation).

## 5. Poller — PollerDO state machine

```
PollerDO (id = "1", global singleton)
storage keys:
  running          : boolean        ← re-entrancy guard (replaces globalThis.__checkCxPollerRunning)
  lastMainTickMs   : number
  lastOfficialMs   : number
  officialStatus   : Record<ProviderType, OfficialStatusResult>  ← replaces globalThis cache
  officialRunning  : boolean

wake():  // called by scheduled() handler
  if (no alarm set) storage.setAlarm(now)   // re-seed if evicted

alarm():
  const now = Date.now()
  const mainInterval    = pollingConfig(c.env).mainIntervalMs    // default 60_000
  const officialInterval= pollingConfig(c.env).officialIntervalMs // default 300_000
  const running = await storage.get("running")

  // MAIN loop
  if (!running && now - lastMainTickMs >= mainInterval) {
     await storage.put("running", true)
     ctx.waitUntil(runTick(c.env).finally(()=>storage.put("running", false)))
     await storage.put("lastMainTickMs", now)
  }
  // OFFICIAL loop
  if (now - lastOfficialMs >= officialInterval) {
     await runOfficialTick(this)     // guarded by officialRunning
     await storage.put("lastOfficialMs", now)
  }
  // re-arm: next wakeup = min(remaining main, remaining official)
  await storage.setAlarm(now + nextDelayMs)
```

- **runTick** mirrors source `tick()`: load enabled configs (exclude
  `is_maintenance`) → `runProviderChecks` (concurrency-limited) →
  `append` to `check_history` → prune. All DB via `createDb(env)`.
- **No leadership table**: the DO with fixed name `"1"` IS the leader.
  Multi-replica Workers all route `scheduled()` to the same DO instance
  (Cloudflare guarantees a single DO per id). Cron firing on N regions
  still funnels to one DO.
- **alarm runs outside fetch wall-clock budget** — safe for a batch of
  AI checks. If a tick risks exceeding limits (many configs), chunk
  inside runTick and re-arm alarm to continue (rollback point).

## 6. Routing — merged Worker, Hono + React Router v7

### Mounting

```ts
// src/index.ts
import { createHonoApp } from "./api/app";
export { PollerDO } from "./do/poller-do";

const api = createHonoApp();              // /api/v1/status, /api/dashboard, …

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/")) return api.fetch(req, env, ctx);
    return await reactRouterHandler(req, env, ctx);  // RRv7 server build (assets + SSR)
  },
  async scheduled(event, env, ctx) {
    const id = env.POLLER.idFromName("1");
    ctx.waitUntil(env.POLLER.get(id).wake());
  },
} satisfies ExportedHandler<Env>;
```

### Route partition (phase 1 + reserved phase 2)

| Path | Owner | Auth |
|---|---|---|
| `/` `/group/:name` | React Router v7 (SSR) | public |
| `/api/v1/status` `/api/dashboard` `/api/group/:name` `/api/notifications` | Hono | public |
| `/api/internal/cache-metrics` | Hono | `x-internal-token` (unchanged) |
| `/dashboard/*` | React Router v7 (phase-2 admin) | **reserved** — Better Auth gate |
| `/api/admin/*` | Hono (phase 2) | **reserved** — Better Auth gate |
| `/auth/*` | Better Auth handler (phase 2 setup; phase-1 can stub) | — |

**No route swallowing**: Hono owns `/api/*` exclusively; RRv7 owns
everything else. RRv7 `routes.ts` must not catch `/api` (it returns 404
for unknown `/api/*`, and Hono runs first anyway).

### ETag handling

`/api/dashboard` and `/api/group/:name` compute ETag (djb2 hash, as
source) over the response body (excluding volatile `generatedAt`) and
honour `If-None-Match` → 304. Source behavior preserved verbatim.

## 7. Cross-cutting technical resolutions

| Concern | Resolution |
|---|---|
| **`p-limit`** (Node-friendly concurrency limiter) | Replace with a small `pLimit(n)` built on plain Promises (`src/providers/concurrency.ts`) — ~15 LOC, no Node deps. Logic identical (queue + active count). |
| **Vercel AI SDK on Workers** | `streamText` uses standard `fetch` → works on Workers natively (no polyfill). `@ai-sdk/*` creators likewise. Verify with a single integration check in §implement. |
| **`process.env.X`** (used pervasively in source `polling-config.ts`, `admin.ts`) | Replace with `c.env.X` / `env.X` threaded from bindings (spec `environment.md`). Configs become `wrangler.jsonc` `[vars]`: `CHECK_POLL_INTERVAL_SECONDS`, `CHECK_CONCURRENCY`, `HISTORY_RETENTION_DAYS`, `OFFICIAL_STATUS_CHECK_INTERVAL_SECONDS`, `INTERNAL_METRICS_TOKEN`. |
| **`"server-only"` import guard** | Not needed under RRv7+Hono (server code is structurally separate under `src/`). Remove. |
| **`instrumentation.ts`** (Next startup hook) | Gone — DO `alarm()`/`wake()` is the init. |
| **`crypto.getRandomValues` / `crypto.randomUUID` / `crypto.subtle`** | Available on Workers (spec). Use freely, but never at module top-level (call inside handlers). |
| **Logger** | Source uses `console.error/log` with `[check-cx]` prefix. Replace with structured logger (`src/lib/logger.ts`, spec `error-logging.md`): JSON, request-scoped via `requestContext()`, **sanitize** endpoint/token/api_key before logging. |
| **`@lobehub/icons`, recharts, lucide-react, shadcn ui** | Pure client/React libs — migrate as-is. Tailwind v4 `--color-*` mappings added per spec (else transparent backgrounds). |
| **`next-themes`** | Replace with cookie-based theme in RRv7 (read in `root.tsx` loader, set via action/cookie). Same UX (toggle persists). |
| **`nextjs-toploader`** | Replace with an RRv7-navigation-aware top progress bar (e.g. `nprogress` driven by `useNavigation`). |
| **`@vercel/analytics`/`speed-insights`** | Remove (or swap to Cloudflare Web Analytics snippet). |
| **`ClientTime`/`theme-clock` hydration** | RRv7 hydration model differs; re-implement client-only time render via `useEffect` + `isMounted` guard (spec auth pattern). |
| **`UNSAFE_*`/runtime caches** | → Cache API (§4). |

## 8. Polling config (env-bound)

```jsonc
// wrangler.jsonc [vars]
"vars": {
  "CHECK_POLL_INTERVAL_SECONDS": "60",
  "OFFICIAL_STATUS_CHECK_INTERVAL_SECONDS": "300",
  "CHECK_CONCURRENCY": "5",
  "HISTORY_RETENTION_DAYS": "30"
}
```
```ts
// src/core/polling-config.ts — reads env, not process.env, per spec
export function getPollingIntervalMs(env: Env): number { /* clamp 15..600s */ }
export function getOfficialIntervalMs(env: Env): number { /* clamp 60..3600s */ }
export function getCheckConcurrency(env: Env): number { /* clamp 1..20 */ }
```
All clamps identical to source. Secrets (`DATABASE_AUTH_TOKEN`,
`BETTER_AUTH_SECRET`, `GITHUB_OAUTH_*`, `INTERNAL_METRICS_TOKEN`) via
`wrangler secret put`, never in `[vars]`.

## 9. Phase-1 Better Auth posture

- Scaffold `auth.ts` (server) + `auth-client.ts` per spec
  `authentication.md` (Better Auth v1.x, UPPERCASE client).
- Session tables (`user`, `session`, …) added to Drizzle schema now
  (shared with phase 2).
- Phase-1 middleware: `requestContext()` first, then an auth middleware
  that **passes through** `/`, `/group/*`, `/api/(status|dashboard|group|notifications)`.
  The `/dashboard/*` + `/api/admin/*` gates are wired but unused until
  phase 2.
- GitHub OAuth provider configured in Better Auth (for phase 2); phase 1
  need not complete the login UI.

## 10. Compatibility / Rollout / Rollback

- **Zero-downtime not required** for phase 1 (greenfield Workers, no
  traffic yet). First deploy = cutover.
- **Data**: new Turso DB seeded via `drizzle-kit migrate`. Historical
  Supabase import is out-of-scope (optional follow-up); phase-1 starts
  collecting fresh `check_history` from deploy time.
- **Rollback**: keep source `check-cx` (Vercel/Docker) live during
  phase-1 verification; if CF Worker misbehaves, point DNS/origin back.
  DO + Turso are new resources, safe to delete.
- **Migration safety**: per spec `database.md`, never edit committed
  drizzle migrations; test on dev Turso first; freeze before prod.
- **Observability**: `wrangler tail` + `observability.enabled:true`;
  structured logs with sanitized fields; `cache-metrics` endpoint
  preserved for cache hit/miss visibility.

## 11. Open design questions (non-blocking, resolve during implement)

- Window-function subquery vs. union-all fallback for
  `get_recent_check_history` Drizzle impl (pick whichever validates
  cleanly with `drizzle-orm/libsql`).
- Whether Cache API edge-locality causes cross-region dashboard staleness
  (observe post-deploy; switch specific caches to KV if needed).
- Exact RRv7 theme-persistence cookie shape (minor).
