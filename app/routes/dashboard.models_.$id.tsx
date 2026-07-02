import { useLoaderData, Form, redirect } from "react-router";
import type { Route } from "./+types/dashboard.models_.$id";
import { PageHeader } from "@/components/admin/page-header";

interface ModelRow { id: string; type: string; model: string; templateId: string | null; }

export async function loader({ request, params }: Route.LoaderArgs): Promise<{ model: ModelRow | null }> {
  const origin = new URL(request.url).origin;
  const res = await fetch(`${origin}/api/admin/models`, { headers: { cookie: request.headers.get("cookie") ?? "" } });
  if (!res.ok) return { model: null };
  const models = ((await res.json()) as { models: ModelRow[] }).models;
  return { model: models.find((m) => m.id === params.id) ?? null };
}

export async function action({ request, params }: Route.ActionArgs) {
  const formData = await request.formData();
  const payload = { model: String(formData.get("model") ?? "") };
  const origin = new URL(request.url).origin;
  await fetch(`${origin}/api/admin/models/${params.id}`, { method: "PUT", headers: { "Content-Type": "application/json", cookie: request.headers.get("cookie") ?? "" }, body: JSON.stringify(payload) });
  throw redirect("/dashboard/models");
}

export default function EditModelPage() {
  const { model } = useLoaderData<typeof loader>();
  if (!model) return <div><PageHeader title="模型不存在" /><a href="/dashboard/models" className="text-sm text-primary hover:underline">返回</a></div>;
  return (
    <div className="max-w-md">
      <PageHeader title="编辑模型" />
      <Form method="post" className="space-y-4">
        <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">类型</label><p className="text-sm">{model.type}</p></div>
        <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">模型名</label><input name="model" defaultValue={model.model} className="h-9 w-full rounded-md border border-input bg-input/20 px-3 text-sm" /></div>
        <button type="submit" className="h-9 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/80">保存</button>
        <a href="/dashboard/models" className="ml-2 text-sm text-muted-foreground hover:text-foreground">取消</a>
      </Form>
    </div>
  );
}
