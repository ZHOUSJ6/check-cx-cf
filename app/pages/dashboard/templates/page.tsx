"use client"

import { useEffect, useMemo, useState } from "react"
import { PlusIcon } from "lucide-react"

import { CleanupUnusedTemplatesButton } from "@/components/admin/cleanup-unused-templates-button"
import { Notice } from "@/components/admin/notice"
import { PageHeader } from "@/components/admin/page-header"
import { ProviderBadge } from "@/components/admin/status-badge"
import { TemplateRowActions } from "@/components/admin/template-row-actions"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDateTime } from "@/lib/admin/format"
import { adminJson } from "@/lib/admin-fetch"
import type { CheckRequestTemplateRecord } from "@/lib/admin-types"
import { mapTemplate, searchParam } from "../_shared"

export default function TemplatesPage() {
  const success = searchParam("success")
  const error = searchParam("error")
  const [templates, setTemplates] = useState<CheckRequestTemplateRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [templatesRes, modelsRes] = await Promise.all([
        adminJson<{ templates: Record<string, unknown>[] }>("/api/admin/templates").catch(
          () => ({ templates: [] as Record<string, unknown>[] })
        ),
        adminJson<{ models: Record<string, unknown>[] }>("/api/admin/models").catch(
          () => ({ models: [] as Record<string, unknown>[] })
        ),
      ])
      if (cancelled) return

      // model_count: how many models reference each template id.
      const modelCountByTemplateId = new Map<string, number>()
      for (const row of modelsRes.models) {
        const templateId = typeof row.templateId === "string" ? row.templateId : null
        if (!templateId) continue
        modelCountByTemplateId.set(templateId, (modelCountByTemplateId.get(templateId) ?? 0) + 1)
      }

      const templateRows = templatesRes.templates.map((row) => {
        const template = mapTemplate(row)
        return { ...template, model_count: modelCountByTemplateId.get(template.id) ?? 0 }
      })
      setTemplates(templateRows)
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const unusedTemplateCount = useMemo(
    () => templates.filter((item) => (item.model_count ?? 0) === 0).length,
    [templates]
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="请求模板"
        description="统一复用请求头和 metadata，减少重复配置。"
        actions={
          <div className="flex items-center gap-2">
            <CleanupUnusedTemplatesButton unusedCount={unusedTemplateCount} />
            <a href="/dashboard/templates/new" className={buttonVariants()}><PlusIcon />新建模板</a>
          </div>
        }
      />
      {success ? <Notice variant="success" title="操作成功" description={success} /> : null}
      {error ? <Notice variant="warning" title="操作失败" description={error} /> : null}
      <Card>
        <CardHeader>
          <CardTitle>模板列表</CardTitle>
          <CardDescription>
            共 {templates.length} 条，其中 {unusedTemplateCount} 条未被引用。模板类型必须和模型类型匹配。
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? null : (
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="py-3 pr-4">名称</th>
                  <th className="py-3 pr-4">Provider</th>
                  <th className="py-3 pr-4">请求头</th>
                  <th className="py-3 pr-4">metadata</th>
                  <th className="py-3 pr-4">引用模型</th>
                  <th className="py-3 pr-4">更新时间</th>
                  <th className="py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((item) => (
                  <tr key={item.id} className="border-b align-top last:border-0">
                    <td className="py-3 pr-4">
                      <a href={`/dashboard/templates/${item.id}`} className="font-medium hover:underline">{item.name}</a>
                    </td>
                    <td className="py-3 pr-4"><ProviderBadge type={item.type} /></td>
                    <td className="py-3 pr-4 max-w-sm truncate font-mono text-xs">{item.request_header ? JSON.stringify(item.request_header) : "-"}</td>
                    <td className="py-3 pr-4 max-w-sm truncate font-mono text-xs">{item.metadata ? JSON.stringify(item.metadata) : "-"}</td>
                    <td className="py-3 pr-4">{item.model_count ?? 0}</td>
                    <td className="py-3 pr-4">{formatDateTime(item.updated_at)}</td>
                    <td className="py-3">
                      <TemplateRowActions
                        id={item.id}
                        name={item.name}
                        modelCount={item.model_count ?? 0}
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
