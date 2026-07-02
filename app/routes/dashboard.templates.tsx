import { useLoaderData, Form, useNavigation } from "react-router";
import type { Route } from "./+types/dashboard.templates";
import { PageHeader, AdminLink, AdminTable } from "@/components/admin/page-header";

interface TemplateRow { id: string; name: string; type: string; }
export async function loader({ request }: Route.LoaderArgs): Promise<{ templates: TemplateRow[] }> {
  const origin = new URL(request.url).origin;
  const res = await fetch(`${origin}/api/admin/templates`, { headers: { cookie: request.headers.get("cookie") ?? "" } });
  if (!res.ok) return { templates: [] };
  return { templates: ((await res.json()) as { templates: TemplateRow[] }).templates };
}
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  if (String(formData.get("intent")) === "delete") {
    const origin = new URL(request.url).origin;
    await fetch(`${origin}/api/admin/templates/${String(formData.get("id"))}`, { method: "DELETE", headers: { cookie: request.headers.get("cookie") ?? "" } });
  }
  return { ok: true };
}
export default function TemplatesPage() {
  const { templates } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const rows = templates.map((t) => [t.name, <span key="t" className="rounded bg-muted px-1.5 py-0.5 text-xs">{t.type}</span>, <a key="e" href={`/dashboard/templates/${t.id}`} className="text-xs text-primary hover:underline">编辑</a>, <Form key="d" method="post" className="inline"><input type="hidden" name="intent" value="delete" /><input type="hidden" name="id" value={t.id} /><button disabled={navigation.state === "submitting"} className="text-xs text-destructive hover:underline">删除</button></Form>]);
  return <div><PageHeader title="模板" description={`共 ${templates.length} 条`} action={<AdminLink href="/dashboard/templates/new">+ 新建模板</AdminLink>} /><AdminTable columns={["名称", "类型", "", "操作"]} rows={rows} /></div>;
}
