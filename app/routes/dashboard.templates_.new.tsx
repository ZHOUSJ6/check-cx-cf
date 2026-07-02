import { Form, useNavigation, redirect } from "react-router";
import type { Route } from "./+types/dashboard.templates_.new";
import { PageHeader } from "@/components/admin/page-header";

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const payload = {
    name: String(formData.get("name") ?? ""),
    type: String(formData.get("type") ?? ""),
    requestHeader: formData.get("requestHeader") ? JSON.parse(String(formData.get("requestHeader"))) : null,
    metadata: formData.get("metadata") ? JSON.parse(String(formData.get("metadata"))) : null,
  };
  const origin = new URL(request.url).origin;
  const res = await fetch(`${origin}/api/admin/templates`, { method: "POST", headers: { "Content-Type": "application/json", cookie: request.headers.get("cookie") ?? "" }, body: JSON.stringify(payload) });
  if (!res.ok) { const d = await res.json().catch(() => ({})); return { error: (d as { error?: string }).error ?? "创建失败" }; }
  throw redirect("/dashboard/templates");
}
export default function NewTemplatePage() {
  const navigation = useNavigation();
  return (
    <div className="max-w-md"><PageHeader title="新建模板" />
      <Form method="post" className="space-y-4">
        <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">名称 *</label><input name="name" required className="h-9 w-full rounded-md border border-input bg-input/20 px-3 text-sm" /></div>
        <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">类型 *</label><select name="type" className="h-9 w-full rounded-md border border-input bg-input/20 px-3 text-sm"><option value="openai">openai</option><option value="gemini">gemini</option><option value="anthropic">anthropic</option></select></div>
        <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">请求头 (JSON)</label><textarea name="requestHeader" rows={3} className="w-full rounded-md border border-input bg-input/20 px-3 py-2 text-sm" placeholder='{"Authorization": "Bearer ..."}' /></div>
        <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">metadata (JSON)</label><textarea name="metadata" rows={3} className="w-full rounded-md border border-input bg-input/20 px-3 py-2 text-sm" /></div>
        <button type="submit" disabled={navigation.state === "submitting"} className="h-9 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/80">创建</button>
        <a href="/dashboard/templates" className="ml-2 text-sm text-muted-foreground hover:text-foreground">取消</a>
      </Form>
    </div>
  );
}
