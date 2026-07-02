import { useLoaderData, Form, useNavigation } from "react-router";
import type { Route } from "./+types/dashboard.models";
import { PageHeader, AdminLink, AdminTable } from "@/components/admin/page-header";

interface ModelRow { id: string; type: string; model: string; templateId: string | null; }

export async function loader({ request }: Route.LoaderArgs): Promise<{ models: ModelRow[] }> {
  const origin = new URL(request.url).origin;
  const res = await fetch(`${origin}/api/admin/models`, { headers: { cookie: request.headers.get("cookie") ?? "" } });
  if (!res.ok) return { models: [] };
  return { models: ((await res.json()) as { models: ModelRow[] }).models };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const origin = new URL(request.url).origin;
  if (intent === "delete") {
    const id = String(formData.get("id") ?? "");
    await fetch(`${origin}/api/admin/models/${id}`, { method: "DELETE", headers: { cookie: request.headers.get("cookie") ?? "" } });
  }
  return { ok: true };
}

export default function ModelsPage() {
  const { models } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const rows = models.map((m) => [
    m.model,
    <span key="t" className="rounded bg-muted px-1.5 py-0.5 text-xs">{m.type}</span>,
    m.templateId ?? "—",
    <Form key="del" method="post" className="inline">
      <input type="hidden" name="intent" value="delete" /><input type="hidden" name="id" value={m.id} />
      <button type="submit" disabled={navigation.state === "submitting"} className="text-xs text-destructive hover:underline">删除</button>
    </Form>,
  ]);
  return (
    <div>
      <PageHeader title="模型" description={`共 ${models.length} 条`} action={<AdminLink href="/dashboard/models/new">+ 新建模型</AdminLink>} />
      <AdminTable columns={["模型", "类型", "模板", "操作"]} rows={rows} />
    </div>
  );
}
