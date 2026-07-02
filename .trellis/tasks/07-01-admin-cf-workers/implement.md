# Implement — check-cx admin → CF Workers (phase 2)

> Execution plan for `07-01-admin-cf-workers`. Ordered checklist with gates.

## Validation commands (gates)
```bash
pnpm typecheck   # tsc 0 errors
pnpm lint        # eslint 0 errors
pnpm build       # react-router build passes
wrangler deploy --dry-run
wrangler dev     # local; test login + a CRUD round-trip
```

---

## Phase A — Better Auth foundation

- [ ] A1 Install: `pnpm add better-auth @better-auth/drizzle-adapter`
- [ ] A2 `src/auth.ts` — `createAuth(env, baseURL)` with drizzleAdapter on libSQL,
  emailAndPassword + github social. (design §3.1)
- [ ] A3 `src/api/auth-router.ts` — mount Better Auth handler at `/api/auth/*`
  in `src/api/app.ts`. Add CORS for auth routes.
- [ ] A4 `wrangler.jsonc` secrets: `BETTER_AUTH_URL`, `GITHUB_CLIENT_ID`,
  `GITHUB_CLIENT_SECRET`, `ADMIN_EMAILS` (BETTER_AUTH_SECRET already set in p1).
- [ ] A5 Seed: create a bootstrap admin in `admin_users` (email from ADMIN_EMAILS,
  role=admin). Add the Better Auth `user` + `account` (password) rows manually
  for the first admin via a seed script (like phase-1 seed-dev.ts).
- [ ] A6 `src/middleware/require-session.ts` — getSession + resolve AppUser
  (role/group from admin_users joined on auth_user_id).
- [ ] **GATE A**: `wrangler dev`; curl `/api/auth/...` sign-in returns a session
  cookie; unauthenticated `/api/admin/configs` → 401.

## Phase B — Admin API (Hono `/api/admin/*`)

- [ ] B1 `src/api/admin/app.ts` — sub-app mounting session middleware + domain routers.
- [ ] B2 configs router: list(scoped), create, update, delete, batch (enable/
  disable/maintenance/replace/clear/delete). Type-match validation (app-layer).
- [ ] B3 models router: CRUD + template link (admin-only).
- [ ] B4 templates router: CRUD (admin-only).
- [ ] B5 groups router: CRUD (admin-only).
- [ ] B6 history router: list(scoped) + clear.
- [ ] B7 notifications router: CRUD (admin-only).
- [ ] B8 users router: list(invitees), invite, activate, set-role (admin-only).
- [ ] B9 system router: stats + cache-reset (admin-only).
- [ ] **GATE B**: `pnpm typecheck` + `pnpm lint` 0 errors; `wrangler dev` —
  CRUD round-trip via curl with session cookie for configs (create→list→delete).

## Phase C — Admin UI shell (RRv8)

- [ ] C1 `app/routes/login.tsx` — login page (email/pw form + GitHub OAuth button).
  On success redirect `/dashboard`.
- [ ] C2 `app/routes/dashboard.tsx` — layout route: loader checks session (via
  `/api/auth/get-session` or cookie forward) → redirect `/login` if none; render
  sidebar + header. Migrate app-sidebar, nav-main, nav-user.
- [ ] C3 Add missing UI primitives: sidebar, separator, dropdown-menu, select,
  input, textarea, label, field, tooltip, avatar, breadcrumb, skeleton,
  alert-dialog (copy from source components/ui/).
- [ ] **GATE C**: `pnpm build` passes; `wrangler dev` — `/login` renders,
  login redirects to `/dashboard` (empty), logout works.

## Phase D — CRUD pages (configs first, then others)

- [ ] D1 configs: list (table + batch select), new, edit. `<Form>` → route action
  → Hono API. Migrate configs-table, config-model-fields, row-actions.
- [ ] D2 models: list/new/edit.
- [ ] D3 templates: list/new/edit (+ model-template-fields).
- [ ] D4 groups: list/new/edit.
- [ ] D5 history: list + clear.
- [ ] D6 notifications: list/new/edit (+ markdown-preview).
- [ ] D7 users: list + invite/activate/role.
- [ ] D8 system: stats + cache-reset buttons.
- [ ] D9 dashboard._index: overview (counts from /api/admin/system).
- [ ] **GATE D**: browser-verify each domain's list/create/edit/delete with
  both admin and member roles (scope isolation).

## Phase E — Integration & deploy

- [ ] E1 Create GitHub OAuth App (callback `/api/auth/callback/github`); set secrets.
- [ ] E2 Final typecheck/lint/build clean.
- [ ] E3 `wrangler deploy`.
- [ ] E4 Verify: login (email/pw + GitHub), session persists, CRUD works,
  member cannot access admin-only routes, dashboard (phase-1) still works.

## Risk watch
- Better Auth drizzleAdapter + libSQL HTTP: if the adapter can't drive libSQL,
  fall back to Better Auth's native Kysely libSQL dialect (`@libsql/kysely-libsql`).
- Cookie forwarding in RRv8 actions (same-origin fetch): confirm session cookie
  reaches Hono; if not, pass session via header instead.
