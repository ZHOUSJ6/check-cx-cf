# Design — check-cx admin → CF Workers (phase 2)

> Technical design for child task `07-01-admin-cf-workers`.
> Builds on the phase-1 merged Worker (same app, same Turso DB, same Drizzle schema).

## 1. Goal

Migrate `check-cx-admin` (后台管理) into the existing Worker as the `/dashboard/*`
sub-domain: Better Auth login + Hono `/api/admin/*` write API + React Router v8
admin UI. Shares the phase-1 schema/types/poller.

## 2. Architecture (additions to phase-1 Worker)

```
Worker (single, check-cx.zhousj.workers.dev)
├── /                    ← phase-1 dashboard (public)
├── /group/:name         ← phase-1 (public)
├── /api/v1/*            ← phase-1 public read API
├── /api/auth/*          ← NEW: Better Auth handler (login/signup/callback/signout)
├── /api/admin/*         ← NEW: Hono CRUD API (Better Auth session-gated)
├── /dashboard/*         ← NEW: RRv8 admin UI (Better Auth session-gated)
└── /login               ← NEW: login page (email/pw + GitHub OAuth)
```

### Route partition (no swallowing)
- Hono owns `/api/*` (auth + admin + existing public read).
- RRv8 owns `/` , `/group/*`, `/login`, `/dashboard/*`.
- Admin routes gated by a loader that checks the Better Auth session cookie;
  unauthenticated → redirect `/login`.

## 3. Authentication — Better Auth

### 3.1 Setup (betterAuth + drizzleAdapter + libSQL)

NOT using `better-auth-cloudflare` (that targets D1/KV bindings). We use the
standard `betterAuth` with `@better-auth/drizzle-adapter` on our existing
libSQL client (same `createDb(env)` as phase 1). Session tables already exist
in the phase-1 schema (`user`, `session`, `account`, `verification`).

```ts
// src/auth.ts — created per request from env (spec: environment.md)
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { createDb } from "#/db/client";

export function createAuth(env: Env, baseURL: string) {
  const db = createDb(env);
  return betterAuth({
    baseURL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: "sqlite" }),
    emailAndPassword: { enabled: true },
    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
      },
    },
    session: { cookieCache: { enabled: true, maxAge: 300 } },
  });
}
```

### 3.2 Hono auth route mounting

```ts
// src/api/auth-router.ts
app.all("/*", async (c) => {
  const auth = createAuth(c.env, new URL(c.req.url).origin);
  return auth.handler(c.req.raw);
});
// mounted at /api/auth in src/api/app.ts
```

### 3.3 Session verification middleware (admin API)

```ts
// src/middleware/require-session.ts
async function getSession(c): Promise<{ user, session } | null> {
  const auth = createAuth(c.env, new URL(c.req.url).origin);
  return auth.api.getSession({ headers: c.req.raw.headers });
}
```
- `/api/admin/*` middleware: no session → 401; load `admin_users` row by
  `auth_user_id` to get role + group scope. Missing directory row → 403.

### 3.4 Role bridge: Better Auth user → admin_users

Better Auth manages `user`/`session`/`account`. Our `admin_users` table
stores role/group and links via `auth_user_id`. Flow:
1. User signs up/in via Better Auth → `user` row created, session set.
2. First login: if `admin_users` row exists with matching email (pre-seeded
   invite) and `auth_user_id IS NULL` → bind it. Else if email in
   `ADMIN_EMAILS` bootstrap list → create admin row. Else → 403 (not invited).
3. AppUser = { ...betterAuthUser, role, groupName } joined each request.

## 4. Authorization — 2-level role scope

Mirrors source `permissions.ts`:
- **admin**: full access to all groups/domains.
- **member**: scoped to `admin_users.group_name`; can only see/edit configs in
  their group; cannot manage users/groups/templates.

Enforced in `/api/admin/*` handlers via the AppUser scope:
- configs/history queries apply `.where(group_name = user.groupName)` for members.
- groups/templates/users/system endpoints require `role === "admin"`.

## 5. Admin CRUD API — `/api/admin/*` (Hono)

8 domains, mirroring source server actions. Each domain = a router under
`src/api/admin/`. Write operations are POST; reads can be GET or fetched via
RRv8 loader.

| Domain | Route prefix | Methods | Scope |
|---|---|---|---|
| configs | `/api/admin/configs` | GET(list), POST(create/update/delete/batch) | member: own group; admin: all |
| models | `/api/admin/models` | CRUD + link template | admin only |
| templates | `/api/admin/templates` | CRUD | admin only |
| groups | `/api/admin/groups` | CRUD | admin only |
| history | `/api/admin/history` | GET(list), POST(clear) | scoped |
| notifications | `/api/admin/notifications` | CRUD | admin only |
| users | `/api/admin/users` | GET(list), POST(invite/activate/role) | admin only |
| system | `/api/admin/system` | GET(stats), POST(cache-reset) | admin only |

**Batch operations** (configs: enable/disable/maintenance/replace/clear/delete)
map to `POST /api/admin/configs/batch` with `{ ids, operation, ...params }`.

**Type-match validation** (source had PG triggers): app-layer check before
insert/update — config.type must equal model.type; model.type must equal
template.type.

## 6. Frontend — RRv8 admin UI (`/dashboard/*`)

### 6.1 Layout
- `app/routes/dashboard.tsx` — layout route: sidebar (NavMain), header (user +
  scope), session guard in loader (redirect `/login` if no session).
- Source components migrated: `app-sidebar`, `nav-main`, `nav-user`, `page-header`,
  `notice`, `page-transition`, plus admin feature components (tables, forms).

### 6.2 CRUD pages (RRv8 routes)
```
app/routes/dashboard._index.tsx              ← overview/stats
app/routes/dashboard.configs.tsx             ← list + batch
app/routes/dashboard.configs_.$id.tsx        ← edit
app/routes/dashboard.configs_.new.tsx        ← create
app/routes/dashboard.models.tsx / new / $id
app/routes/dashboard.templates.tsx / new / $id
app/routes/dashboard.groups.tsx / new / $id
app/routes/dashboard.history.tsx
app/routes/dashboard.notifications.tsx / new / $id
app/routes/dashboard.users.tsx
app/routes/dashboard.system.tsx
app/routes/login.tsx                         ← login page
```

### 6.3 Write flow (RRv8 `<Form>` → action → Hono API)
```tsx
<Form method="post" action="/dashboard/configs">
  <input name="name" /> ...
  <button name="intent" value="create" />
</Form>
// route action:
export async function action({ request }) {
  const formData = await request.formData();
  const res = await fetch(`${origin}/api/admin/configs`, {
    method: "POST",
    headers: { cookie: request.headers.get("cookie") }, // forward session
    body: formData,
  });
  return data(await res.json(), { status: res.status });
}
```
The action forwards the session cookie to the Hono API (same-origin), which
verifies via Better Auth. Revalidation is automatic (RRv8 reloads loaders).

### 6.4 UI components
Migrate source `components/` (admin-specific): sidebar, nav-*, page-header,
notice, markdown-preview, model-template-fields, status-badge, row-actions,
cleanup buttons. Plus shared UI primitives already migrated in phase 1
(badge/button/card/table/etc.) — reuse. Missing primitives to add:
sidebar, separator, sheet, dropdown-menu, select, input, textarea, label,
field, input-group, tooltip, avatar, breadcrumb, combobox, skeleton, alert-dialog.

## 7. Project layout (phase-2 additions)

```
src/auth.ts                          ← createAuth(env, baseURL)
src/api/auth-router.ts               ← Better Auth handler mount
src/api/admin/app.ts                 ← Hono admin sub-app (session middleware)
src/api/admin/{configs,models,templates,groups,history,notifications,users,system}/router.ts
src/middleware/require-session.ts    ← session + AppUser loader
src/db/queries/admin/                ← scoped admin queries (write ops)
app/routes/dashboard.*.tsx           ← admin UI routes
app/routes/login.tsx
app/components/admin/                ← admin feature components
app/components/ui/                   ← add missing primitives
app/lib/admin/                       ← client admin helpers (scope display)
```

## 8. Env / secrets (additions)

```
BETTER_AUTH_SECRET    (already in phase-1 scaffold)
BETTER_AUTH_URL       = https://check-cx.zhousj.workers.dev
GITHUB_CLIENT_ID      ← from GitHub OAuth App
GITHUB_CLIENT_SECRET  ← from GitHub OAuth App
ADMIN_EMAILS          ← comma-separated bootstrap admin emails
```

GitHub OAuth App: callback URL = `https://check-cx.zhousj.workers.dev/api/auth/callback/github`.

## 9. Rollout / rollback

- Admin is additive (new routes under `/dashboard/*` + `/api/admin/*`); phase-1
  dashboard unaffected.
- Deploy when login + at least configs CRUD work (most-used domain).
- Rollback: redeploy previous version; admin routes simply 404 but dashboard intact.

## 10. Open design questions (resolve during implement)

- Whether to prefetch admin stats in the dashboard layout loader (avoid N+1).
- Confirm Better Auth `drizzleAdapter` works with libSQL HTTP driver (the
  adapter expects a drizzle instance; our libSQL client should satisfy it —
  verify with the first sign-in integration check).
- Rate limiting: Better Auth's built-in rate limiter needs KV; without it,
  rely on Cloudflare's edge rate limiting. Acceptable for an admin panel.
