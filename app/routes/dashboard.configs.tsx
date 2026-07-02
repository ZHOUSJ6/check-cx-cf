import { Form, useLoaderData, useActionData, useNavigation } from "react-router";
import type { Route } from "./+types/dashboard.configs";
import { PageHeader, AdminLink, AdminTable } from "@/components/admin/page-header";

interface ConfigRow {
  id: string;
  name: string;
  type: string;
  modelId: string;
  endpoint: string;
  enabled: boolean;
  isMaintenance: boolean;
  groupName: string | null;
}

export async function loader({ request }: Route.LoaderArgs): Promise<{ configs: ConfigRow[] }> {
  const origin = new URL(request.url).origin;
  const res = await fetch(`${origin}/api/admin/configs`, {
    headers: { cookie: request.headers.get("cookie") ?? "" },
  });
  if (!res.ok) return { configs: [] };
  const data = (await res.json()) as { configs: ConfigRow[] };
  return { configs: data.configs };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const origin = new URL(request.url).origin;

  if (intent === "batch") {
    const operation = String(formData.get("operation") ?? "");
    const ids = formData.getAll("ids");
    const res = await fetch(`${origin}/api/admin/configs/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: request.headers.get("cookie") ?? "" },
      body: JSON.stringify({ ids, operation }),
    });
    const detail = await res.json().catch(() => ({}));
    return { error: res.ok ? null : (detail as { error?: string }).error, ok: res.ok };
  }
  return { error: "未知操作" };
}

export default function ConfigsPage() {
  const { configs } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const rows = configs.map((c) => [
    <input key="sel" type="checkbox" name="ids" value={c.id} className="h-4 w-4" />,
    <a key="name" href={`/dashboard/configs/${c.id}`} className="font-medium hover:underline">{c.name}</a>,
    <span key="type" className="rounded bg-muted px-1.5 py-0.5 text-xs">{c.type}</span>,
    <span key="group">{c.groupName ?? "—"}</span>,
    <span key="enabled" className={c.enabled ? "text-emerald-500" : "text-muted-foreground"}>{c.enabled ? "启用" : "停用"}</span>,
    <span key="maint" className={c.isMaintenance ? "text-blue-500" : "text-muted-foreground"}>{c.isMaintenance ? "维护中" : "—"}</span>,
    <div key="actions" className="flex gap-2 text-xs">
      <a href={`/dashboard/configs/${c.id}`} className="text-primary hover:underline">编辑</a>
    </div>,
  ]);

  return (
    <div>
      <PageHeader
        title="配置"
        description={`共 ${configs.length} 条`}
        action={<AdminLink href="/dashboard/configs/new">+ 新建配置</AdminLink>}
      />

      {actionData?.error && <p className="mb-4 text-sm text-destructive">{actionData.error}</p>}

      <Form method="post" className="space-y-4">
        <input type="hidden" name="intent" value="batch" />
        {configs.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {[
              { op: "enable", label: "启用" },
              { op: "disable", label: "停用" },
              { op: "maintenance_on", label: "维护开" },
              { op: "maintenance_off", label: "维护关" },
              { op: "delete", label: "删除" },
            ].map((b) => (
              <button
                key={b.op}
                type="submit"
                name="operation"
                value={b.op}
                disabled={navigation.state === "submitting"}
                className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors hover:bg-muted ${
                  b.op === "delete" ? "border-destructive/40 text-destructive" : "border-border/40"
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        )}
        <AdminTable columns={["", "名称", "类型", "分组", "状态", "维护", "操作"]} rows={rows} />
      </Form>
    </div>
  );
}
