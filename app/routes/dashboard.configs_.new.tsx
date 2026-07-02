import { Form, useActionData, useNavigation, redirect, useLoaderData } from "react-router";
import type { Route } from "./+types/dashboard.configs_.new";
import { PageHeader } from "@/components/admin/page-header";

interface ModelOption { id: string; type: string; model: string; }

export async function loader({ request }: Route.LoaderArgs): Promise<{ models: ModelOption[] }> {
  const origin = new URL(request.url).origin;
  const res = await fetch(`${origin}/api/admin/models`, {
    headers: { cookie: request.headers.get("cookie") ?? "" },
  });
  if (!res.ok) return { models: [] };
  const data = (await res.json()) as { models: ModelOption[] };
  return { models: data.models };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const payload = {
    name: String(formData.get("name") ?? ""),
    type: String(formData.get("type") ?? ""),
    modelId: String(formData.get("modelId") ?? ""),
    endpoint: String(formData.get("endpoint") ?? ""),
    apiKey: String(formData.get("apiKey") ?? ""),
    groupName: String(formData.get("groupName") ?? "").trim() || null,
    enabled: formData.get("enabled") === "on",
    isMaintenance: formData.get("isMaintenance") === "on",
  };
  const origin = new URL(request.url).origin;
  const res = await fetch(`${origin}/api/admin/configs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: request.headers.get("cookie") ?? "" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    return { error: (detail as { error?: string }).error ?? "创建失败" };
  }
  throw redirect("/dashboard/configs");
}

export default function NewConfigPage() {
  const { models } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  return (
    <div className="max-w-2xl">
      <PageHeader title="新建配置" />
      {actionData?.error && <p className="mb-4 text-sm text-destructive">{actionData.error}</p>}
      <Form method="post" className="space-y-4">
        <Field label="名称" name="name" required />
        <Field label="端点" name="endpoint" required placeholder="https://api.openai.com/v1/chat/completions" />
        <Field label="API Key" name="apiKey" required type="password" />
        <SelectField label="模型" name="modelId" options={models.map((m) => ({ value: m.id, label: `${m.model} (${m.type})` }))} />
        <Field label="分组名称" name="groupName" placeholder="留空则未分组" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="enabled" defaultChecked className="h-4 w-4" /> 启用
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isMaintenance" className="h-4 w-4" /> 维护模式
        </label>
        <button type="submit" disabled={navigation.state === "submitting"} className="h-9 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-60">
          {navigation.state === "submitting" ? "保存中…" : "创建"}
        </button>
        <a href="/dashboard/configs" className="ml-2 text-sm text-muted-foreground hover:text-foreground">取消</a>
      </Form>
    </div>
  );
}

function Field({ label, name, type = "text", required, placeholder }: { label: string; name: string; type?: string; required?: boolean; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}{required && " *"}</label>
      <input name={name} type={type} required={required} placeholder={placeholder} className="h-9 w-full rounded-md border border-input bg-input/20 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30" />
    </div>
  );
}

function SelectField({ label, name, options }: { label: string; name: string; options: { value: string; label: string }[] }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <select name={name} className="h-9 w-full rounded-md border border-input bg-input/20 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
