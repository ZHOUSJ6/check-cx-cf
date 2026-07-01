import { useLoaderData } from "react-router";
import { env } from "cloudflare:workers";
import type { Route } from "./+types/_index";

import { createDb } from "#/db/client";
import { loadDashboardDataWithEtag } from "#/core/dashboard-data";
import { getOfficialStatusFromDO } from "#/api/do-helper";
import type { DashboardData } from "#/types";

export async function loader(): Promise<DashboardData | null> {
  const db = createDb(env);
  const officialStatusMap = await getOfficialStatusFromDO(env);
  // In SSR loaders there's no ExecutionContext for waitUntil; cache writeback
  // is best-effort via a no-op shim (the DO-backed API path handles fresh writes).
  const ctx = { waitUntil: () => {} };
  try {
    const { data } = await loadDashboardDataWithEtag(
      db,
      { env, ctx, officialStatusByType: officialStatusMap ?? undefined },
      { refreshMode: "never" },
    );
    return data;
  } catch (error) {
    console.error("[check-cx] dashboard loader failed", error);
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

export default function Index() {
  const data = useLoaderData<typeof loader>();

  if (!data) {
    return (
      <main className="mx-auto max-w-4xl p-8">
        <p className="text-muted-foreground">
          暂无数据，请检查数据库配置或等待首次轮询。
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-8">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Check CX</h1>
          <p className="text-sm text-muted-foreground">
            AI 模型服务健康监控 · 轮询间隔 {data.pollIntervalLabel}
          </p>
        </div>
        {data.lastUpdated && (
          <p className="text-xs text-muted-foreground">
            更新于 {new Date(data.lastUpdated).toLocaleString("zh-CN")}
          </p>
        )}
      </header>

      {data.providerTimelines.length === 0 ? (
        <p className="text-muted-foreground">尚未检测到任何 Provider 配置。</p>
      ) : (
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
                <p className="mt-1 text-xs text-muted-foreground">
                  延迟 {latest.latencyMs ? `${latest.latencyMs}ms` : "N/A"} · Ping{" "}
                  {latest.pingLatencyMs ? `${latest.pingLatencyMs}ms` : "N/A"}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
