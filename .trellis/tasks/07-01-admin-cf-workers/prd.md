# Migrate check-cx-admin to CF Workers (phase 2)

> Phase-2 child of `07-01-migrate-to-cf-workers`. Starts only after phase-1
> dashboard child is verified. Inherits all parent decisions + the merged
> Workers skeleton built in phase 1.

## Goal

将 `BingZi-233/check-cx-admin`(后台管理) 迁移进一期建好的合并 Workers,
作为 `/dashboard/*` 子域: Better Auth 登录保护 + Hono CRUD API + React Router
管理 UI, 共享一期建好的 Turso schema 与 Drizzle types。

## Background — 二期需迁移的具体行为(已确认事实)

### 现状认证(需迁移到 Better Auth)

- Supabase Auth: GitHub OAuth + password; `@supabase/ssr` cookie session;
  中间件 `proxy.ts` → `lib/supabase/middleware.ts` 的 `updateSession`。
- 两级权限: `admin`(全部分组) vs 普通成员(绑定单个 `groupName`),
  见 `lib/admin/permissions.ts`。`admin_users` 表存角色与分组绑定。
- OAuth 流: `/auth/sign-in`(选 provider)→ Supabase → `/auth/callback`
  → `resolveAppUserFromIdentity` → 校验白名单/角色。

### 现状功能(server actions → Hono routes)

- `/dashboard/groups` · `/dashboard/models` · `/dashboard/configs` ·
  `/dashboard/templates` · `/dashboard/history` · `/dashboard/notifications` ·
  `/dashboard/users` · `/dashboard/system` —— 全 CRUD, Next server actions。
- 组件: Base UI + shadcn 混用; 一期已统一到 shadcn(spec), 二期沿用。
- 无常驻进程。

## Decisions (继承父任务)

- 认证切 Better Auth(email/password + GitHub OAuth), 迁移 `admin_users` 角色。
- 共享一期 schema/types; admin 写操作走 Hono `/api/admin/*` 或 React Router
  action/loader(具体在二期 design.md 定)。
- 权限模型保留两级(admin/成员), 中间件按角色放行。

## Requirements (概要, 二期 planning 时细化)

- R-ADMIN-1 Better Auth 登录流(email/password + GitHub OAuth), session 存 Turso +
  Cache API 缓存(沿用一期 Better Auth 基础设施)。
- R-ADMIN-2 所有 CRUD 域(groups/models/configs/templates/history/notifications/
  users/system)在新架构可用, 语义对齐源项目。
- R-ADMIN-3 权限中间件: admin 全权, 成员仅限所属分组; 未登录访问 `/dashboard/*`
  跳登录。
- R-ADMIN-4 provider key 经 admin 写入仍明文存 `check_configs.api_key`,
  遵循父 R-PARENT-3 的 3 道防线。

## Acceptance Criteria (概要)

- [ ] AC-ADMIN-1 登录流可用(email/pw + GitHub OAuth), session 正确持久化与缓存。
- [ ] AC-ADMIN-2 各 CRUD 域增删改查与源项目语义一致。
- [ ] AC-ADMIN-3 权限隔离生效(成员越权被拒)。
- [ ] AC-ADMIN-4 与 dashboard 共处同一 Workers, 路由无冲突。

## Out of Scope

- 一期 dashboard 的全部内容 → `07-01-dashboard-cf-workers`。

## Open Questions

- 二期 planning 时再细化: Better Auth 迁移现有 Supabase 用户的策略、
  React Router action vs Hono `/api/admin/*` 的取舍、组件库差异收敛清单。
