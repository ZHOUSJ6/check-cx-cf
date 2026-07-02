import { Form, useNavigation, redirect } from "react-router";
import type { Route } from "./+types/dashboard.notifications_.new";
import { PageHeader } from "@/components/admin/page-header";
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const payload = { message: String(formData.get("message") ?? ""), level: String(formData.get("level") ?? "info"), isActive: formData.get("isActive") === "on" };
  const origin = new URL(request.url).origin;
  const res = await fetch(`${origin}/api/admin/notifications`, { method: "POST", headers: { "Content-Type": "application/json", cookie: request.headers.get("cookie") ?? "" }, body: JSON.stringify(payload) });
  if (!res.ok) { const d = await res.json().catch(() => ({})); return { error: (d as { error?: string }).error ?? "创建失败" }; }
  throw redirect("/dashboard/notifications");
}
export default function NewNotificationPage() {
  const navigation = useNavigation();
  return <div className="max-w-lg"><PageHeader title="新建通知" /><Form method="post" className="space-y-4">
    <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">内容 (支持 Markdown) *</label><textarea name="message" required rows={4} className="w-full rounded-md border border-input bg-input/20 px-3 py-2 text-sm" /></div>
    <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">级别</label><select name="level" className="h-9 w-full rounded-md border border-input bg-input/20 px-3 text-sm"><option value="info">info</option><option value="warning">warning</option><option value="error">error</option></select></div>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked className="h-4 w-4" /> 激活</label>
    <button type="submit" disabled={navigation.state === "submitting"} className="h-9 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/80">创建</button><a href="/dashboard/notifications" className="ml-2 text-sm text-muted-foreground hover:text-foreground">取消</a>
  </Form></div>;
}
