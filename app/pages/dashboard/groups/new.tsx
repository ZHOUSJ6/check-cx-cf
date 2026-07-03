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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { searchParam } from "../_shared"

export default function NewGroupPage() {
  const [error, setError] = useState<string | null>(searchParam("error") || null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    const formData = new FormData(event.currentTarget)
    const payload = {
      groupName: String(formData.get("group_name") ?? ""),
      websiteUrl: String(formData.get("website_url") ?? "") || null,
      tags: String(formData.get("tags") ?? ""),
    }
    try {
      const res = await fetch("/api/admin/groups", {
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
    window.location.assign("/dashboard/groups?success=" + encodeURIComponent("分组已创建"))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="新增分组"
        description="分组是文本关联，不是外键。改名要谨慎。"
        actions={
          <a href="/dashboard/groups" className={buttonVariants({ variant: "outline" })}>
            返回列表
          </a>
        }
      />
      {error ? <Notice title="保存失败" description={error} variant="warning" /> : null}
      <Card>
        <CardHeader>
          <CardTitle>分组信息</CardTitle>
          <CardDescription>标签使用英文逗号分隔，便于保持结构简单。</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-5">
            <div className="space-y-2">
              <Label htmlFor="group_name">分组名称</Label>
              <Input id="group_name" name="group_name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website_url">网站地址</Label>
              <Input
                id="website_url"
                name="website_url"
                placeholder="https://example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tags">标签</Label>
              <Input id="tags" name="tags" placeholder="official,public,fast" />
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={submitting}>创建分组</Button>
              <a href="/dashboard/groups">
                <Button variant="outline" type="button">取消</Button>
              </a>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
