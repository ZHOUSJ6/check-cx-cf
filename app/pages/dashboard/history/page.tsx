"use client"

import { useEffect, useState } from "react"

import { PageHeader } from "@/components/admin/page-header"
import { HistoryStatusBadge } from "@/components/admin/status-badge"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { formatDateTime } from "@/lib/admin/format"
import { adminJson } from "@/lib/admin-fetch"
import type { CheckHistoryRecord } from "@/lib/admin-types"
import { mapHistory } from "../_shared"

export default function HistoryPage() {
  const [history, setHistory] = useState<CheckHistoryRecord[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await adminJson<{ history: Record<string, unknown>[] }>(
        "/api/admin/history?limit=200"
      ).catch(() => ({ history: [] as Record<string, unknown>[] }))
      if (cancelled) return
      setHistory(res.history.map(mapHistory))
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="历史记录"
        description="查看问题分布和最近结果，便于排查运行情况。"
      />
      <Card>
        <CardHeader>
          <CardTitle>最近 200 条检测结果</CardTitle>
          <CardDescription>
            这里用于查看最近结果；如需调整配置，请返回对应配置页面。
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b">
                <th className="py-3 pr-4 font-medium">检测时间</th>
                <th className="py-3 pr-4 font-medium">配置</th>
                <th className="py-3 pr-4 font-medium">状态</th>
                <th className="py-3 pr-4 font-medium">延迟</th>
                <th className="py-3 pr-4 font-medium">Ping</th>
                <th className="py-3 pr-4 font-medium">分组</th>
                <th className="py-3 pr-4 font-medium">消息</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id} className="border-b align-top last:border-0">
                  <td className="py-3 pr-4 text-muted-foreground">
                    {formatDateTime(item.checked_at)}
                  </td>
                  <td className="py-3 pr-4 font-medium">
                    {item.config_name ?? item.config_id}
                  </td>
                  <td className="py-3 pr-4">
                    <HistoryStatusBadge status={item.status} />
                  </td>
                  <td className="py-3 pr-4">
                    <Badge variant="outline">{item.latency_ms ?? "-"} ms</Badge>
                  </td>
                  <td className="py-3 pr-4">
                    <Badge variant="outline">{item.ping_latency_ms ?? "-"} ms</Badge>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {item.group_name ?? "-"}
                  </td>
                  <td className="max-w-[320px] py-3 pr-4 text-muted-foreground">
                    {item.message ?? "-"}
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
