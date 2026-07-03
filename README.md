# Check CX

AI 模型服务健康监控面板 —— 实时追踪 OpenAI、Gemini、Anthropic 等对话接口的可用性、延迟与错误信息。

基于 Cloudflare Workers 全栈构建，前端 React Router v8 + TailwindCSS + shadcn/ui，后端 Hono + Drizzle ORM + Turso (libSQL)。

## 功能

### 监控面板（Dashboard）

- 统一的 Provider 健康检查（OpenAI / Gemini / Anthropic），支持 Chat Completions 与 Responses 端点
- 实时延迟、Ping 延迟与历史时间线，支持 7/15/30 天可用性统计
- 分组视图与分组详情页，支持分组标签与官网链接
- 维护模式与系统通知横幅（支持 Markdown，多条轮播）
- 官方状态轮询（OpenAI 与 Anthropic）
- 暗色 / 亮色 / 跟随系统主题切换
- 分组拖拽排序、搜索、标签筛选

### 后台管理（Admin）

- Better Auth 认证（email/password + GitHub OAuth）
- 两级权限：管理员（全部分组） / 成员（所属分组）
- Provider 配置 CRUD + 批量操作（启用/停用/维护/换模型/换密钥/换地址/换名称/清理历史/删除）
- 模型配置 CRUD（模板绑定、引用计数、未引用清理）
- 请求模板 CRUD（请求头与 metadata 复用）
- 分组信息 CRUD
- 系统通知 CRUD（Markdown、激活/隐藏切换）
- 用户管理（邀请、停用）
- 历史记录查看与清理
- 系统统计与缓存重置

## 技术栈

| 层 | 技术 |
|---|---|
| 运行时 | Cloudflare Workers |
| 前端 | React Router v8 + Vite + TailwindCSS v4 + shadcn/ui |
| 后端 | Hono |
| 数据库 | Turso (libSQL) + Drizzle ORM |
| 认证 | Better Auth (email/password + GitHub OAuth) |
| 轮询 | Durable Objects (alarm 驱动) + Cron Triggers |
| 缓存 | Cloudflare Cache API |
| 部署 | Wrangler |

## 架构

```
Cron (1/min) → PollerDO (Durable Object, singleton)
                     ↓ alarm()
              主轮询 (60s)  +  官方状态轮询 (300s)
                     ↓
              Vercel AI SDK streamText → 写入 check_history
                     ↓
              Turso (libSQL) ← Dashboard 读取

HTTP → Hono /api/* (公开只读 + admin CRUD + auth)
     → React Router v8 SSR (/ + /group/* + /dashboard/*)
```

## 快速开始

### 前置要求

- Node.js >= 20
- pnpm >= 9
- Cloudflare 账号
- Turso 账号

### 安装

```bash
pnpm install
```

### 配置环境变量

```bash
cp .env.example .dev.vars
```

填写以下变量：

| 变量 | 说明 |
|---|---|
| `DATABASE_URL` | Turso 数据库地址 (`libsql://...`) |
| `DATABASE_AUTH_TOKEN` | Turso 访问令牌 |
| `BETTER_AUTH_SECRET` | Better Auth 加密密钥 |
| `BETTER_AUTH_URL` | 部署 URL |
| `GITHUB_CLIENT_ID` | GitHub OAuth App Client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App Client Secret |
| `ADMIN_EMAILS` | 初始管理员邮箱（逗号分隔） |
| `INTERNAL_METRICS_TOKEN` | 内部指标端点访问令牌 |

### 数据库初始化

```bash
pnpm db:generate   # 生成迁移
pnpm db:migrate    # 应用迁移到 Turso
```

### 本地开发

```bash
pnpm dev
```

### 生产部署

```bash
pnpm deploy
```

自定义域名在 `wrangler.jsonc` 的 `routes` 字段配置。

## 项目结构

```
├── workers/app.ts          # Worker 入口（fetch + scheduled）
├── src/
│   ├── auth.ts             # Better Auth 配置
│   ├── api/                # Hono API 路由
│   │   ├── admin/          # 后台 CRUD (8 个域)
│   │   └── ...             # 公开只读 API
│   ├── core/               # 轮询、缓存、聚合
│   ├── do/                 # Durable Object (PollerDO)
│   ├── db/                 # Drizzle schema + 查询
│   └── providers/          # AI SDK 健康检查
├── app/
│   ├── routes/             # React Router 路由
│   ├── pages/              # 页面组件
│   ├── components/         # UI 组件
│   └── lib/                # 前端工具函数
├── drizzle/                # 数据库迁移文件
└── wrangler.jsonc          # Cloudflare Workers 配置
```

## License

[MIT](LICENSE)
