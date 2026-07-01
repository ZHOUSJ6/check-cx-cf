import { useLoaderData } from "react-router";
import { env } from "cloudflare:workers";
import type { Route } from "./+types/group.$groupName";

import { createDb } from "#/db/client";
import { loadGroupDashboardData, type GroupDashboardData } from "#/core/group-data";
import { getOfficialStatusFromDO } from "#/api/do-helper";

export async function loader({
  params,
}: Route.LoaderArgs): Promise<GroupDashboardData | null> {
  const groupName = params.groupName;
  if (!groupName) return null;

  const db = createDb(env);
  const officialStatusMap = await getOfficialStatusFromDO(env);
  const ctx = { waitUntil: () => {} };
  try {
    const result = await loadGroupDashboardData(
      db,
      decodeURIComponent(groupName),
      { env, ctx, officialStatusByType: officialStatusMap ?? undefined },
      { refreshMode: "never" },
    );
    return result?.data ?? null;
  } catch (error) {
    console.error("[check-cx] group loader failed", error);
    return null;
  }
}

const STATUS_COLORS: Record<string, string> = {
  operational: "text-emerald-500",
  degraded: "text-amber-500",
  failed: "text-red-500",
  validation_failed: "text-orange-500",
  error: "text-red-500",
  maintenance: "text-blue-500",
};

const STATUS_LABELS: Record<string, string> = {
  operational: "正常",
  degraded: "降级",
  failed: "故障",
  validation_failed: "验证失败",
  error: "错误",
  maintenance: "维护中",
};

export default function GroupPage() {
  const data = useLoaderData<typeof loader>();

  if (!data) {
    return (
      <main className="mx-auto max-w-4xl p-8">
        <p className="text-muted-foreground">分组不存在或暂无配置。</p>
        <a href="/" className="text-primary underline">
          返回首页
        </a>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-8">
      <header className="mb-8">
        <a
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← 返回
        </a>
        <h1 className="mt-2 text-2xl font-bold">{data.displayName}</h1>
        {data.websiteUrl && (
          <a
            href={data.websiteUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-primary underline"
          >
            官网
          </a>
        )}
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.providerTimelines.map((timeline) => {
          const latest = timeline.latest;
          const color = STATUS_COLORS[latest.status] ?? "text-muted-foreground";
          const label = STATUS_LABELS[latest.status] ?? latest.status;
          return (
            <article
              key={timeline.id}
              className="rounded-lg border border-border bg-card p-4 shadow-sm"
            >
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-semibold">{latest.name}</h2>
                <span className={`text-sm font-medium ${color}`}>{label}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {latest.type} / {latest.model}
              </p>
              <p className="mt-2 text-sm">{latest.message}</p>
            </article>
          );
        })}
      </div>
    </main>
  );
}
