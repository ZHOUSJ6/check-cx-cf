"use client"

import { useEffect, useState } from "react"

import { ModelTemplateFields } from "@/components/admin/model-template-fields"
import { Notice } from "@/components/admin/notice"
import { PageHeader } from "@/components/admin/page-header"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { formatDateTime } from "@/lib/admin/format"
import { adminJson } from "@/lib/admin-fetch"
import type { CheckRequestTemplateRecord } from "@/lib/admin-types"
import { mapTemplate, searchParam } from "../_shared"

function modelIdFromPath() {
  const match = window.location.pathname.match(/\/dashboard\/models\/([^/]+)$/)
  return match && match[1] ? decodeURIComponent(match[1]) : ""
}

export default function EditModelPage() {
  const id = typeof window !== "undefined" ? modelIdFromPath() : ""
  const [model, setModel] = useState<{
    model: string
    type: string
    template_id: string | null
    config_count: number
    created_at: string | null
    updated_at: string | null
  } | null>(null)
  const [templates, setTemplates] = useState<CheckRequestTemplateRecord[]>([])
  const [notFound, setNotFound] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error] = useState<string | null>(searchParam("error") || null)
  const success = searchParam("success")

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
      setTemplates(templatesRes.templates.map(mapTemplate))
      const raw = modelsRes.models.find((row) => String(row.id) === id)
      if (!raw) {
        setNotFound(true)
        return
      }
      const configCount = configsRes.configs.filter(
        (row) => String(row.modelId ?? "") === id
      ).length
      setModel({
        model: String(raw.model ?? ""),
        type: String(raw.type ?? "openai"),
        template_id: typeof raw.templateId === "string" ? raw.templateId : null,
        config_count: configCount,
        created_at: null,
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
    const templateIdRaw = String(formData.get("template_id") ?? "").trim()
    const payload = {
      model: String(formData.get("model") ?? ""),
      templateId: templateIdRaw || null,
    }
    try {
      const res = await fetch(`/api/admin/models/${id}`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}))
        window.location.assign(
          `/dashboard/models/${id}?error=${encodeURIComponent(
            (detail as { error?: string }).error ?? `保存失败: ${res.status}`
          )}`
        )
        return
      }
    } catch {
      window.location.assign(
        `/dashboard/models/${id}?error=${encodeURIComponent("网络错误，请重试")}`
      )
      return
    }
    window.location.assign(`/dashboard/models?success=${encodeURIComponent("模型已更新")}`)
  }

  async function handleDelete() {
    try {
      const res = await fetch(`/api/admin/models/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}))
        window.location.assign(
          `/dashboard/models/${id}?error=${encodeURIComponent(
            (detail as { error?: string }).error ?? `删除失败: ${res.status}`
          )}`
        )
        return
      }
    } catch {
      window.location.assign(
        `/dashboard/models/${id}?error=${encodeURIComponent("网络错误，请重试")}`
      )
      return
    }
    window.location.assign(`/dashboard/models?success=${encodeURIComponent("模型已删除")}`)
  }

  if (notFound) {
    return (
      <div className="space-y-6">
        <PageHeader title="模型不存在" />
        <a href="/dashboard/models" className={buttonVariants({ variant: "outline" })}>返回列表</a>
      </div>
    )
  }

  if (!model) {
    return (
      <div className="space-y-6">
        <PageHeader title="加载中…" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`编辑：${model.model}`}
        description={`创建于 ${formatDateTime(model.created_at)}，更新于 ${formatDateTime(model.updated_at)}`}
        actions={
          <a href="/dashboard/models" className={buttonVariants({ variant: "outline" })}>
            返回列表
          </a>
        }
      />
      {success ? <Notice title="保存成功" description={success} variant="success" /> : null}
      {error ? <Notice title="保存失败" description={error} variant="warning" /> : null}
      <Card>
        <CardHeader>
          <CardTitle>模型内容</CardTitle>
          <CardDescription>
            当前有 {model.config_count} 条配置引用这个模型。被引用时不能删除。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-5">
            <input type="hidden" name="id" value={id} />
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <span className="text-sm font-medium">模型名称</span>
                <Input id="model" name="model" defaultValue={model.model} required />
              </div>
              {templates.length > 0 ? (
                <ModelTemplateFields
                  initialType={model.type as "openai" | "gemini" | "anthropic"}
                  initialTemplateId={model.template_id ?? ""}
                  templates={templates}
                />
              ) : null}
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={submitting}>保存更改</Button>
              <a href="/dashboard/models">
                <Button variant="outline" type="button">取消</Button>
              </a>
            </div>
          </form>
          <div className="mt-6 border-t pt-6">
            <Button
              type="button"
              variant="destructive"
              disabled={model.config_count > 0}
              onClick={handleDelete}
            >
              删除模型
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
