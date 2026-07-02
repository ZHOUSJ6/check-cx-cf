# Implement — check-cx dashboard → CF Workers (phase 1)

> Execution plan for `07-01-dashboard-cf-workers`. Ordered checklist.
> Each gate runs validation before moving on. Rollback points marked 🔄.

Source reference repos live at `/tmp/check-cx-src` (dashboard) and
`/tmp/check-cx-admin-src` (admin) during this task.

## Validation commands (run at gates)

```bash
pnpm install              # after dependency changes
pnpm typecheck            # 0 errors (gate)
pnpm lint                 # 0 errors (gate)
pnpm build                # RRv7 + Worker build passes (gate)
wrangler types            # regenerate bindings after wrangler.jsonc edits
wrangler deploy --dry-run # validate config + bundle (gate, no deploy)
```

Local runtime checks:
```bash
wrangler dev              # local workerd; visit / and /group/:name
wrangler dev --test-scheduled   # then curl http://localhost:8787/__scheduled
drizzle-kit migrate       # apply to dev Turso
```

---

## Phase A — Skeleton & Data Layer (no UI yet)

- [ ] A1 Init merged-Worker project structure: `package.json` (pnpm),
  `tsconfig.json`, `vite.config.ts` (`@cloudflare/vite-plugin >=1.21.0` +
  `@react-router/dev` + `@tailwindcss/vite`), `react-router.config.ts`,
  `wrangler.jsonc` (name, main, `compatibility_date` recent,
  `compatibility_flags:["nodejs_compat"]`, `[vars]` per design §8).
  🔄 *rollback point: git checkout before A2*
- [ ] A2 Pin dependency versions per spec `dependency-versions.md`:
  `drizzle-orm ^0.45`, `drizzle-kit ^0.31`, `@libsql/client` (check unenv
  compat), `hono ^4`, `react-router ^7`, `better-auth ^1`, `zod ^4`,
  `vite ^6`, `tailwindcss ^4`, `wrangler ^4`. Verify lockfile resolves.
- [ ] A3 `src/db/schema.ts` — all 7 tables (drop `poller_leases`) +
  Better Auth session tables. Apply §3.1 type mapping. `check_status_valid`
  + latency + role CHECKs via Drizzle `check()`.
- [ ] A4 `src/db/client.ts` — `createDb(env)` using
  `drizzle-orm/libsql` + `@libsql/client` (explicit `/http` or `/web`
  driver per spec). Embed authToken in URL pattern.
- [ ] A5 `drizzle.config.ts` (dotenv + `process.env`, dialect turso) +
  run `drizzle-kit generate` → first migration in `drizzle/`.
- [ ] A6 Create dev Turso DB; `drizzle-kit migrate` against it; confirm
  7 tables + indexes via `turso db shell` or Drizzle Studio.
- [ ] **GATE A**: `pnpm typecheck` + `pnpm lint` 0 errors. Migration
  applies cleanly to empty dev DB.

## Phase B — Backend core (poller + providers + cache)

- [ ] B1 `src/lib/logger.ts` (structured, sanitized — strip
  endpoint/token/api_key) + `src/lib/security.ts` (Web Crypto helpers,
  called inside handlers). `src/middleware/request-context.ts`
  (mount-first per spec).
- [ ] B2 `src/core/polling-config.ts` — env-bound (reads `env`, not
  `process.env`), same clamps as source.
- [ ] B3 Migrate providers verbatim where pure: `challenge.ts`,
  `endpoint-ping.ts`, `official-status/{openai,anthropic,index}.ts`.
- [ ] B4 `src/providers/concurrency.ts` — `pLimit(n)` reimpl (no Node
  deps). Port `providers/index.ts` `runProviderChecks` to use it.
- [ ] B5 `src/providers/ai-sdk-check.ts` — migrate `streamText`-based
  check; replace `AbortController`/`setTimeout` timeout with
  Workers-compatible pattern (AbortController + `setTimeout` works on
  Workers). Confirm `@ai-sdk/*` creators compile under Vite.
- [ ] B6 `src/db/queries/` — port `config-loader`, `history` (incl.
  `get_recent_check_history` window-fn impl + `prune`), `availability`,
  `notifications`, `group-info`. Use `inArray` + batch; no await-in-loop
  (spec). `api_key` selected ONLY in poller's config load (never in
  read DTOs).
- [ ] B7 `src/cache/cache-api.ts` wrapper (get/put with `expiresAt` +
  `waitUntil` non-blocking writeback). Rewire the 4 caches
  (config/availability/dashboard/group-info) onto it per design §4.
- [ ] B8 `src/core/dashboard-data.ts` + `health-snapshot.ts` +
  `group-data.ts` — port aggregation, Cache-API backed, ETag (djb2).
  `src/core/status.ts`.
- [ ] **GATE B**: `pnpm typecheck` + `pnpm lint` 0 errors; `pnpm build`.

## Phase C — Durable Object poller

- [ ] C1 `src/do/poller-do.ts` — `PollerDO` class exporting `fetch`,
  `alarm()`. `storage` keys per design §5 (running, lastMainTickMs,
  lastOfficialMs, officialStatus, officialRunning). `wake()` re-seeds
  alarm. Two-loop alarm scheduling.
- [ ] C2 `src/core/poller.ts` (`runTick`) + `official-status.ts`
  (`runOfficialTick`) as plain fns invoked by DO with `env`/`ctx`.
- [ ] C3 `src/index.ts` — `export { PollerDO }`; default `fetch`
  (Hono-vs-RRv7 routing) + `scheduled` (→ `env.POLLER.idFromName("1").get().wake()`).
  Declare DO binding + Cron `["* * * * *"]` in `wrangler.jsonc`.
- [ ] C4 `wrangler types` to refresh bindings; typecheck DO against
  generated `DurableObjectNamespace`.
- [ ] C5 Local test: `wrangler dev --test-scheduled` → trigger
  `/__scheduled`; confirm a tick writes a `check_history` row to dev
  Turso (seed a `check_configs` row with a real test API key in dev only).
  Confirm re-entrancy guard + alarm re-arm.
  🔄 *rollback point: DO logic isolated; can disable Cron without touching API*
- [ ] **GATE C**: scheduled tick runs; history row appears; no duplicate
  writes on concurrent triggers.

## Phase D — Hono read API

- [ ] D1 `src/api/app.ts` Hono app; `requestContext()` first. Mount:
  `status`, `dashboard`, `group`, `notifications`, `internal` routers
  under `/api/*`.
- [ ] D2 Port each route handler from Next route handlers:
  `/api/v1/status`, `/api/dashboard` (trendPeriod + ETag/304 +
  forceRefresh), `/api/group/:name` (djb2 ETag), `/api/notifications`
  (Cache-Control header), `/api/internal/cache-metrics` (token gate).
- [ ] D3 Ensure `api_key` never in any response payload (whitelist select
  columns / strip in serializer).
- [ ] **GATE D**: `wrangler dev`; `curl` each endpoint → JSON shape
  matches source. `If-None-Match` returns 304 on matching ETag.

## Phase E — Frontend (React Router v7)

- [ ] E1 `app/root.tsx` (layout, theme via cookie, fonts). Add Tailwind v4
  `--color-*` mappings (spec) to `app.css` or shadcn theme.
- [ ] E2 Migrate `components/ui/*` (shadcn primitives) + feature
  components (`provider-card`, `status-timeline`, `dashboard-view`,
  `availability-stats`, `notification-banner`, `group-*`, `theme-*`,
  `client-time`, `provider-icon`). Replace `next-themes` → cookie theme;
  `nextjs-toploader` → nprogress-on-`useNavigation`; remove
  `@vercel/analytics`.
- [ ] E3 `app/routes.ts` + routes: `_index` (`/`), `group.$groupName`
  (`/group/:name`), `not-found`. Loaders fetch from Hono `/api/*` (or
  direct DB read for SSR first paint). Wire `@lobehub/icons` + recharts.
- [ ] E4 `isMounted`-guarded client time/clock components (hydration safe).
- [ ] **GATE E**: `pnpm build`; `wrangler dev`; browser-verify `/` and
  `/group/:name` render correctly, theme toggle persists, charts render,
  notifications banner works (AC-DASH-8).

## Phase F — Integration & deploy

- [ ] F1 Set secrets: `wrangler secret put DATABASE_AUTH_TOKEN`,
  `INTERNAL_METRICS_TOKEN`, `BETTER_AUTH_SECRET` (+ GitHub OAuth for p2).
- [ ] F2 Prod Turso DB + `drizzle-kit migrate` (prod). Confirm schema.
- [ ] F3 `wrangler deploy --dry-run` → fix any bundling issues.
- [ ] F4 `wrangler deploy` to prod. Verify:
  - `/` + `/group/:name` load (AC-DASH-1/2)
  - `/api/*` endpoints respond (AC-DASH-3)
  - Cron fires, DO writes history, no dup writes (AC-DASH-4)
  - `api_key` absent from all responses/client bundle (AC-DASH-5)
- [ ] F5 Final `pnpm typecheck` + `pnpm lint` + `pnpm build` clean (AC-DASH-6).
  🔄 *rollback: keep Vercel/Docker source live; repoint DNS if needed*

## Review gates summary

| After | Gate |
|---|---|
| Phase A | typecheck/lint/migrate clean |
| Phase B | typecheck/lint/build clean |
| Phase C | scheduled tick writes history, no dups |
| Phase D | API shapes match source, ETag 304 works |
| Phase E | browser-verified UI parity |
| Phase F | prod deploy + all AC-DASH-* confirmed |

## Risk watch (escalate to design revision if hit)

- `@ai-sdk/*` fails to bundle under `@cloudflare/vite-plugin` → may need
  alias/unenv config; if blocking, fall back to raw `fetch` per provider
  (re-implement the 3 provider checkers without the SDK).
- Window-function query not supported by target libSQL version → use
  union-all fallback (source already has the logic).
- DO `alarm()` timing drift across regions → acceptable for a 60s poll;
  monitor `lastTickMs` skew.
