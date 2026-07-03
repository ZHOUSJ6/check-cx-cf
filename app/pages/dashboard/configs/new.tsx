"use client"

import { useEffect, useState } from "react"

import { Notice } from "@/components/admin/notice"
import { ConfigModelFields } from "@/components/admin/config-model-fields"
import { PageHeader } from "@/components/admin/page-header"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { nativeSelectClassName } from "@/lib/admin-forms"
import type { CheckModelRecord, GroupInfoRecord } from "@/lib/admin-types"
import { adminJson } from "@/lib/admin-fetch"
import { mapGroup, mapModel, searchParam } from "../_shared"

export default function NewConfigPage() {
  const [error, setError] = useState<string | null>(searchParam("error") || null)
  const sourceId = searchParam("source")
  const [groups, setGroups] = useState<GroupInfoRecord[]>([])
  const [models, setModels] = useState<CheckModelRecord[]>([])
  const [sourceConfig, setSourceConfig] = useState<{
    id: string
    name: string
    type: string
    model_id: string
    endpoint: string
    api_key: string | null
    enabled: boolean
    is_maintenance: boolean
    group_name: string | null
  } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [groupsRes, modelsRes] = await Promise.all([
        adminJson<{ groups: Record<string, unknown>[] }>("/api/admin/groups").catch(
          () => ({ groups: [] as Record<string, unknown>[] })
        ),
        adminJson<{ models: Record<string, unknown>[] }>("/api/admin/models").catch(
          () => ({ models: [] as Record<string, unknown>[] })
        ),
      ])
      if (cancelled) return
      setGroups(groupsRes.groups.map(mapGroup))
      setModels(modelsRes.models.map(mapModel))

      if (sourceId) {
        // Resolve the source config from the list (API doesn't expose a single endpoint).
        const configsRes = await adminJson<{ configs: Record<string, unknown>[] }>(
          "/api/admin/configs"
        ).catch(() => ({ configs: [] as Record<string, unknown>[] }))
        if (cancelled) return
        const raw = configsRes.configs.find((row) => String(row.id) === sourceId)
        if (raw) {
          setSourceConfig({
            id: String(raw.id),
            name: String(raw.name ?? ""),
            type: String(raw.type ?? "openai"),
            model_id: String(raw.modelId ?? ""),
            endpoint: String(raw.endpoint ?? ""),
            api_key: typeof raw.apiKey === "string" ? raw.apiKey : null,
            enabled: Boolean(raw.enabled),
            is_maintenance: Boolean(raw.isMaintenance),
            group_name: typeof raw.groupName === "string" ? raw.groupName : null,
          })
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [sourceId])

  const groupNames = Array.from(
    new Set(groups.map((item) => item.group_name.trim()).filter(Boolean))
  ).sort((left, right) => left.localeCompare(right, "zh-Hans-CN"))
  const sourceGroupName = sourceConfig?.group_name?.trim() || ""
  const hasSourceGroup = sourceGroupName.length > 0 && groupNames.includes(sourceGroupName)

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
      const res = await fetch("/api/admin/configs", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}))
        setError((detail as { error?: string }).error ?? `创建失败: ${res.status}`)
        setSubmitting(false)
        return
      }
    } catch {
      setError("网络错误，请重试")
      setSubmitting(false)
      return
    }
    window.location.assign("/dashboard/configs?success=" + encodeURIComponent("配置已创建"))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="新建配置"
        description="填写检测实例的连接信息，尽量保持配置简单明确。"
        actions={
          <a href="/dashboard/configs" className={buttonVariants({ variant: "outline" })}>
            返回列表
          </a>
        }
      />
      {error ? <Notice variant="warning" title="保存失败" description={error} /> : null}
      {sourceConfig ? (
        <Notice
          variant="info"
          title="正在复制已有配置"
          description={`已从「${sourceConfig.name}」预填表单，请确认差异后再创建新配置。`}
        />
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>配置表单</CardTitle>
          <CardDescription>配置实例只管连接信息。请求参数默认值全部跟着模型绑定的模板走。</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="source_config_id" value={sourceConfig?.id ?? sourceId ?? ""} />
            <label className="space-y-2">
              <span className="text-sm font-medium">显示名称</span>
              <Input name="name" defaultValue={sourceConfig ? `${sourceConfig.name} - 副本` : ""} required />
            </label>
            {models.length > 0 ? (
              <ConfigModelFields
                initialType={(sourceConfig?.type as "openai" | "gemini" | "anthropic") ?? "openai"}
                initialModelId={sourceConfig?.model_id ?? ""}
                models={models}
              />
            ) : null}
            <label className="space-y-2">
              <span className="text-sm font-medium">分组名称</span>
              <select name="group_name" defaultValue={sourceGroupName} className={nativeSelectClassName}>
                <option value="">不设置分组</option>
                {!hasSourceGroup && sourceGroupName ? (
                  <option value={sourceGroupName}>{sourceGroupName}（当前未在分组表中）</option>
                ) : null}
                {groupNames.map((groupName) => (
                  <option key={groupName} value={groupName}>{groupName}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium">API 端点</span>
              <Input name="endpoint" placeholder="https://api.openai.com/v1/chat/completions" defaultValue={sourceConfig?.endpoint ?? ""} required />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium">API Key</span>
              <Input name="api_key" defaultValue={sourceConfig?.api_key ?? ""} required />
            </label>
            <div className="flex items-center gap-6 pt-7 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" name="enabled" defaultChecked={sourceConfig ? Boolean(sourceConfig.enabled) : true} /> 启用检测</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="is_maintenance" defaultChecked={Boolean(sourceConfig?.is_maintenance)} /> 维护模式</label>
            </div>
            <div className="md:col-span-2 flex justify-end gap-2">
              <a href="/dashboard/configs">
                <Button variant="outline" type="button">取消</Button>
              </a>
              <Button type="submit" disabled={submitting}>创建配置</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
