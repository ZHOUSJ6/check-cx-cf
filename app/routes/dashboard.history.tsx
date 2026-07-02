import { useLoaderData, Form, useNavigation } from "react-router";
import type { Route } from "./+types/dashboard.history";
import { PageHeader, AdminTable } from "@/components/admin/page-header";
interface HistoryRow { id: number; configId: string; status: string; latencyMs: number | null; pingLatencyMs: number | null; checkedAt: string; message: string | null; configName: string; groupName: string | null; }
export async function loader({ request }: Route.LoaderArgs): Promise<{ history: HistoryRow[] }> {
  const origin = new URL(request.url).origin;
  const res = await fetch(`${origin}/api/admin/history?limit=200`, { headers: { cookie: request.headers.get("cookie") ?? "" } });
  if (!res.ok) return { history: [] };
  return { history: ((await res.json()) as { history: HistoryRow[] }).history };
}
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  if (String(formData.get("intent")) === "clear") {
    const origin = new URL(request.url).origin;
    await fetch(`${origin}/api/admin/history/clear`, { method: "POST", headers: { "Content-Type": "application/json", cookie: request.headers.get("cookie") ?? "" }, body: JSON.stringify({ days: Number(formData.get("days") ?? 30) }) });
  }
  return { ok: true };
}
export default function HistoryPage() {
  const { history } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const rows = history.map((h) => [h.configName, <span key="s" className="text-xs">{h.status}</span>, h.latencyMs != null ? `${h.latencyMs}ms` : "—", new Date(h.checkedAt).toLocaleString("zh-CN"), h.message ?? "—"]);
  return <div><PageHeader title="历史记录" description={`共 ${history.length} 条`}
    action={<Form method="post" className="inline-flex items-center gap-2"><input type="hidden" name="intent" value="clear" /><input name="days" type="number" defaultValue={30} className="h-9 w-16 rounded-md border border-input bg-input/20 px-2 text-sm" /><button type="submit" disabled={navigation.state === "submitting"} className="h-9 rounded-md border border-destructive/40 px-3 text-xs text-destructive hover:bg-destructive/10">清理(天)</button></Form>} />
    <AdminTable columns={["配置", "状态", "延迟", "时间", "消息"]} rows={rows} /></div>;
}
