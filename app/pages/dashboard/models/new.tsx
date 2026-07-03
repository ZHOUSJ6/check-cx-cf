"use client"

import { useEffect, useState } from "react"

import { ModelTemplateFields } from "@/components/admin/model-template-fields"
import { Notice } from "@/components/admin/notice"
import { PageHeader } from "@/components/admin/page-header"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { adminJson } from "@/lib/admin-fetch"
import type { CheckRequestTemplateRecord } from "@/lib/admin-types"
import { mapTemplate, searchParam } from "../_shared"

export default function NewModelPage() {
  const error = searchParam("error") || null
  const [templates, setTemplates] = useState<CheckRequestTemplateRecord[]>([])
  const [submitError, setSubmitError] = useState<string | null>(error)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await adminJson<{ templates: Record<string, unknown>[] }>(
        "/api/admin/templates"
      ).catch(() => ({ templates: [] as Record<string, unknown>[] }))
      if (cancelled) return
      setTemplates(res.templates.map(mapTemplate))
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    const formData = new FormData(event.currentTarget)
    const templateIdRaw = String(formData.get("template_id") ?? "").trim()
    const payload = {
      type: String(formData.get("type") ?? ""),
      model: String(formData.get("model") ?? ""),
      templateId: templateIdRaw || null,
    }
    try {
      const res = await fetch("/api/admin/models", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}))
        setSubmitError((detail as { error?: string }).error ?? `创建失败: ${res.status}`)
        setSubmitting(false)
        return
      }
    } catch {
      setSubmitError("网络错误，请重试")
      setSubmitting(false)
      return
    }
    window.location.assign("/dashboard/models?success=" + encodeURIComponent("模型已创建"))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="新建模型"
        description="模型层用于维护模型定义和绑定模板，实例信息请在配置页管理。"
        actions={
          <a href="/dashboard/models" className={buttonVariants({ variant: "outline" })}>返回列表</a>
        }
      />
      {submitError ? <Notice variant="warning" title="保存失败" description={submitError} /> : null}
      <Card>
        <CardHeader>
          <CardTitle>模型表单</CardTitle>
          <CardDescription>模板是默认请求参数的唯一来源，模型只负责关联它。</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            {templates.length > 0 ? (
              <ModelTemplateFields initialType="openai" initialTemplateId="" templates={templates} />
            ) : null}
            <label className="space-y-2">
              <span className="text-sm font-medium">模型名称</span>
              <Input name="model" placeholder="gpt-4o-mini" required />
            </label>
            <div className="md:col-span-2 flex justify-end gap-2">
              <a href="/dashboard/models">
                <Button variant="outline" type="button">取消</Button>
              </a>
              <Button type="submit" disabled={submitting}>创建模型</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
