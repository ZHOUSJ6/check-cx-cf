import { useLoaderData } from "react-router";
import type { Route } from "./+types/dashboard._index";
import { PageHeader } from "@/components/admin/page-header";

interface SystemStats {
  counts: {
    configs: number;
    models: number;
    templates: number;
    groups: number;
    notifications: number;
    users: number;
    history: number;
  };
  latestCheckAt: string | null;
}

export async function loader({ request }: Route.LoaderArgs): Promise<{ stats: SystemStats | null }> {
  const origin = new URL(request.url).origin;
  const res = await fetch(`${origin}/api/admin/system`, {
    headers: { cookie: request.headers.get("cookie") ?? "" },
  });
  if (!res.ok) return { stats: null };
  return { stats: (await res.json()) as SystemStats };
}

export default function DashboardIndex() {
  const { stats } = useLoaderData<typeof loader>();

  return (
    <div>
      <PageHeader title="概览" description="系统统计数据" />
      {!stats ? (
        <p className="text-muted-foreground">无法加载统计数据（需要管理员权限）。</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: "配置", value: stats.counts.configs, href: "/dashboard/configs" },
            { label: "模型", value: stats.counts.models, href: "/dashboard/models" },
            { label: "模板", value: stats.counts.templates, href: "/dashboard/templates" },
            { label: "分组", value: stats.counts.groups, href: "/dashboard/groups" },
            { label: "历史记录", value: stats.counts.history, href: "/dashboard/history" },
            { label: "通知", value: stats.counts.notifications, href: "/dashboard/notifications" },
            { label: "用户", value: stats.counts.users, href: "/dashboard/users" },
            { label: "最近检查", value: stats.latestCheckAt ? new Date(stats.latestCheckAt).toLocaleString("zh-CN") : "—", href: "/dashboard/system" },
          ].map((card) => (
            <a
              key={card.label}
              href={card.href}
              className="rounded-xl border border-border/40 bg-card p-4 transition-colors hover:border-primary/30"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{card.label}</p>
              <p className="mt-2 text-lg font-bold">{card.value}</p>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
