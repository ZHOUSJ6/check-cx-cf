# Migrate check-cx + check-cx-admin to Cloudflare Workers

> Parent task. Owns the cross-cutting requirement set, the task map, and final
> integration acceptance. Phase-1 implementation target is the child task
> `07-01-dashboard-cf-workers`; phase 2 is `07-01-admin-cf-workers`.

## Goal

将现有两个独立部署的 Next.js 项目 —— `BingZi-233/check-cx`(监控面板, v1.23.2)
与 `BingZi-233/check-cx-admin`(后台管理, v0.2.6) —— 迁移并合并为单个可部署在
Cloudflare Workers 的全栈应用,保持现有功能与数据语义不变。

## Background — 源项目现状(已确认事实)

### check-cx (监控面板)

- 技术栈: Next.js 16.2.6 App Router + React 19 + Supabase(PostgreSQL) + Vercel AI SDK
- 部署: Vercel + Docker standalone Node (`vercel.json`, `Dockerfile`)
- **核心架构**: 常驻后台轮询器 `lib/core/poller.ts`,经 `instrumentation.ts` 在启动时
  初始化,每 ~60s 执行一轮 AI provider 健康检查;通过数据库租约
  `lib/core/poller-leadership.ts` 做多节点选主;另有官方状态轮询器
  `lib/core/official-status-poller.ts`。
- 数据库: 8 张表 —— `check_request_templates`, `check_models`, `check_configs`,
  `check_history`, `group_info`, `admin_users`, `system_notifications`,
  `check_poller_leases`。2 个 RPC 函数 `get_recent_check_history` /
  `prune_check_history`(`lib/database/history.ts`),两者均已带应用层 fallback。
- 健康检查: `lib/providers/ai-sdk-check.ts` 用 Vercel AI SDK 统一 OpenAI/Anthropic/
  Gemini,发送数学挑战题,流式首 token 测延迟,按阈值判定 operational/degraded/failed。
- 密钥: `SUPABASE_SERVICE_ROLE_KEY`(服务端);provider API key 存在 `check_configs.api_key` 列。
- API: 只读输出 `app/api/v1/status/route.ts`, `app/api/dashboard/route.ts`,
  `app/api/notifications/route.ts`, `app/api/group/[groupName]/route.ts`,
  内部 `app/api/internal/cache-metrics/route.ts`。
- 前端: React Server Components 为主,`components/` 含 provider-card、timeline、
  dashboard-view、group 视图等;用 recharts 画图、`@lobehub/icons` 渲染 provider 图标。

### check-cx-admin (后台管理)

- 技术栈: Next.js 16.2.6 App Router + React 19 + Supabase + Base UI/shadcn
- 部署: Docker standalone Node (`Dockerfile`, `docker-compose.yml`)
- 认证: Supabase Auth(OAuth GitHub + password),中间件在 `proxy.ts` →
  `lib/supabase/middleware.ts` 的 `updateSession`。
- 功能: 标准 CRUD admin —— groups / models / configs / templates / history /
  notifications / users / system,均用 Next.js server actions
  (`app/dashboard/*/actions.ts`)。
- 无常驻进程。

## Decisions (用户已确认)

| 维度 | 决策 | 影响 |
|---|---|---|
| 运行形态 | **Workers 全栈**: `@cloudflare/vite-plugin` + React Router v7 + Hono | 两个 Next.js 应用整体重写,非小改 |
| 轮询器 | **Cron 唤醒单例 DO + DO `alarm()` 驱动**: Cron(1min) 唤醒 DO, DO 内部 alarm 维持主轮询(60s)与官方状态轮询(300s)两个循环; DO 天然全局单例 → 废弃 `check_poller_leases` 表与 DB 租约选主 | 核心架构重构; alarm 不受单请求 wall-clock 限制,可分批 |
| 数据库引擎 | **Turso (libSQL)** —— 高频轮询写入场景吞吐更优,多区域读副本,spec 默认 `drizzle-orm/libsql` 路径 | 需 turso.tech 账号;PostgreSQL schema + 2 RPC → SQLite/Drizzle |
| 认证 | **切到 Better Auth** —— 摆脱 Supabase 依赖,契合 spec;一期搭中间件/session 基础设施(dashboard 公开放行),二期 admin 接 Better Auth(email/pw + GitHub OAuth),迁移 admin_users 角色(admin/成员两级) | 二期需重做 admin 登录流 |
| 项目结构 | **合并为单 Workers**,路由分区承载 dashboard + admin | 两项目合并,共享 types/schema |
| 交付范围 | **分两期**: 一期 dashboard 先行,二期 admin | 本父任务对应两个子任务 |

## Confirmed Facts from Project Spec (`.trellis/spec/`)

以下由项目规范锁定,无需再问:

- **DB 驱动**: `drizzle-orm/libsql`(显式 `/http` 或 `/web` driver),
  `drizzle-orm ^0.45.x`, `drizzle-kit ^0.31.x`, `@libsql/client` 注意 unenv 兼容性。
- **认证**: Better Auth(`better-auth ^1.x`, spec 默认, 本任务已确认采用);
  session 表存 Turso, Cache API 缓存 tokenHash;Web Crypto 哈希。
- **密钥/哈希**: 用 Web Crypto `crypto.subtle` + `crypto.getRandomValues`,
  不得在 global scope 调用;token 存哈希不存原文。
- **Session 缓存**: Cloudflare Cache API 模式(`src/lib/session-cache.ts`),
  tokenHash 作 cache key,`waitUntil` 非阻塞写回。
- **Subrequest 上限**: Free 50/请求;长连接(SSE)须在触限前强制重连。
  轮询历史查询要注意避免 N+1 / 循环 await,用 `inArray` + batch。
- **构建**: Vite 6 + `@cloudflare/vite-plugin >= 1.21.0` + React Router v7,
  `compatibility_flags` 含 `nodejs_compat`。
- **时间戳**: Unix 毫秒。
- **Tailwind v4**: shadcn 变量需在 `@theme` 映射 `--color-*`,否则背景透明。

## Requirements

### 跨期(父任务级)

- R-PARENT-1 单个 Workers 应用同时承载 dashboard 与 admin,二者共享同一 D1/Turso
  schema 与 Drizzle 类型层;路由分区不得互相吞没。
- R-PARENT-2 数据库迁移路径可重复执行(dev → prod),不修改已提交的迁移文件;
  历史数据可从 Supabase 一次性导入(脚本,非硬性 P1 验收)。
- R-PARENT-3 密钥处理边界清晰,不得进客户端 bundle、不得进仓库。
  **决策**: provider API key 仍明文存 `check_configs.api_key` 列(与现状一致,
  因 admin 需 UI 动态增删改 key, CF Secrets Store 运行时只读, 不适合)。
  配 3 道防线: ① Turso `DATABASE_AUTH_TOKEN` 只进 CF Secret(`wrangler secret put`),
  不进仓库/`.dev.vars`; ② 轮询器与 DB 层日志全脱敏(sanitize endpoint/token/key,
  沿用 spec `error-logging.md`); ③ 响应序列化白名单 select, `api_key` 字段
  绝不返回客户端。基础设施密钥(Better Auth secret、GitHub OAuth secret、Turso token)
  走 CF Secrets Store / `wrangler secret`。DB 列加密列为二期可选增强,不阻塞一期。
- R-PARENT-4 部署产物可用 `wrangler deploy` 一键部署到 Cloudflare;
  Cron Triggers 与 Durable Object bindings 在 `wrangler.jsonc` 声明。

### 一期 dashboard(子任务 `07-01-dashboard-cf-workers`)

- 见子任务 prd.md(已填充)。

### 二期 admin(子任务 `07-01-admin-cf-workers`)

- 见子任务 prd.md(已填充概要, 二期 planning 时细化)。

## Acceptance Criteria

### 父任务级(跨期)

- [ ] AC-PARENT-1 单个 Workers 部署后,`/`(dashboard)与 `/dashboard/*`(admin)
  路由各自可达,互不串扰;Hono `/api/*` 与前端路由命名空间无冲突。
- [ ] AC-PARENT-2 一键 `wrangler deploy` 成功;Cron + DO bindings 均生效,
  轮询按配置间隔触发,多副本下仅单副本执行(由 DO 保证)。
- [ ] AC-PARENT-3 `pnpm typecheck` + `pnpm lint` 0 错误;`pnpm build` 通过。
- [ ] AC-PARENT-4 数据库迁移可在空库从零建立 schema,并验证 2 个历史 RPC 的
  应用层等价实现返回一致结果。
- [ ] AC-PARENT-5 dashboard 与 admin 共享同一 Drizzle schema 与 types,无重复定义。

### 一期 / 二期

- 见各自子任务 prd.md 的 Acceptance Criteria。

## Out of Scope (本父任务不直接实现,具体由子任务承接)

- 具体的组件级 JSX 搬运、样式细节调优 → 子任务。
- Supabase → libSQL 的历史数据导入脚本 → 一期可选交付。

## Resolved Open Questions (本轮 brainstorm 已决策)

- [x] 数据库引擎: Turso (libSQL),非 D1 —— 高频写入吞吐匹配。
- [x] 认证: 切 Better Auth,不保留 Supabase Auth —— 摆脱 Supabase 依赖。
- [x] provider key 存储: DB 明文 + 3 道防线,不改 CF Secrets Store —— 保 admin 动态管理。
- [x] 轮询器: Cron 唤醒单例 DO + DO alarm 驱动,废弃 DB 租约 —— Workers 原生模型。

## Open Questions (不阻塞一期规划,留待 design.md / 后续)

- (无) 所有阻塞规划的产品/范围/风险决策已收敛。
