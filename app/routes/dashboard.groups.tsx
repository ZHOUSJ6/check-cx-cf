import { useLoaderData, Form, useNavigation } from "react-router";
import type { Route } from "./+types/dashboard.groups";
import { PageHeader, AdminLink, AdminTable } from "@/components/admin/page-header";
interface GroupRow { id: string; groupName: string; websiteUrl: string | null; tags: string; }
export async function loader({ request }: Route.LoaderArgs): Promise<{ groups: GroupRow[] }> {
  const origin = new URL(request.url).origin;
  const res = await fetch(`${origin}/api/admin/groups`, { headers: { cookie: request.headers.get("cookie") ?? "" } });
  if (!res.ok) return { groups: [] };
  return { groups: ((await res.json()) as { groups: GroupRow[] }).groups };
}
export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  if (String(formData.get("intent")) === "delete") {
    const origin = new URL(request.url).origin;
    await fetch(`${origin}/api/admin/groups/${String(formData.get("id"))}`, { method: "DELETE", headers: { cookie: request.headers.get("cookie") ?? "" } });
  }
  return { ok: true };
}
export default function GroupsPage() {
  const { groups } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const rows = groups.map((g) => [g.groupName, g.websiteUrl ?? "—", g.tags || "—", <a key="e" href={`/dashboard/groups/${g.id}`} className="text-xs text-primary hover:underline">编辑</a>, <Form key="d" method="post" className="inline"><input type="hidden" name="intent" value="delete" /><input type="hidden" name="id" value={g.id} /><button disabled={navigation.state === "submitting"} className="text-xs text-destructive hover:underline">删除</button></Form>]);
  return <div><PageHeader title="分组" description={`共 ${groups.length} 条`} action={<AdminLink href="/dashboard/groups/new">+ 新建分组</AdminLink>} /><AdminTable columns={["名称", "网站", "标签", "", "操作"]} rows={rows} /></div>;
}
