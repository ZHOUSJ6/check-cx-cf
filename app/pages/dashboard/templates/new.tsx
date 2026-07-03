"use client"

import { useState } from "react"

import { Notice } from "@/components/admin/notice"
import { PageHeader } from "@/components/admin/page-header"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { nativeSelectClassName } from "@/lib/admin-forms"
import { Textarea } from "@/components/ui/textarea"
import { parseJson } from "@/lib/admin/json"
import { searchParam } from "../_shared"

export default function NewTemplatePage() {
  const [error, setError] = useState<string | null>(searchParam("error") || null)
  const [submitting, setSubmitting] = useState(false)

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
      const res = await fetch("/api/admin/templates", {
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
    window.location.assign("/dashboard/templates?success=" + encodeURIComponent("模板已创建"))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="新建模板"
        description="模板用于复用通用请求参数，减少重复配置。"
        actions={
          <a href="/dashboard/templates" className={buttonVariants({ variant: "outline" })}>返回列表</a>
        }
      />
      {error ? <Notice variant="warning" title="保存失败" description={error} /> : null}
      <Card>
        <CardHeader>
          <CardTitle>模板表单</CardTitle>
          <CardDescription>请求头和 metadata 都是可选 JSON。</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium">模板名称</span>
              <Input name="name" required />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium">Provider 类型</span>
              <select name="type" defaultValue="openai" className={nativeSelectClassName}>
                <option value="openai">OpenAI</option>
                <option value="gemini">Gemini</option>
                <option value="anthropic">Anthropic</option>
              </select>
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium">请求头 JSON</span>
              <Textarea name="request_header" className="min-h-36 font-mono" placeholder='{"Authorization":"Bearer ..."}' />
            </label>
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-medium">metadata JSON</span>
              <Textarea name="metadata" className="min-h-36 font-mono" placeholder='{"temperature":0}' />
            </label>
            <div className="md:col-span-2 flex justify-end gap-2">
              <a href="/dashboard/templates">
                <Button variant="outline" type="button">取消</Button>
              </a>
              <Button type="submit" disabled={submitting}>创建模板</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
