import { useLoaderData, Form, redirect } from "react-router";
import type { Route } from "./+types/dashboard.notifications_.$id";
import { PageHeader } from "@/components/admin/page-header";
interface NotificationRow { id: string; message: string; isActive: boolean; level: string; }
export async function loader({ request, params }: Route.LoaderArgs): Promise<{ notification: NotificationRow | null }> {
  const origin = new URL(request.url).origin;
  const res = await fetch(`${origin}/api/admin/notifications`, { headers: { cookie: request.headers.get("cookie") ?? "" } });
  if (!res.ok) return { notification: null };
  const all = ((await res.json()) as { notifications: NotificationRow[] }).notifications;
  return { notification: all.find((n) => n.id === params.id) ?? null };
}
export async function action({ request, params }: Route.ActionArgs) {
  const formData = await request.formData();
  const origin = new URL(request.url).origin;
  await fetch(`${origin}/api/admin/notifications/${params.id}`, { method: "PUT", headers: { "Content-Type": "application/json", cookie: request.headers.get("cookie") ?? "" }, body: JSON.stringify({ message: String(formData.get("message")), level: String(formData.get("level")), isActive: formData.get("isActive") === "on" }) });
  throw redirect("/dashboard/notifications");
}
export default function EditNotificationPage() {
  const { notification } = useLoaderData<typeof loader>();
  if (!notification) return <div><PageHeader title="通知不存在" /><a href="/dashboard/notifications" className="text-sm text-primary hover:underline">返回</a></div>;
  return <div className="max-w-lg"><PageHeader title="编辑通知" /><Form method="post" className="space-y-4">
    <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">内容</label><textarea name="message" defaultValue={notification.message} rows={4} className="w-full rounded-md border border-input bg-input/20 px-3 py-2 text-sm" /></div>
    <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">级别</label><select name="level" defaultValue={notification.level} className="h-9 w-full rounded-md border border-input bg-input/20 px-3 text-sm"><option value="info">info</option><option value="warning">warning</option><option value="error">error</option></select></div>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={notification.isActive} className="h-4 w-4" /> 激活</label>
    <button type="submit" className="h-9 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/80">保存</button><a href="/dashboard/notifications" className="ml-2 text-sm text-muted-foreground hover:text-foreground">取消</a>
  </Form></div>;
}
