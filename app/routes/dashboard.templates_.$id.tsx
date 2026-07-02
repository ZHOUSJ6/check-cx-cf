import { useLoaderData, Form, redirect } from "react-router";
import type { Route } from "./+types/dashboard.templates_.$id";
import { PageHeader } from "@/components/admin/page-header";
interface TemplateRow { id: string; name: string; type: string; websiteUrl?: string | null; tags?: string; }
export async function loader({ request, params }: Route.LoaderArgs): Promise<{ template: TemplateRow | null }> {
  const origin = new URL(request.url).origin;
  const res = await fetch(`${origin}/api/admin/templates`, { headers: { cookie: request.headers.get("cookie") ?? "" } });
  if (!res.ok) return { template: null };
  const all = ((await res.json()) as { templates: TemplateRow[] }).templates;
  return { template: all.find((t) => t.id === params.id) ?? null };
}
export async function action({ request, params }: Route.ActionArgs) {
  const formData = await request.formData();
  const origin = new URL(request.url).origin;
  await fetch(`${origin}/api/admin/templates/${params.id}`, { method: "PUT", headers: { "Content-Type": "application/json", cookie: request.headers.get("cookie") ?? "" }, body: JSON.stringify({ name: String(formData.get("name")) }) });
  throw redirect("/dashboard/templates");
}
export default function EditTemplatePage() {
  const { template } = useLoaderData<typeof loader>();
  if (!template) return <div><PageHeader title="模板不存在" /><a href="/dashboard/templates" className="text-sm text-primary hover:underline">返回</a></div>;
  return <div className="max-w-md"><PageHeader title="编辑模板" /><Form method="post" className="space-y-4"><div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">名称</label><input name="name" defaultValue={template.name} className="h-9 w-full rounded-md border border-input bg-input/20 px-3 text-sm" /></div><button type="submit" className="h-9 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/80">保存</button><a href="/dashboard/templates" className="ml-2 text-sm text-muted-foreground hover:text-foreground">取消</a></Form></div>;
}
