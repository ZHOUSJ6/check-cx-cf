"use client"

import { useEffect, useMemo, useState } from "react"
import { PlusIcon } from "lucide-react"

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
import { adminJson } from "@/lib/admin-fetch"
import { nativeSelectClassName } from "@/lib/admin-forms"
import type { CheckConfigRecord, CheckModelRecord, CheckRequestTemplateRecord } from "@/lib/admin-types"

import { ConfigsTable } from "./configs-table"
import { mapConfig, mapModel, mapTemplate, searchParam } from "../_shared"

export default function ConfigsPage() {
  const [configs, setConfigs] = useState<CheckConfigRecord[]>([])
  const [templates, setTemplates] = useState<CheckRequestTemplateRecord[]>([])
  const [models, setModels] = useState<CheckModelRecord[]>([])
  const [loading, setLoading] = useState(true)

  const success = searchParam("success")
  const error = searchParam("error")
  const keyword = searchParam("keyword").trim()
  const type = searchParam("type")
  const groupName = searchParam("group_name")
  const templateId = searchParam("template_id")
  const enabled = searchParam("enabled")
  const maintenance = searchParam("maintenance")

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [configsRes, templatesRes, modelsRes] = await Promise.all([
        adminJson<{ configs: Record<string, unknown>[] }>("/api/admin/configs").catch(
          () => ({ configs: [] as Record<string, unknown>[] })
        ),
        adminJson<{ templates: Record<string, unknown>[] }>("/api/admin/templates").catch(
          () => ({ templates: [] as Record<string, unknown>[] })
        ),
        adminJson<{ models: Record<string, unknown>[] }>("/api/admin/models").catch(
          () => ({ models: [] as Record<string, unknown>[] })
        ),
      ])
      if (cancelled) return

      const modelRows = modelsRes.models.map(mapModel)
      const templateRows = templatesRes.templates.map(mapTemplate)
      const templateNameById = new Map(templateRows.map((t) => [t.id, t.name]))
      const modelById = new Map(modelRows.map((m) => [m.id, m]))

      const configRows = configsRes.configs.map((row) => {
        const config = mapConfig(row)
        const model = config.model_id ? modelById.get(config.model_id) : undefined
        return {
          ...config,
          model: model?.model ?? null,
          template_name: config.template_id ? (templateNameById.get(config.template_id) ?? null) : null,
        }
      })
      setConfigs(configRows)
      setTemplates(templateRows)
      setModels(modelRows)
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const groupNames = useMemo(
    () =>
      Array.from(
        new Set(
          configs
            .map((item) => item.group_name?.trim())
            .filter((item): item is string => Boolean(item))
        )
      ).sort((left, right) => left.localeCompare(right, "zh-Hans-CN")),
    [configs]
  )

  const filteredConfigs = useMemo(() => {
    const normalizedKeyword = keyword.toLowerCase()
    return configs
      .filter((item) => {
        const templateName = item.template_name ?? ""
        const matchesKeyword =
          normalizedKeyword.length === 0 ||
          [item.name, item.model ?? "", item.endpoint, item.group_name ?? "", templateName]
            .join("\n")
            .toLowerCase()
            .includes(normalizedKeyword)

        const matchesType = type.length === 0 || item.type === type
        const matchesGroup = groupName.length === 0 || (item.group_name ?? "") === groupName
        const matchesTemplate =
          templateId.length === 0 ||
          (templateId === "__none__" ? !item.template_id : item.template_id === templateId)
        const matchesEnabled =
          enabled.length === 0 ||
          (enabled === "enabled" ? Boolean(item.enabled) : !Boolean(item.enabled))
        const matchesMaintenance =
          maintenance.length === 0 ||
          (maintenance === "maintenance" ? Boolean(item.is_maintenance) : !Boolean(item.is_maintenance))

        return (
          matchesKeyword &&
          matchesType &&
          matchesGroup &&
          matchesTemplate &&
          matchesEnabled &&
          matchesMaintenance
        )
      })
      .sort((left, right) => {
        const leftCreatedAt = left.created_at ? new Date(left.created_at).getTime() : 0
        const rightCreatedAt = right.created_at ? new Date(right.created_at).getTime() : 0

        if (rightCreatedAt !== leftCreatedAt) {
          return rightCreatedAt - leftCreatedAt
        }

        const leftUpdatedAt = left.updated_at ? new Date(left.updated_at).getTime() : 0
        const rightUpdatedAt = right.updated_at ? new Date(right.updated_at).getTime() : 0

        return rightUpdatedAt - leftUpdatedAt
      })
  }, [configs, keyword, type, groupName, templateId, enabled, maintenance])

  const hasActiveFilters = [keyword, type, groupName, templateId, enabled, maintenance].some(
    (value) => value.length > 0
  )
  const returnPath = useMemo(() => {
    const search = new URLSearchParams()

    if (keyword) search.set("keyword", keyword)
    if (type) search.set("type", type)
    if (groupName) search.set("group_name", groupName)
    if (templateId) search.set("template_id", templateId)
    if (enabled) search.set("enabled", enabled)
    if (maintenance) search.set("maintenance", maintenance)

    const query = search.toString()
    return query.length > 0 ? `/dashboard/configs?${query}` : "/dashboard/configs"
  }, [keyword, type, groupName, templateId, enabled, maintenance])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Provider 配置"
        description="管理实际参与检测的实例，优先通过启停维护运行状态。"
        actions={
          <a href="/dashboard/configs/new" className={buttonVariants()}>
            <PlusIcon />
            新建配置
          </a>
        }
      />
      {success ? <Notice variant="success" title="操作成功" description={success} /> : null}
      {error ? <Notice variant="warning" title="操作失败" description={error} /> : null}
      <Card>
        <CardHeader>
          <CardTitle>配置列表</CardTitle>
          <CardDescription>
            {hasActiveFilters
              ? `共 ${configs.length} 条，筛选后 ${filteredConfigs.length} 条。模板来源已经上收到了模型层。`
              : `共 ${configs.length} 条。模板来源已经上收到了模型层。`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form method="get" action="/dashboard/configs" className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <label className="space-y-2">
              <span className="text-sm font-medium">关键词</span>
              <Input
                name="keyword"
                defaultValue={keyword}
                placeholder="名称 / 模型 / 地址 / 分组 / 模板"
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Provider</span>
              <select name="type" defaultValue={type} className={nativeSelectClassName}>
                <option value="">全部</option>
                <option value="openai">OpenAI</option>
                <option value="gemini">Gemini</option>
                <option value="anthropic">Anthropic</option>
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">分组</span>
              <select name="group_name" defaultValue={groupName} className={nativeSelectClassName}>
                <option value="">全部</option>
                {groupNames.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">模板</span>
              <select name="template_id" defaultValue={templateId} className={nativeSelectClassName}>
                <option value="">全部</option>
                <option value="__none__">无模板</option>
                {templates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">启用状态</span>
              <select name="enabled" defaultValue={enabled} className={nativeSelectClassName}>
                <option value="">全部</option>
                <option value="enabled">启用</option>
                <option value="disabled">停用</option>
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">维护状态</span>
              <select name="maintenance" defaultValue={maintenance} className={nativeSelectClassName}>
                <option value="">全部</option>
                <option value="maintenance">维护中</option>
                <option value="normal">非维护</option>
              </select>
            </label>
            <div className="flex items-end gap-3 md:col-span-2 xl:col-span-6">
              <Button type="submit">筛选</Button>
              <a href="/dashboard/configs">
                <Button variant="outline" type="button">清空筛选</Button>
              </a>
            </div>
          </form>
          {loading ? null : (
            <ConfigsTable
              configs={filteredConfigs}
              models={models}
              returnPath={returnPath}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
