"use client"

import { useEffect, useState } from "react"

import { Notice } from "@/components/admin/notice"
import { PageHeader } from "@/components/admin/page-header"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatDateTime, splitTags } from "@/lib/admin/format"
import { adminJson } from "@/lib/admin-fetch"
import type { GroupInfoRecord } from "@/lib/admin-types"
import { mapGroup, searchParam } from "../_shared"

export default function GroupsPage() {
  const error = searchParam("error")
  const success = searchParam("success")
  const [groups, setGroups] = useState<GroupInfoRecord[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await adminJson<{ groups: Record<string, unknown>[] }>(
        "/api/admin/groups"
      ).catch(() => ({ groups: [] as Record<string, unknown>[] }))
      if (cancelled) return
      setGroups(res.groups.map(mapGroup))
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="分组信息"
        description="维护前台展示所需的分组元数据。"
        actions={
          <a href="/dashboard/groups/new" className={buttonVariants()}>新增分组</a>
        }
      />
      {success ? <Notice title="操作成功" description={success} variant="success" /> : null}
      {error ? <Notice title="操作失败" description={error} variant="warning" /> : null}
      <Card>
        <CardHeader>
          <CardTitle>分组列表</CardTitle>
          <CardDescription>
            这里与 `check_configs.group_name` 是文本关联，修改名称前请先确认前台展示与配置引用。
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b">
                <th className="py-3 pr-4 font-medium">分组名</th>
                <th className="py-3 pr-4 font-medium">网站</th>
                <th className="py-3 pr-4 font-medium">标签</th>
                <th className="py-3 pr-4 font-medium">更新时间</th>
                <th className="py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group.id} className="border-b align-top last:border-0">
                  <td className="py-3 pr-4 font-medium">{group.group_name}</td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {group.website_url ?? "-"}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-wrap gap-2">
                      {splitTags(group.tags).length > 0 ? (
                        splitTags(group.tags).map((tag) => (
                          <Badge key={tag} variant="outline">
                            {tag}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {formatDateTime(group.updated_at)}
                  </td>
                  <td className="py-3 text-right">
                    <a href={`/dashboard/groups/${group.id}`} className={buttonVariants({ variant: "outline" })}>
                      编辑
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
