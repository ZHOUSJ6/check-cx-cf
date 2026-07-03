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
import { formatDateTime } from "@/lib/admin/format"
import { adminJson } from "@/lib/admin-fetch"
import type { GroupInfoRecord } from "@/lib/admin-types"
import { mapGroup, searchParam } from "../_shared"

function groupIdFromPath() {
  const match = window.location.pathname.match(/\/dashboard\/groups\/([^/]+)$/)
  return match && match[1] ? decodeURIComponent(match[1]) : ""
}

export default function EditGroupPage() {
  const id = typeof window !== "undefined" ? groupIdFromPath() : ""
  const [group, setGroup] = useState<GroupInfoRecord | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error] = useState<string | null>(searchParam("error") || null)
  const success = searchParam("success")

  useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await adminJson<{ groups: Record<string, unknown>[] }>(
        "/api/admin/groups"
      ).catch(() => ({ groups: [] as Record<string, unknown>[] }))
      if (cancelled) return
      const raw = res.groups.find((row) => String(row.id) === id)
      if (!raw) {
        setNotFound(true)
        return
      }
      setGroup(mapGroup(raw))
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
      groupName: String(formData.get("group_name") ?? ""),
      websiteUrl: String(formData.get("website_url") ?? "") || null,
      tags: String(formData.get("tags") ?? ""),
    }
    try {
      const res = await fetch(`/api/admin/groups/${id}`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}))
        window.location.assign(
          `/dashboard/groups/${id}?error=${encodeURIComponent(
            (detail as { error?: string }).error ?? `保存失败: ${res.status}`
          )}`
        )
        return
      }
    } catch {
      window.location.assign(
        `/dashboard/groups/${id}?error=${encodeURIComponent("网络错误，请重试")}`
      )
      return
    }
    window.location.assign(`/dashboard/groups?success=${encodeURIComponent("分组已更新")}`)
  }

  async function handleDelete() {
    try {
      const res = await fetch(`/api/admin/groups/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}))
        window.location.assign(
          `/dashboard/groups/${id}?error=${encodeURIComponent(
            (detail as { error?: string }).error ?? `删除失败: ${res.status}`
          )}`
        )
        return
      }
    } catch {
      window.location.assign(
        `/dashboard/groups/${id}?error=${encodeURIComponent("网络错误，请重试")}`
      )
      return
    }
    window.location.assign(`/dashboard/groups?success=${encodeURIComponent("分组已删除")}`)
  }

  if (notFound) {
    return (
      <div className="space-y-6">
        <PageHeader title="分组不存在" />
        <a href="/dashboard/groups" className={buttonVariants({ variant: "outline" })}>返回列表</a>
      </div>
    )
  }

  if (!group) {
    return (
      <div className="space-y-6">
        <PageHeader title="加载中…" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`编辑：${group.group_name}`}
        description={`创建于 ${formatDateTime(group.created_at)}，更新于 ${formatDateTime(group.updated_at)}`}
        actions={
          <a href="/dashboard/groups" className={buttonVariants({ variant: "outline" })}>
            返回列表
          </a>
        }
      />
      {success ? <Notice title="保存成功" description={success} variant="success" /> : null}
      {error ? <Notice title="保存失败" description={error} variant="warning" /> : null}
      <Card>
        <CardHeader>
          <CardTitle>分组信息</CardTitle>
          <CardDescription>
            如果要改 `group_name`，先确保对应配置也会同步调整。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-5">
            <input type="hidden" name="id" value={id} />
            <div className="space-y-2">
              <Label htmlFor="group_name">分组名称</Label>
              <Input id="group_name" name="group_name" defaultValue={group.group_name} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website_url">网站地址</Label>
              <Input id="website_url" name="website_url" defaultValue={group.website_url ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tags">标签</Label>
              <Input id="tags" name="tags" defaultValue={group.tags ?? ""} />
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={submitting}>保存更改</Button>
              <a href="/dashboard/groups">
                <Button variant="outline" type="button">取消</Button>
              </a>
            </div>
          </form>
          <div className="mt-6 border-t pt-6">
            <Button type="button" variant="destructive" onClick={handleDelete}>
              删除分组
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
