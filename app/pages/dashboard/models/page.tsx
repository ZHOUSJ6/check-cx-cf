"use client"

import { useEffect, useMemo, useState } from "react"
import { PlusIcon } from "lucide-react"

import { CleanupUnusedModelsButton } from "@/components/admin/cleanup-unused-models-button"
import { ModelRowActions } from "@/components/admin/model-row-actions"
import { Notice } from "@/components/admin/notice"
import { PageHeader } from "@/components/admin/page-header"
import { ProviderBadge } from "@/components/admin/status-badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDateTime } from "@/lib/admin/format"
import { adminJson } from "@/lib/admin-fetch"
import type { CheckModelRecord, CheckRequestTemplateRecord } from "@/lib/admin-types"
import { mapModel, mapTemplate, searchParam } from "../_shared"

export default function ModelsPage() {
  const success = searchParam("success")
  const error = searchParam("error")
  const [models, setModels] = useState<CheckModelRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [modelsRes, templatesRes, configsRes] = await Promise.all([
        adminJson<{ models: Record<string, unknown>[] }>("/api/admin/models").catch(
          () => ({ models: [] as Record<string, unknown>[] })
        ),
        adminJson<{ templates: Record<string, unknown>[] }>("/api/admin/templates").catch(
          () => ({ templates: [] as Record<string, unknown>[] })
        ),
        adminJson<{ configs: Record<string, unknown>[] }>("/api/admin/configs").catch(
          () => ({ configs: [] as Record<string, unknown>[] })
        ),
      ])
      if (cancelled) return

      const templateRows = templatesRes.templates.map(mapTemplate)
      const templateNameById = new Map(templateRows.map((t) => [t.id, t.name]))

      // config_count: how many configs reference each model id.
      const configCountByModelId = new Map<string, number>()
      for (const row of configsRes.configs) {
        const modelId = String(row.modelId ?? "")
        if (!modelId) continue
        configCountByModelId.set(modelId, (configCountByModelId.get(modelId) ?? 0) + 1)
      }

      const modelRows = modelsRes.models.map((row) => {
        const model = mapModel(row)
        const id = model.id
        return {
          ...model,
          template_name: model.template_id ? (templateNameById.get(model.template_id) ?? null) : null,
          config_count: configCountByModelId.get(id) ?? 0,
        }
      })
      setModels(modelRows)
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const unusedModelCount = useMemo(
    () => models.filter((item) => (item.config_count ?? 0) === 0).length,
    [models]
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="模型配置"
        description="统一维护模型定义和模板绑定，避免重复修改同一模型。"
        actions={
          <div className="flex items-center gap-2">
            <CleanupUnusedModelsButton unusedCount={unusedModelCount} />
            <a href="/dashboard/models/new" className={buttonVariants()}><PlusIcon />新建模型</a>
          </div>
        }
      />
      {success ? <Notice variant="success" title="操作成功" description={success} /> : null}
      {error ? <Notice variant="warning" title="操作失败" description={error} /> : null}
      <Card>
        <CardHeader>
          <CardTitle>模型列表</CardTitle>
          <CardDescription>
            共 {models.length} 条，其中 {unusedModelCount} 条未被引用。已被引用的模型禁止删除。
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? null : (
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="py-3 pr-4">模型</th>
                  <th className="py-3 pr-4">Provider</th>
                  <th className="py-3 pr-4">模板</th>
                  <th className="py-3 pr-4">引用配置</th>
                  <th className="py-3 pr-4">更新时间</th>
                  <th className="py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {models.map((item) => (
                  <tr key={item.id} className="border-b align-top last:border-0">
                    <td className="py-3 pr-4">
                      <a href={`/dashboard/models/${item.id}`} className="font-medium hover:underline">
                        {item.model}
                      </a>
                    </td>
                    <td className="py-3 pr-4"><ProviderBadge type={item.type} /></td>
                    <td className="max-w-sm py-3 pr-4 truncate text-xs">
                      {item.template_name ?? "-"}
                    </td>
                    <td className="py-3 pr-4">{item.config_count ?? 0}</td>
                    <td className="py-3 pr-4">{formatDateTime(item.updated_at)}</td>
                    <td className="py-3">
                      <ModelRowActions
                        id={item.id}
                        model={item.model}
                        configCount={item.config_count ?? 0}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
