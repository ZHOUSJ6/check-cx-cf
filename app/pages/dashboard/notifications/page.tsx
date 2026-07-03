"use client"

import { useEffect, useState } from "react"

import { Notice } from "@/components/admin/notice"
import { MarkdownPreview } from "@/components/admin/markdown-preview"
import { PageHeader } from "@/components/admin/page-header"
import { NotificationLevelBadge } from "@/components/admin/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatDateTime } from "@/lib/admin/format"
import { adminJson } from "@/lib/admin-fetch"
import type { SystemNotificationRecord } from "@/lib/admin-types"
import { mapNotification, searchParam } from "../_shared"

export default function NotificationsPage() {
  const error = searchParam("error")
  const success = searchParam("success")
  const [notifications, setNotifications] = useState<SystemNotificationRecord[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await adminJson<{ notifications: Record<string, unknown>[] }>(
        "/api/admin/notifications"
      ).catch(() => ({ notifications: [] as Record<string, unknown>[] }))
      if (cancelled) return
      setNotifications(res.notifications.map(mapNotification))
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  async function toggleActive(id: string, currentActive: boolean) {
    try {
      const res = await fetch(`/api/admin/notifications/${id}`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentActive }),
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}))
        window.location.assign(
          `/dashboard/notifications?error=${encodeURIComponent(
            (detail as { error?: string }).error ?? `操作失败: ${res.status}`
          )}`
        )
        return
      }
    } catch {
      window.location.assign(
        `/dashboard/notifications?error=${encodeURIComponent("网络错误，请重试")}`
      )
      return
    }
    window.location.assign("/dashboard/notifications")
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="系统通知"
        description="维护前台横幅通知内容和显示状态。"
        actions={
          <a href="/dashboard/notifications/new" className={buttonVariants()}>
            新增通知
          </a>
        }
      />
      {success ? <Notice title="操作成功" description={success} variant="success" /> : null}
      {error ? <Notice title="操作失败" description={error} variant="warning" /> : null}
      <Card>
        <CardHeader>
          <CardTitle>通知列表</CardTitle>
          <CardDescription>
            编辑仍然是纯文本输入，但下面的预览按 Markdown 渲染。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {notifications.map((notification) => (
            <div key={notification.id} className="rounded-lg border p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <NotificationLevelBadge level={notification.level} />
                  <Badge variant={notification.is_active ? "default" : "outline"}>
                    {notification.is_active ? "显示中" : "已停用"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(notification.created_at)}
                  </span>
                  <Button
                    type="button"
                    variant={notification.is_active ? "outline" : "default"}
                    onClick={() => toggleActive(notification.id, notification.is_active)}
                  >
                    {notification.is_active ? "隐藏" : "显示"}
                  </Button>
                  <a
                    href={`/dashboard/notifications/${notification.id}`}
                    className={buttonVariants({ variant: "outline" })}
                  >
                    编辑
                  </a>
                </div>
              </div>
              <MarkdownPreview content={notification.message} className="text-muted-foreground" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
