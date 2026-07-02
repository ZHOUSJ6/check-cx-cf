import { useLoaderData, Form, useNavigation } from "react-router";
import type { Route } from "./+types/dashboard.users";
import { PageHeader, AdminTable } from "@/components/admin/page-header";
interface UserRow { id: string; email: string; role: string; groupName: string | null; authUserId: string | null; isActive: boolean; }
export async function loader({ request }: Route.LoaderArgs): Promise<{ users: UserRow[] }> {
  const origin = new URL(request.url).origin;
  const res = await fetch(`${origin}/api/admin/users`, { headers: { cookie: request.headers.get("cookie") ?? "" } });
  if (!res.ok) return { users: [] };
  return { users: ((await res.json()) as { users: UserRow[] }).users };
}
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");
  const origin = new URL(request.url).origin;
  if (intent === "invite") {
    const payload = { email: String(formData.get("email")), role: String(formData.get("role")), groupName: String(formData.get("groupName")).trim() || null };
    await fetch(`${origin}/api/admin/users`, { method: "POST", headers: { "Content-Type": "application/json", cookie: request.headers.get("cookie") ?? "" }, body: JSON.stringify(payload) });
  } else if (intent === "deactivate") {
    await fetch(`${origin}/api/admin/users/${String(formData.get("id"))}`, { method: "DELETE", headers: { cookie: request.headers.get("cookie") ?? "" } });
  }
  return { ok: true };
}
export default function UsersPage() {
  const { users } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const rows = users.map((u) => [u.email, <span key="r" className="rounded bg-muted px-1.5 py-0.5 text-xs">{u.role}</span>, u.groupName ?? "—", u.authUserId ? "已激活" : "待激活", u.isActive ? "启用" : "停用", <Form key="d" method="post" className="inline"><input type="hidden" name="intent" value="deactivate" /><input type="hidden" name="id" value={u.id} /><button disabled={navigation.state === "submitting"} className="text-xs text-destructive hover:underline">停用</button></Form>]);
  return <div><PageHeader title="用户" description={`共 ${users.length} 条`} />
    <Form method="post" className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-border/40 p-4">
      <input type="hidden" name="intent" value="invite" />
      <div className="space-y-1"><label className="text-[10px] font-medium uppercase text-muted-foreground">邮箱</label><input name="email" required type="email" className="h-9 w-48 rounded-md border border-input bg-input/20 px-3 text-sm" /></div>
      <div className="space-y-1"><label className="text-[10px] font-medium uppercase text-muted-foreground">角色</label><select name="role" className="h-9 rounded-md border border-input bg-input/20 px-3 text-sm"><option value="member">member</option><option value="admin">admin</option></select></div>
      <div className="space-y-1"><label className="text-[10px] font-medium uppercase text-muted-foreground">分组(member)</label><input name="groupName" className="h-9 w-40 rounded-md border border-input bg-input/20 px-3 text-sm" /></div>
      <button type="submit" disabled={navigation.state === "submitting"} className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/80">邀请</button>
    </Form>
    <AdminTable columns={["邮箱", "角色", "分组", "状态", "启用", "操作"]} rows={rows} />
  </div>;
}
