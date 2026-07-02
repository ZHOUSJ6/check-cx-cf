import { Form, useNavigation, redirect } from "react-router";
import type { Route } from "./+types/dashboard.groups_.new";
import { PageHeader } from "@/components/admin/page-header";
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const payload = { groupName: String(formData.get("groupName") ?? ""), websiteUrl: String(formData.get("websiteUrl") ?? "").trim() || null, tags: String(formData.get("tags") ?? "") };
  const origin = new URL(request.url).origin;
  const res = await fetch(`${origin}/api/admin/groups`, { method: "POST", headers: { "Content-Type": "application/json", cookie: request.headers.get("cookie") ?? "" }, body: JSON.stringify(payload) });
  if (!res.ok) { const d = await res.json().catch(() => ({})); return { error: (d as { error?: string }).error ?? "创建失败" }; }
  throw redirect("/dashboard/groups");
}
export default function NewGroupPage() {
  const navigation = useNavigation();
  return <div className="max-w-md"><PageHeader title="新建分组" /><Form method="post" className="space-y-4">
    <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">分组名称 *</label><input name="groupName" required className="h-9 w-full rounded-md border border-input bg-input/20 px-3 text-sm" /></div>
    <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">网站</label><input name="websiteUrl" className="h-9 w-full rounded-md border border-input bg-input/20 px-3 text-sm" /></div>
    <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">标签（逗号分隔）</label><input name="tags" className="h-9 w-full rounded-md border border-input bg-input/20 px-3 text-sm" /></div>
    <button type="submit" disabled={navigation.state === "submitting"} className="h-9 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/80">创建</button><a href="/dashboard/groups" className="ml-2 text-sm text-muted-foreground hover:text-foreground">取消</a>
  </Form></div>;
}
