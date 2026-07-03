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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { nativeSelectClassName } from "@/lib/admin-forms"
import { formatDateTime } from "@/lib/admin/format"
import { adminJson } from "@/lib/admin-fetch"
import type { SystemNotificationRecord } from "@/lib/admin-types"
import { mapNotification, searchParam } from "../_shared"

function notificationIdFromPath() {
  const match = window.location.pathname.match(/\/dashboard\/notifications\/([^/]+)$/)
  return match && match[1] ? decodeURIComponent(match[1]) : ""
}

export default function EditNotificationPage() {
  const id = typeof window !== "undefined" ? notificationIdFromPath() : ""
  const [notification, setNotification] = useState<SystemNotificationRecord | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error] = useState<string | null>(searchParam("error") || null)
  const success = searchParam("success")

  useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await adminJson<{ notifications: Record<string, unknown>[] }>(
        "/api/admin/notifications"
      ).catch(() => ({ notifications: [] as Record<string, unknown>[] }))
      if (cancelled) return
      const raw = res.notifications.find((row) => String(row.id) === id)
      if (!raw) {
        setNotFound(true)
        return
      }
      setNotification(mapNotification(raw))
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
    const payload = {
      message: String(formData.get("message") ?? ""),
      level: String(formData.get("level") ?? "info"),
      isActive: formData.get("is_active") === "on",
    }
    try {
      const res = await fetch(`/api/admin/notifications/${id}`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}))
        window.location.assign(
          `/dashboard/notifications/${id}?error=${encodeURIComponent(
            (detail as { error?: string }).error ?? `保存失败: ${res.status}`
          )}`
        )
        return
      }
    } catch {
      window.location.assign(
        `/dashboard/notifications/${id}?error=${encodeURIComponent("网络错误，请重试")}`
      )
      return
    }
    window.location.assign(`/dashboard/notifications?success=${encodeURIComponent("通知已更新")}`)
  }

  async function handleDelete() {
    try {
      const res = await fetch(`/api/admin/notifications/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}))
        window.location.assign(
          `/dashboard/notifications/${id}?error=${encodeURIComponent(
            (detail as { error?: string }).error ?? `删除失败: ${res.status}`
          )}`
        )
        return
      }
    } catch {
      window.location.assign(
        `/dashboard/notifications/${id}?error=${encodeURIComponent("网络错误，请重试")}`
      )
      return
    }
    window.location.assign(`/dashboard/notifications?success=${encodeURIComponent("通知已删除")}`)
  }

  if (notFound) {
    return (
      <div className="space-y-6">
        <PageHeader title="通知不存在" />
        <a href="/dashboard/notifications" className={buttonVariants({ variant: "outline" })}>返回列表</a>
      </div>
    )
  }

  if (!notification) {
    return (
      <div className="space-y-6">
        <PageHeader title="加载中…" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="编辑系统通知"
        description={`创建于 ${formatDateTime(notification.created_at)}`}
        actions={
          <a href="/dashboard/notifications" className={buttonVariants({ variant: "outline" })}>
            返回列表
          </a>
        }
      />
      {success ? <Notice title="保存成功" description={success} variant="success" /> : null}
      {error ? <Notice title="保存失败" description={error} variant="warning" /> : null}
      <Card>
        <CardHeader>
          <CardTitle>通知内容</CardTitle>
          <CardDescription>
            激活状态和级别会直接影响前台展示，请按实际运营需求维护。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-5">
            <input type="hidden" name="id" value={id} />
            <div className="space-y-2">
              <Label htmlFor="message">通知内容</Label>
              <Textarea
                id="message"
                name="message"
                rows={8}
                defaultValue={notification.message}
                required
              />
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="level">通知级别</Label>
                <select
                  id="level"
                  name="level"
                  className={nativeSelectClassName}
                  defaultValue={notification.level ?? "info"}
                >
                  <option value="info">信息</option>
                  <option value="warning">警告</option>
                  <option value="error">错误</option>
                </select>
              </div>
              <div className="flex items-center pt-7 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="is_active"
                    defaultChecked={Boolean(notification.is_active)}
                  />
                  显示中
                </label>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={submitting}>保存更改</Button>
              <a href="/dashboard/notifications">
                <Button variant="outline" type="button">取消</Button>
              </a>
            </div>
          </form>
          <div className="mt-6 border-t pt-6">
            <Button type="button" variant="destructive" onClick={handleDelete}>
              删除通知
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
