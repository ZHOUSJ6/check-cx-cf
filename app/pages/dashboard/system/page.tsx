"use client"

import { useEffect, useState } from "react"

import { PageHeader } from "@/components/admin/page-header"
import { ProviderBadge } from "@/components/admin/status-badge"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { adminJson } from "@/lib/admin-fetch"
import type { CheckConfigRecord } from "@/lib/admin-types"
import { mapConfig } from "../_shared"

export default function SystemPage() {
  const [configs, setConfigs] = useState<CheckConfigRecord[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await adminJson<{ configs: Record<string, unknown>[] }>(
        "/api/admin/configs"
      ).catch(() => ({ configs: [] as Record<string, unknown>[] }))
      if (cancelled) return
      setConfigs(res.configs.map(mapConfig))
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title="运行状态"
        description="查看关键运行信息，包括配置可用性。"
      />
      <Card>
        <CardHeader>
          <CardTitle>配置可用性</CardTitle>
          <CardDescription>
            可用性统计需要后台数据源支持；这里先列出当前配置及运行状态。
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b">
                <th className="py-3 pr-4 font-medium">配置</th>
                <th className="py-3 pr-4 font-medium">类型</th>
                <th className="py-3 pr-4 font-medium">7 天</th>
                <th className="py-3 pr-4 font-medium">15 天</th>
                <th className="py-3 pr-4 font-medium">30 天</th>
                <th className="py-3 pr-4 font-medium">状态</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((config) => (
                <tr key={config.id} className="border-b last:border-0">
                  <td className="py-3 pr-4 font-medium">{config.name}</td>
                  <td className="py-3 pr-4"><ProviderBadge type={config.type} /></td>
                  <td className="py-3 pr-4">-</td>
                  <td className="py-3 pr-4">-</td>
                  <td className="py-3 pr-4">-</td>
                  <td className="space-x-2 py-3 pr-4">
                    <Badge variant={config.enabled ? "default" : "outline"}>
                      {config.enabled ? "启用" : "停用"}
                    </Badge>
                    <Badge variant={config.is_maintenance ? "secondary" : "outline"}>
                      {config.is_maintenance ? "维护中" : "正常"}
                    </Badge>
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
