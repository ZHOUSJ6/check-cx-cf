"use client"

import { useEffect, useState } from "react"

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
import { Textarea } from "@/components/ui/textarea"
import { nativeSelectClassName } from "@/lib/admin-forms"
import { formatDateTime } from "@/lib/admin/format"
import { parseJson, stringifyJson } from "@/lib/admin/json"
import { adminJson } from "@/lib/admin-fetch"
import { mapTemplate, searchParam } from "../_shared"

function templateIdFromPath() {
  const match = window.location.pathname.match(/\/dashboard\/templates\/([^/]+)$/)
  return match && match[1] ? decodeURIComponent(match[1]) : ""
}

export default function EditTemplatePage() {
  const id = typeof window !== "undefined" ? templateIdFromPath() : ""
  const [template, setTemplate] = useState<{
    name: string
    type: string
    request_header: Record<string, string> | null
    metadata: Record<string, unknown> | null
    model_count: number
    created_at: string | null
    updated_at: string | null
  } | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error] = useState<string | null>(searchParam("error") || null)
  const success = searchParam("success")

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
      const raw = templatesRes.templates.find((row) => String(row.id) === id)
      if (!raw) {
        setNotFound(true)
        return
      }
      const record = mapTemplate(raw)
      const modelCount = modelsRes.models.filter(
        (row) => typeof row.templateId === "string" && row.templateId === id
      ).length
      setTemplate({
        name: record.name,
        type: record.type,
        request_header: record.request_header,
        metadata: record.metadata,
        model_count: modelCount,
        created_at: record.created_at ?? null,
        updated_at: record.updated_at ?? null,
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
    const requestHeader = parseJson(String(formData.get("request_header") ?? ""))
    const metadata = parseJson(String(formData.get("metadata") ?? ""))
    const payload = {
      name: String(formData.get("name") ?? ""),
      type: String(formData.get("type") ?? ""),
      requestHeader,
      metadata,
    }
    try {
      const res = await fetch(`/api/admin/templates/${id}`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}))
        window.location.assign(
          `/dashboard/templates/${id}?error=${encodeURIComponent(
            (detail as { error?: string }).error ?? `保存失败: ${res.status}`
          )}`
        )
        return
      }
    } catch {
      window.location.assign(
        `/dashboard/templates/${id}?error=${encodeURIComponent("网络错误，请重试")}`
      )
      return
    }
    window.location.assign(`/dashboard/templates?success=${encodeURIComponent("模板已更新")}`)
  }

  async function handleDelete() {
    try {
      const res = await fetch(`/api/admin/templates/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}))
        window.location.assign(
          `/dashboard/templates/${id}?error=${encodeURIComponent(
            (detail as { error?: string }).error ?? `删除失败: ${res.status}`
          )}`
        )
        return
      }
    } catch {
      window.location.assign(
        `/dashboard/templates/${id}?error=${encodeURIComponent("网络错误，请重试")}`
      )
      return
    }
    window.location.assign(`/dashboard/templates?success=${encodeURIComponent("模板已删除")}`)
  }

  if (notFound) {
    return (
      <div className="space-y-6">
        <PageHeader title="模板不存在" />
        <a href="/dashboard/templates" className={buttonVariants({ variant: "outline" })}>返回列表</a>
      </div>
    )
  }

  if (!template) {
    return (
      <div className="space-y-6">
        <PageHeader title="加载中…" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`编辑：${template.name}`}
        description={`创建于 ${formatDateTime(template.created_at)}，更新于 ${formatDateTime(template.updated_at)}`}
        actions={
          <a href="/dashboard/templates" className={buttonVariants({ variant: "outline" })}>
            返回列表
          </a>
        }
      />
      {success ? <Notice title="保存成功" description={success} variant="success" /> : null}
      {error ? <Notice title="保存失败" description={error} variant="warning" /> : null}
      <Card>
        <CardHeader>
          <CardTitle>模板内容</CardTitle>
          <CardDescription>
            当前有 {template.model_count} 个模型引用这个模板。被引用时不能删除。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-5">
            <input type="hidden" name="id" value={id} />
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">模板名称</Label>
                <Input id="name" name="name" defaultValue={template.name} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Provider 类型</Label>
                <select
                  id="type"
                  name="type"
                  className={nativeSelectClassName}
                  defaultValue={template.type}
                >
                  <option value="openai">OpenAI</option>
                  <option value="gemini">Gemini</option>
                  <option value="anthropic">Anthropic</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="request_header">默认请求头 JSON</Label>
              <Textarea
                id="request_header"
                name="request_header"
                rows={10}
                defaultValue={stringifyJson(template.request_header)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="metadata">默认 metadata JSON</Label>
              <Textarea
                id="metadata"
                name="metadata"
                rows={10}
                defaultValue={stringifyJson(template.metadata)}
              />
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={submitting}>保存更改</Button>
              <a href="/dashboard/templates">
                <Button variant="outline" type="button">取消</Button>
              </a>
            </div>
          </form>
          <div className="mt-6 border-t pt-6">
            <Button
              type="button"
              variant="destructive"
              disabled={template.model_count > 0}
              onClick={handleDelete}
            >
              删除模板
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
