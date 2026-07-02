import { useLoaderData, Form, useNavigation } from "react-router";
import type { Route } from "./+types/dashboard.system";
import { PageHeader } from "@/components/admin/page-header";
interface SystemStats { counts: Record<string, number>; latestCheckAt: string | null; }
export async function loader({ request }: Route.LoaderArgs): Promise<{ stats: SystemStats | null }> {
  const origin = new URL(request.url).origin;
  const res = await fetch(`${origin}/api/admin/system`, { headers: { cookie: request.headers.get("cookie") ?? "" } });
  if (!res.ok) return { stats: null };
  return { stats: (await res.json()) as SystemStats };
}
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  if (String(formData.get("intent")) === "reset-cache") {
    const origin = new URL(request.url).origin;
    await fetch(`${origin}/api/admin/system/reset-cache`, { method: "POST", headers: { cookie: request.headers.get("cookie") ?? "" } });
  }
  return { ok: true };
}
export default function SystemPage() {
  const { stats } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  return <div><PageHeader title="系统" description="缓存与统计" />
    {!stats ? <p className="text-muted-foreground">无法加载（需要管理员权限）</p> : (
      <div className="space-y-6">
        <div className="rounded-lg border border-border/40 p-4">
          <h2 className="mb-3 text-sm font-semibold">缓存</h2>
          <Form method="post"><input type="hidden" name="intent" value="reset-cache" />
            <button type="submit" disabled={navigation.state === "submitting"} className="h-9 rounded-md border border-border/40 px-4 text-sm hover:bg-muted">重置缓存计数器</button>
          </Form>
        </div>
        <div className="rounded-lg border border-border/40 p-4">
          <h2 className="mb-3 text-sm font-semibold">数据统计</h2>
          <pre className="text-xs">{JSON.stringify(stats, null, 2)}</pre>
        </div>
      </div>
    )}
  </div>;
}
