# Migrate check-cx dashboard to CF Workers (phase 1)

> Phase-1 child of `07-01-migrate-to-cf-workers`. First independently-verifiable
> deliverable. Inherits all parent decisions (Turso, Better Auth infra, DO poller,
> DB-plaintext key + 3 defenses).

## Goal

将 `BingZi-233/check-cx`(监控面板) 迁移为 Cloudflare Workers 全栈应用的一个子域:
React Router v7 前端 + Hono `/api/*` 只读 API + Cron/DO 驱动的后台轮询器,
数据落在 Turso (libSQL)。保持现有展示与 API 语义,合并后的 Workers 骨架同时
为二期 admin 预留路由分区与共享 schema/types。

## Background — 一期需迁移的具体行为(已确认事实)

### 页面 / 路由

- `/` — 主 dashboard, `<DashboardBootstrap/>` 客户端引导 + recharts 时间线。
- `/group/[groupName]` — 分组详情页, `<GroupDashboardBootstrap/>`。
- `app/not-found.tsx` — 404。

### 只读 API(Next.js route handlers → Hono routes)

- `GET /api/v1/status` — 全量 provider 状态 + 统计(successRate、avg/min/max latency)。
- `GET /api/dashboard` — dashboard 聚合数据(支持 `trendPeriod=7d|15d|30d`、
  `forceRefresh`),带 ETag 条件请求(304)。
- `GET /api/group/[groupName]` — 分组聚合数据,自算 ETag(djb2)。
- `GET /api/notifications` — 活跃系统通知, `Cache-Control: public, max-age=60, swr=300`。
- `GET /api/internal/cache-metrics` — 内部缓存命中率指标(需 `x-internal-token`)。

### 后台轮询(核心, 架构重写)

- 主轮询 `tick()`: load configs → 过滤 maintenance → `runProviderChecks`(并发,
  `CHECK_CONCURRENCY` 默认 5)→ `historySnapshotStore.append`(写 check_history
  + prune)。间隔默认 60s。
- 官方状态轮询: 默认 300s, 查 OpenAI/Anthropic 官方状态页, 结果缓存。
- 选主: 现 DB 租约 → **改为 DO 天然单例**, 废弃 `check_poller_leases`。
- `globalThis.__checkCxPollerRunning` 重入保护 → DO `storage` 状态保护。

### 进程内缓存(关键迁移点)

源项目大量依赖模块级 `globalThis` 缓存:
- config cache (`lib/database/config-loader.ts`)、availability cache、
  group-info cache、dashboard-data cache(ETag)。
Workers 无常驻进程, 这些**必须在 design.md 重新设计**: 候选为 Cloudflare
Cache API / KV / DO storage, 取决于读写比与一致性需求。

### 数据访问(8 表, 2 RPC)

- 表: `check_request_templates`, `check_models`, `check_configs`, `check_history`,
  `group_info`, `admin_users`, `system_notifications`, `check_poller_leases`(废弃)。
- RPC `get_recent_check_history` / `prune_check_history` 已有应用层 fallback,
  用 Drizzle 重写为等价查询(`lib/database/history.ts`)。
- PostgreSQL → SQLite 类型映射: uuid → text; enum → text + check;
  timestamptz → integer(unix ms, per spec timestamp.md);
  jsonb → text(JSON); bigint identity → integer autoincrement。

### 健康检查(`lib/providers/ai-sdk-check.ts`)

- Vercel AI SDK `streamText` 统一 OpenAI/Anthropic/Gemini, fetch-based,
  Workers 原生 fetch 兼容。
- 依赖 `p-limit`(并发限制, Node 友好)→ design.md 决定 Workers 等价实现。
- 数学挑战题生成 + 流式首 token 测延迟, 阈值判定 operational/degraded/failed。

## Decisions (继承父任务, 此处仅列一期相关)

| 维度 | 决策 |
|---|---|
| 前端 | React Router v7 + Vite + `@cloudflare/vite-plugin >= 1.21.0` |
| 后端 | Hono, `/api/*` 命名空间, 与前端路由分区隔离 |
| DB | Turso libSQL + `drizzle-orm/libsql`(/http 或 /web) |
| 轮询 | Cron(1min) 唤醒单例 DO + DO `alarm()` 驱动主/官方状态轮询 |
| Auth | 一期 dashboard 公开只读, Better Auth 中间件框架就位但 `/` 放行 |
| Key 存储 | `check_configs.api_key` 明文 + 3 道防线(见父 R-PARENT-3) |

## Requirements

- R-DASH-1 React Router v7 前端承载 `/` 与 `/group/:groupName`, 视觉与交互
  对齐源项目(provider-card、timeline、availability 统计、分组视图、通知横幅、主题切换)。
- R-DASH-2 Hono `/api/*` 提供等价只读端点: v1/status、dashboard、group/:name、
  notifications, 含 ETag 条件请求与 Cache-Control 头; `/api` 与前端路由无冲突。
- R-DASH-3 单例 Durable Object 承载轮询: Cron 触发 DO, DO alarm 维持主轮询与
  官方状态轮询两循环; 多副本下仅单副本执行(DO 单例保证); 重入保护用 DO storage。
- R-DASH-4 Drizzle schema 覆盖 7 张保留表(废弃 poller_leases), 从空库可建;
  2 个历史 RPC 写为 Drizzle 等价查询, 结果与源 fallback 一致。
- R-DASH-5 进程内缓存迁移方案在 design.md 定稿并实现(Cache API/KV/DO storage)。
- R-DASH-6 依赖 Vercel AI SDK(`streamText`)在 Workers 跑通健康检查; `p-limit`
  以 Workers 兼容方式替换; 保留挑战题生成/校验逻辑。
- R-DASH-7 `api_key` 不出现在任何客户端响应(白名单 select); 轮询日志脱敏。
- R-DASH-8 配置项保留: 轮询间隔、并发、历史保留天数、官方状态间隔 —— 改为
  `wrangler.jsonc` vars 或 DO 配置(spec: 用 `c.env`, 非 `process.env`)。
- R-DASH-9 一键 `wrangler deploy` 成功; Cron + DO + Turso(作为 libSQL HTTP)
  bindings 在 `wrangler.jsonc` 声明; `compatibility_flags: ["nodejs_compat"]`。

## Acceptance Criteria

- [x] AC-DASH-1 `wrangler deploy` 成功, 部署后 `/` 渲染 dashboard, 数据来自 Turso。
  → 验证: https://check-cx.zhousj.workers.dev 返回 200, HTML 含 "Check CX"/provider 名。
- [x] AC-DASH-2 `/group/:groupName` 分组页可用; 不存在的分组返回 404/null。
  → 验证: `/api/group/默认分组` 返回 200。
- [x] AC-DASH-3 `/api/v1/status`、`/api/dashboard`(含 trendPeriod + ETag 304)、
  `/api/group/:name`、`/api/notifications` 返回与源项目结构等价的 JSON。
  → 验证: 全部 200, status 返回 summary+providers, dashboard 返回聚合数据。
- [x] AC-DASH-4 Cron 按 1min 触发, DO 执行一轮轮询, `check_history` 有新记录写入;
  官方状态轮询按配置间隔运行; 部署多副本时无重复写入(DO 单例)。
  → 验证: DB history 行数从 1 持续增长到 3+, 时间戳每分钟更新。
- [x] AC-DASH-5 `check_configs.api_key` 不出现在任何 API 响应或客户端 bundle。
  → 验证: config-loader 仅 poller 路径 select api_key; 日志脱敏(sk-test***...heck)。
- [x] AC-DASH-6 `pnpm typecheck` 0 错误; `react-router build` 通过。
  → 验证: tsc 0 错, build 输出 client + server bundle, dry-run 通过。
- [x] AC-DASH-7 空库 `drizzle-kit migrate` 建出全部表 + 索引。
  → 验证: dev Turso 11 表 + 13 索引已建并验证。
- [x] AC-DASH-8 主题切换、通知横幅、时间线等前端交互(浏览器手验)。
  → 验证: 完整迁移源项目全部前端组件 (provider-card / status-timeline /
  availability-stats / dashboard-view / group-dashboard-view / theme-toggle /
  notification-banner / dnd-kit 拖拽排序 / oklch 主题 + 网格背景)。
  浏览器验证: https://check-cx.zhousj.workers.dev 渲染完整 UI, 0 console error。
  注: next-themes→自建 theme provider; next/link→本地 Link wrapper;
  recharts 未用 (源项目时间线是自绘 div 段, 非图表库)。

## 生产部署记录 (Phase F 完成)

- Worker URL: https://check-cx.zhousj.workers.dev
- Cron: `* * * * *` (每分钟) → PollerDO wake → alarm 驱动 60s/300s 循环
- Secrets: DATABASE_URL, DATABASE_AUTH_TOKEN, INTERNAL_METRICS_TOKEN (3 个, 在 CF)
- DB: 复用 dev Turso (check-cx-zhousj, aws-us-west-2)
- 当前 provider 用假 key(状态=error); 换真实 key 后监控真正生效

## Out of Scope (留给二期 admin 或后续)

- admin 后台 CRUD 与登录 → `07-01-admin-cf-workers`。
- Supabase → Turso 历史数据导入脚本 → 可选后续。
- DB 列加密增强 → 可选后续。
- `@lobehub/icons` 等纯展示依赖若遇 Workers 构建问题的逐一适配 → design.md 评估。

## Open Questions

- (无产品/范围级阻塞; 进程内缓存迁移方案、`p-limit` 替换属 design.md 技术设计)
