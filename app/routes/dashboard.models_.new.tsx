import { Form, useNavigation, redirect, useLoaderData } from "react-router";
import type { Route } from "./+types/dashboard.models_.new";
import { PageHeader } from "@/components/admin/page-header";

interface TemplateRow { id: string; name: string; type: string; }
export async function loader({ request }: Route.LoaderArgs): Promise<{ templates: TemplateRow[] }> {
  const origin = new URL(request.url).origin;
  const res = await fetch(`${origin}/api/admin/templates`, { headers: { cookie: request.headers.get("cookie") ?? "" } });
  if (!res.ok) return { templates: [] };
  return { templates: ((await res.json()) as { templates: TemplateRow[] }).templates };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const payload = {
    type: String(formData.get("type") ?? ""),
    model: String(formData.get("model") ?? ""),
    templateId: String(formData.get("templateId") ?? "").trim() || null,
  };
  const origin = new URL(request.url).origin;
  const res = await fetch(`${origin}/api/admin/models`, {
    method: "POST", headers: { "Content-Type": "application/json", cookie: request.headers.get("cookie") ?? "" }, body: JSON.stringify(payload),
  });
  if (!res.ok) { const d = await res.json().catch(() => ({})); return { error: (d as { error?: string }).error ?? "创建失败" }; }
  throw redirect("/dashboard/models");
}

export default function NewModelPage() {
  const { templates } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  return (
    <div className="max-w-md">
      <PageHeader title="新建模型" />
      <Form method="post" className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">类型 *</label>
          <select name="type" className="h-9 w-full rounded-md border border-input bg-input/20 px-3 text-sm">
            <option value="openai">openai</option><option value="gemini">gemini</option><option value="anthropic">anthropic</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">模型名 *</label>
          <input name="model" required className="h-9 w-full rounded-md border border-input bg-input/20 px-3 text-sm" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">模板（可选）</label>
          <select name="templateId" className="h-9 w-full rounded-md border border-input bg-input/20 px-3 text-sm">
            <option value="">无</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.type})</option>)}
          </select>
        </div>
        <button type="submit" disabled={navigation.state === "submitting"} className="h-9 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/80">创建</button>
        <a href="/dashboard/models" className="ml-2 text-sm text-muted-foreground hover:text-foreground">取消</a>
      </Form>
    </div>
  );
}
