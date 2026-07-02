import { useLoaderData, Form, redirect } from "react-router";
import type { Route } from "./+types/dashboard.groups_.$id";
import { PageHeader } from "@/components/admin/page-header";
interface GroupRow { id: string; groupName: string; websiteUrl: string | null; tags: string; }
export async function loader({ request, params }: Route.LoaderArgs): Promise<{ group: GroupRow | null }> {
  const origin = new URL(request.url).origin;
  const res = await fetch(`${origin}/api/admin/groups`, { headers: { cookie: request.headers.get("cookie") ?? "" } });
  if (!res.ok) return { group: null };
  const all = ((await res.json()) as { groups: GroupRow[] }).groups;
  return { group: all.find((g) => g.id === params.id) ?? null };
}
export async function action({ request, params }: Route.ActionArgs) {
  const formData = await request.formData();
  const origin = new URL(request.url).origin;
  await fetch(`${origin}/api/admin/groups/${params.id}`, { method: "PUT", headers: { "Content-Type": "application/json", cookie: request.headers.get("cookie") ?? "" }, body: JSON.stringify({ groupName: String(formData.get("groupName")), websiteUrl: String(formData.get("websiteUrl")).trim() || null, tags: String(formData.get("tags")) }) });
  throw redirect("/dashboard/groups");
}
export default function EditGroupPage() {
  const { group } = useLoaderData<typeof loader>();
  if (!group) return <div><PageHeader title="分组不存在" /><a href="/dashboard/groups" className="text-sm text-primary hover:underline">返回</a></div>;
  return <div className="max-w-md"><PageHeader title="编辑分组" /><Form method="post" className="space-y-4">
    <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">分组名称</label><input name="groupName" defaultValue={group.groupName} className="h-9 w-full rounded-md border border-input bg-input/20 px-3 text-sm" /></div>
    <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">网站</label><input name="websiteUrl" defaultValue={group.websiteUrl ?? ""} className="h-9 w-full rounded-md border border-input bg-input/20 px-3 text-sm" /></div>
    <div className="space-y-1.5"><label className="text-xs font-medium text-muted-foreground">标签</label><input name="tags" defaultValue={group.tags} className="h-9 w-full rounded-md border border-input bg-input/20 px-3 text-sm" /></div>
    <button type="submit" className="h-9 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/80">保存</button><a href="/dashboard/groups" className="ml-2 text-sm text-muted-foreground hover:text-foreground">取消</a>
  </Form></div>;
}
