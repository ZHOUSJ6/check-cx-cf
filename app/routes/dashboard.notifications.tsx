import { useLoaderData, Form, useNavigation } from "react-router";
import type { Route } from "./+types/dashboard.notifications";
import { PageHeader, AdminLink, AdminTable } from "@/components/admin/page-header";
interface NotificationRow { id: string; message: string; isActive: boolean; level: string; }
export async function loader({ request }: Route.LoaderArgs): Promise<{ notifications: NotificationRow[] }> {
  const origin = new URL(request.url).origin;
  const res = await fetch(`${origin}/api/admin/notifications`, { headers: { cookie: request.headers.get("cookie") ?? "" } });
  if (!res.ok) return { notifications: [] };
  return { notifications: ((await res.json()) as { notifications: NotificationRow[] }).notifications };
}
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  if (String(formData.get("intent")) === "delete") {
    const origin = new URL(request.url).origin;
    await fetch(`${origin}/api/admin/notifications/${String(formData.get("id"))}`, { method: "DELETE", headers: { cookie: request.headers.get("cookie") ?? "" } });
  }
  return { ok: true };
}
export default function NotificationsPage() {
  const { notifications } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const rows = notifications.map((n) => [<span key="m" className="line-clamp-1 max-w-md inline-block align-middle">{n.message}</span>, <span key="l" className="rounded bg-muted px-1.5 py-0.5 text-xs">{n.level}</span>, n.isActive ? "激活" : "停用", <Form key="d" method="post" className="inline"><input type="hidden" name="intent" value="delete" /><input type="hidden" name="id" value={n.id} /><button disabled={navigation.state === "submitting"} className="text-xs text-destructive hover:underline">删除</button></Form>]);
  return <div><PageHeader title="通知" description={`共 ${notifications.length} 条`} action={<AdminLink href="/dashboard/notifications/new">+ 新建通知</AdminLink>} /><AdminTable columns={["内容", "级别", "状态", "操作"]} rows={rows} /></div>;
}
