"use client"

import { useEffect, useState } from "react"

import { ConfigModelFields } from "@/components/admin/config-model-fields"
import { Notice } from "@/components/admin/notice"
import { PageHeader } from "@/components/admin/page-header"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatDateTime } from "@/lib/admin/format"
import { adminJson } from "@/lib/admin-fetch"
import type { CheckModelRecord, CheckRequestTemplateRecord } from "@/lib/admin-types"
import { mapModel, mapTemplate, searchParam } from "../_shared"

function configIdFromPath() {
  const match = window.location.pathname.match(/\/dashboard\/configs\/([^/]+)$/)
  return match && match[1] ? decodeURIComponent(match[1]) : ""
}

export default function EditConfigPage() {
  const id = typeof window !== "undefined" ? configIdFromPath() : ""
  const [config, setConfig] = useState<{
    name: string
    type: string
    model_id: string
    endpoint: string
    api_key: string | null
    enabled: boolean
    is_maintenance: boolean
    group_name: string | null
    template_id: string | null
    template_name: string | null
    created_at: string | null
    updated_at: string | null
  } | null>(null)
  const [models, setModels] = useState<CheckModelRecord[]>([])
  const [templates, setTemplates] = useState<CheckRequestTemplateRecord[]>([])
  const [notFound, setNotFound] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error] = useState<string | null>(searchParam("error") || null)
  const success = searchParam("success")

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [configsRes, modelsRes, templatesRes] = await Promise.all([
        adminJson<{ configs: Record<string, unknown>[] }>("/api/admin/configs").catch(
          () => ({ configs: [] as Record<string, unknown>[] })
        ),
        adminJson<{ models: Record<string, unknown>[] }>("/api/admin/models").catch(
          () => ({ models: [] as Record<string, unknown>[] })
        ),
        adminJson<{ templates: Record<string, unknown>[] }>("/api/admin/templates").catch(
          () => ({ templates: [] as Record<string, unknown>[] })
        ),
      ])
      if (cancelled) return
      const modelRows = modelsRes.models.map(mapModel)
      const templateRows = templatesRes.templates.map(mapTemplate)
      const templateNameById = new Map(templateRows.map((t) => [t.id, t.name]))
      setModels(modelRows)
      setTemplates(templateRows)
      const raw = configsRes.configs.find((row) => String(row.id) === id)
      if (!raw) {
        setNotFound(true)
        return
      }
      setConfig({
        name: String(raw.name ?? ""),
        type: String(raw.type ?? "openai"),
        model_id: String(raw.modelId ?? ""),
        endpoint: String(raw.endpoint ?? ""),
        api_key: typeof raw.apiKey === "string" ? raw.apiKey : null,
        enabled: Boolean(raw.enabled),
        is_maintenance: Boolean(raw.isMaintenance),
        group_name: typeof raw.groupName === "string" ? raw.groupName : null,
        template_id: typeof raw.templateId === "string" ? raw.templateId : null,
        template_name:
          typeof raw.templateId === "string" ? (templateNameById.get(raw.templateId) ?? null) : null,
        created_at: (raw.createdAt as string | null) ?? null,
        updated_at: (raw.updatedAt as string | null) ?? null,
      })
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [id])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    const formData = new FormData(event.currentTarget)
    const payload = {
      name: String(formData.get("name") ?? ""),
      type: String(formData.get("type") ?? ""),
      modelId: String(formData.get("model_id") ?? ""),
      groupName: String(formData.get("group_name") ?? "") || null,
      endpoint: String(formData.get("endpoint") ?? ""),
      apiKey: String(formData.get("api_key") ?? ""),
      enabled: formData.get("enabled") === "on",
      isMaintenance: formData.get("is_maintenance") === "on",
    }
    try {
      const res = await fetch(`/api/admin/configs/${id}`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}))
        window.location.assign(
          `/dashboard/configs/${id}?error=${encodeURIComponent(
            (detail as { error?: string }).error ?? `保存失败: ${res.status}`
          )}`
        )
        return
      }
    } catch {
      window.location.assign(
        `/dashboard/configs/${id}?error=${encodeURIComponent("网络错误，请重试")}`
      )
      return
    }
    window.location.assign(
      `/dashboard/configs?success=${encodeURIComponent("配置已更新")}`
    )
  }

  async function handleDelete() {
    try {
      const res = await fetch(`/api/admin/configs/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}))
        window.location.assign(
          `/dashboard/configs/${id}?error=${encodeURIComponent(
            (detail as { error?: string }).error ?? `删除失败: ${res.status}`
          )}`
        )
        return
      }
    } catch {
      window.location.assign(
        `/dashboard/configs/${id}?error=${encodeURIComponent("网络错误，请重试")}`
      )
      return
    }
    window.location.assign(`/dashboard/configs?success=${encodeURIComponent("配置已删除")}`)
  }

  if (notFound) {
    return (
      <div className="space-y-6">
        <PageHeader title="配置不存在" />
        <a href="/dashboard/configs" className={buttonVariants({ variant: "outline" })}>返回列表</a>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="space-y-6">
        <PageHeader title="加载中…" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`编辑：${config.name}`}
        description={`创建于 ${formatDateTime(config.created_at)}，更新于 ${formatDateTime(config.updated_at)}`}
        actions={
          <a href="/dashboard/configs" className={buttonVariants({ variant: "outline" })}>
            返回列表
          </a>
        }
      />
      {success ? <Notice title="保存成功" description={success} variant="success" /> : null}
      {error ? <Notice title="保存失败" description={error} variant="warning" /> : null}
      <Card>
        <CardHeader>
          <CardTitle>编辑配置</CardTitle>
          <CardDescription>
            配置只保存连接信息。模板改动请去对应模型里处理。谨慎删除，`check_history` 会跟着一起被级联删掉。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-5 md:grid-cols-2">
            <input type="hidden" name="id" value={id} />
            <div className="space-y-2">
              <Label htmlFor="name">名称</Label>
              <Input id="name" name="name" defaultValue={config.name} required />
            </div>
            {models.length > 0 ? (
              <ConfigModelFields
                initialType={config.type as "openai" | "gemini" | "anthropic"}
                initialModelId={config.model_id}
                models={models}
              />
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="group_name">分组名</Label>
              <Input id="group_name" name="group_name" defaultValue={config.group_name ?? ""} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="endpoint">接口地址</Label>
              <Input id="endpoint" name="endpoint" defaultValue={config.endpoint} required />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="api_key">API Key</Label>
              <Input id="api_key" name="api_key" defaultValue={config.api_key ?? ""} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resolved_template">当前模板</Label>
              <Input id="resolved_template" defaultValue={config.template_name ?? "未绑定模板"} disabled />
            </div>
            <div className="flex items-center gap-6 pt-7 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="enabled" defaultChecked={Boolean(config.enabled)} />
                启用检测
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="is_maintenance"
                  defaultChecked={Boolean(config.is_maintenance)}
                />
                维护模式
              </label>
            </div>
            <div className="flex items-center gap-3 md:col-span-2">
              <Button type="submit" disabled={submitting}>保存更改</Button>
              <a href="/dashboard/configs">
                <Button variant="outline" type="button">取消</Button>
              </a>
            </div>
          </form>
          <div className="mt-6 border-t pt-6">
            <Button type="button" variant="destructive" onClick={handleDelete}>
              删除配置
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
