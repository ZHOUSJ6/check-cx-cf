"use client"

import { useState } from "react"

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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { nativeSelectClassName } from "@/lib/admin-forms"
import { searchParam } from "../_shared"

export default function NewNotificationPage() {
  const [error, setError] = useState<string | null>(searchParam("error") || null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    const formData = new FormData(event.currentTarget)
    const payload = {
      message: String(formData.get("message") ?? ""),
      level: String(formData.get("level") ?? "info"),
      isActive: formData.get("is_active") === "on",
    }
    try {
      const res = await fetch("/api/admin/notifications", {
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
    window.location.assign("/dashboard/notifications?success=" + encodeURIComponent("通知已创建"))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="新增系统通知"
        description="通知内容以清晰、可维护为主，预览会按 Markdown 展示。"
        actions={
          <a href="/dashboard/notifications" className={buttonVariants({ variant: "outline" })}>
            返回列表
          </a>
        }
      />
      {error ? <Notice title="保存失败" description={error} variant="warning" /> : null}
      <Card>
        <CardHeader>
          <CardTitle>通知内容</CardTitle>
          <CardDescription>如果暂时不想展示，直接取消激活，不要删记录。</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-5">
            <div className="space-y-2">
              <Label htmlFor="message">通知内容</Label>
              <Textarea id="message" name="message" rows={8} required />
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="level">通知级别</Label>
                <select
                  id="level"
                  name="level"
                  className={nativeSelectClassName}
                  defaultValue="info"
                >
                  <option value="info">信息</option>
                  <option value="warning">警告</option>
                  <option value="error">错误</option>
                </select>
              </div>
              <div className="flex items-center pt-7 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="is_active" defaultChecked />
                  立即显示
                </label>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={submitting}>创建通知</Button>
              <a href="/dashboard/notifications">
                <Button variant="outline" type="button">取消</Button>
              </a>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
