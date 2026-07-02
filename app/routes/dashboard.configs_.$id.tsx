import { Form, useLoaderData, useActionData, useNavigation, redirect } from "react-router";
import type { Route } from "./+types/dashboard.configs_.$id";
import { PageHeader } from "@/components/admin/page-header";

export async function loader({ request, params }: Route.LoaderArgs): Promise<{ config: Record<string, unknown> | null }> {
  const origin = new URL(request.url).origin;
  // The configs list endpoint returns all configs; filter client-side by id.
  const res = await fetch(`${origin}/api/admin/configs`, {
    headers: { cookie: request.headers.get("cookie") ?? "" },
  });
  if (!res.ok) return { config: null };
  const data = (await res.json()) as { configs: Array<Record<string, unknown>> };
  return { config: data.configs.find((c) => c.id === params.id) ?? null };
}

export async function action({ request, params }: Route.ActionArgs) {
  const formData = await request.formData();
  const payload: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key === "intent") continue;
    if (key === "enabled" || key === "isMaintenance") {
      payload[key] = value === "on";
    } else {
      payload[key] = String(value);
    }
  }
  if (!payload.apiKey) delete payload.apiKey; // don't overwrite with empty
  const origin = new URL(request.url).origin;
  const res = await fetch(`${origin}/api/admin/configs/${params.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", cookie: request.headers.get("cookie") ?? "" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    return { error: (detail as { error?: string }).error ?? "更新失败" };
  }
  throw redirect("/dashboard/configs");
}

export default function EditConfigPage() {
  const { config } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  if (!config) {
    return (
      <div>
        <PageHeader title="配置不存在" />
        <a href="/dashboard/configs" className="text-sm text-primary hover:underline">返回列表</a>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="编辑配置" />
      {actionData?.error && <p className="mb-4 text-sm text-destructive">{actionData.error}</p>}
      <Form method="post" className="space-y-4">
        <input type="hidden" name="intent" value="update" />
        <FormField label="名称" name="name" defaultValue={String(config.name ?? "")} />
        <FormField label="端点" name="endpoint" defaultValue={String(config.endpoint ?? "")} />
        <FormField label="API Key（留空不修改）" name="apiKey" type="password" placeholder="输入新 key 或留空" />
        <FormField label="分组名称" name="groupName" defaultValue={String(config.groupName ?? "")} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="enabled" defaultChecked={Boolean(config.enabled)} className="h-4 w-4" /> 启用
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isMaintenance" defaultChecked={Boolean(config.isMaintenance)} className="h-4 w-4" /> 维护模式
        </label>
        <div>
          <button type="submit" disabled={navigation.state === "submitting"} className="h-9 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-60">
            {navigation.state === "submitting" ? "保存中…" : "保存"}
          </button>
          <a href="/dashboard/configs" className="ml-2 text-sm text-muted-foreground hover:text-foreground">取消</a>
        </div>
      </Form>
    </div>
  );
}

function FormField({ label, name, defaultValue, type = "text", placeholder }: { label: string; name: string; defaultValue?: string; type?: string; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input name={name} type={type} defaultValue={defaultValue} placeholder={placeholder} className="h-9 w-full rounded-md border border-input bg-input/20 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30" />
    </div>
  );
}
