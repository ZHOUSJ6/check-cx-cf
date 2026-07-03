"use client"

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { CopyIcon, EraserIcon, GlobeIcon, KeyRoundIcon, PencilIcon, ShuffleIcon } from "lucide-react"

import { BooleanBadge, ProviderBadge } from "@/components/admin/status-badge"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { nativeFormControlClassName, nativeSelectClassName } from "@/lib/admin-forms"
import { formatDate, formatDateTime, maskSecret } from "@/lib/admin/format"
import type { CheckConfigRecord, CheckModelRecord, ProviderType } from "@/lib/admin-types"

type ConfigsTableProps = {
  configs: CheckConfigRecord[]
  models: CheckModelRecord[]
  returnPath: string
}

function formatTemplateLabel(value: string) {
  const chars = Array.from(value)
  return chars.length > 10 ? `${chars.slice(0, 10).join("")}...` : value
}

function getSingleProviderType(configs: CheckConfigRecord[], selectedIds: string[]): ProviderType | null {
  const selectedTypes = Array.from(
    new Set(
      configs
        .filter((item) => selectedIds.includes(item.id))
        .map((item) => item.type)
    )
  )

  return selectedTypes.length === 1 ? selectedTypes[0] ?? null : null
}

export function ConfigsTable({ configs, models, returnPath }: ConfigsTableProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isReplaceModelOpen, setIsReplaceModelOpen] = useState(false)
  const [isReplaceKeyOpen, setIsReplaceKeyOpen] = useState(false)
  const [isReplaceEndpointOpen, setIsReplaceEndpointOpen] = useState(false)
  const [isReplaceNameOpen, setIsReplaceNameOpen] = useState(false)
  const [targetModelId, setTargetModelId] = useState("")
  const [targetApiKey, setTargetApiKey] = useState("")
  const [targetEndpoint, setTargetEndpoint] = useState("")
  const [targetName, setTargetName] = useState("")
  const selectAllRef = useRef<HTMLInputElement>(null)
  const configIds = useMemo(() => configs.map((item) => item.id), [configs])
  const configIdSet = useMemo(() => new Set(configIds), [configIds])
  const visibleSelectedIds = useMemo(
    () => selectedIds.filter((id) => configIdSet.has(id)),
    [configIdSet, selectedIds]
  )
  const visibleSelectedSet = useMemo(() => new Set(visibleSelectedIds), [visibleSelectedIds])

  useEffect(() => {
    if (!selectAllRef.current) {
      return
    }

    const allSelected = configs.length > 0 && visibleSelectedIds.length === configs.length
    const someSelected = visibleSelectedIds.length > 0 && !allSelected
    selectAllRef.current.indeterminate = someSelected
  }, [configs.length, visibleSelectedIds])

  const allSelected = configs.length > 0 && visibleSelectedIds.length === configs.length
  const hasSelection = visibleSelectedIds.length > 0
  const selectedProviderType = useMemo(
    () => getSingleProviderType(configs, visibleSelectedIds),
    [configs, visibleSelectedIds]
  )
  const filteredModels = useMemo(
    () => (selectedProviderType ? models.filter((item) => item.type === selectedProviderType) : []),
    [models, selectedProviderType]
  )
  const hasMixedTypes = hasSelection && !selectedProviderType
  const resolvedTargetModelId = useMemo(() => {
    if (!selectedProviderType) {
      return ""
    }

    if (targetModelId && filteredModels.some((item) => item.id === targetModelId)) {
      return targetModelId
    }

    return filteredModels[0]?.id ?? ""
  }, [filteredModels, selectedProviderType, targetModelId])

  function toggleConfig(id: string, checked: boolean) {
    setSelectedIds((current) => {
      if (checked) {
        return current.includes(id) ? current : [...current, id]
      }

      return current.filter((item) => item !== id)
    })
  }

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? configIds : [])
  }

  /** Forward a batch operation to /api/admin/configs/batch then reload. */
  async function runBatch(operation: string, extra?: Record<string, unknown>) {
    const body = { ids: visibleSelectedIds, operation, ...(extra ?? {}) }
    try {
      const res = await fetch("/api/admin/configs/batch", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}))
        const message = (detail as { error?: string }).error ?? `操作失败: ${res.status}`
        window.location.assign(
          `/dashboard/configs?error=${encodeURIComponent(message)}`
        )
        return
      }
    } catch {
      window.location.assign(`/dashboard/configs?error=${encodeURIComponent("网络错误，请重试")}`)
      return
    }
    window.location.assign(returnPath || "/dashboard/configs")
  }

  /** Clear history for a single config. */
  async function clearSingleHistory(id: string) {
    try {
      const res = await fetch(`/api/admin/configs/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      })
      if (!res.ok) throw new Error("清理失败")
    } catch {
      window.location.assign(
        `/dashboard/configs?error=${encodeURIComponent("清理历史失败")}`
      )
      return
    }
    window.location.assign(returnPath || "/dashboard/configs")
  }

  function handleBatchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const operation = String(formData.get("operation") ?? "")
    if (!operation || !hasSelection) return

    if (operation === "replace_model" && !resolvedTargetModelId) return
    if (operation === "replace_model") {
      void runBatch("replace_model", { target_model_id: resolvedTargetModelId })
    } else if (operation === "replace_key") {
      const value = String(formData.get("target_api_key") ?? "").trim()
      if (!value) return
      void runBatch("replace_key", { target_api_key: value })
    } else if (operation === "replace_endpoint") {
      const value = String(formData.get("target_endpoint") ?? "").trim()
      if (!value) return
      void runBatch("replace_endpoint", { target_endpoint: value })
    } else if (operation === "replace_name") {
      const value = String(formData.get("target_name") ?? "").trim()
      if (!value) return
      void runBatch("replace_name", { target_name: value })
    } else {
      void runBatch(operation)
    }
  }

  return (
    <form id="batch-config-form" onSubmit={handleBatchSubmit} className="space-y-4">
      <input type="hidden" name="return_to" value={returnPath} />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/30 p-3">
        <div className="text-sm text-muted-foreground">
          {hasSelection
            ? `已选 ${visibleSelectedIds.length} 条。批量操作只打在这批配置上。`
            : "先勾选配置，再做批量启停、维护切换或删除。"}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" name="operation" value="enable" className="hidden" />
          <Button type="submit" name="operation" value="enable" variant="outline" disabled={!hasSelection}>
            批量启用
          </Button>
          <Button type="submit" name="operation" value="disable" variant="outline" disabled={!hasSelection}>
            批量停用
          </Button>
          <Button
            type="submit"
            name="operation"
            value="maintenance_on"
            variant="outline"
            disabled={!hasSelection}
          >
            批量维护
          </Button>
          <Button
            type="submit"
            name="operation"
            value="maintenance_off"
            variant="outline"
            disabled={!hasSelection}
          >
            取消维护
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!hasSelection}
            onClick={() => {
              setTargetModelId(resolvedTargetModelId)
              setIsReplaceModelOpen(true)
            }}
          >
            <ShuffleIcon />
            批量换模型
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!hasSelection}
            onClick={() => {
              setTargetApiKey("")
              setIsReplaceKeyOpen(true)
            }}
          >
            <KeyRoundIcon />
            批量换密钥
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!hasSelection}
            onClick={() => {
              setTargetEndpoint("")
              setIsReplaceEndpointOpen(true)
            }}
          >
            <GlobeIcon />
            批量换地址
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!hasSelection}
            onClick={() => {
              setTargetName("")
              setIsReplaceNameOpen(true)
            }}
          >
            <PencilIcon />
            批量换名称
          </Button>
          <AlertDialog>
            <AlertDialogTrigger
              render={<Button type="button" variant="destructive" disabled={!hasSelection} />}
            >
              批量清理历史
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认批量清理请求历史？</AlertDialogTitle>
                <AlertDialogDescription>
                  将清理选中的 {visibleSelectedIds.length} 条配置在 `check_history` 里的全部请求历史。
                  这不会删除配置本身，但历史记录不可恢复。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={!hasSelection}
                  onClick={() => void runBatch("clear_history")}
                >
                  确认清理
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <AlertDialog>
            <AlertDialogTrigger
              render={<Button type="button" variant="destructive" disabled={!hasSelection} />}
            >
              批量删除
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认批量删除配置？</AlertDialogTitle>
                <AlertDialogDescription>
                  将删除选中的 {visibleSelectedIds.length} 条配置，相关检测历史也会一起被级联删除。
                  这个操作不可恢复。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={!hasSelection}
                  onClick={() => void runBatch("delete")}
                >
                  确认删除
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1320px] table-fixed text-left text-sm">
          <colgroup>
            <col style={{ width: "44px" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "15%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "180px" }} />
          </colgroup>
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="py-3 pr-2 text-center">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  aria-label="全选当前列表"
                  checked={allSelected}
                  onChange={(event) => toggleAll(event.target.checked)}
                />
              </th>
              <th className="py-3 pr-4">名称</th>
              <th className="py-3 pr-4">Provider</th>
              <th className="py-3 pr-4">模型</th>
              <th className="py-3 pr-4">分组</th>
              <th className="py-3 pr-4">模板</th>
              <th className="py-3 pr-4">状态</th>
              <th className="py-3 pr-4">Key</th>
              <th className="py-3">更新时间</th>
              <th className="py-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {configs.length > 0 ? (
              configs.map((item) => (
                <tr key={item.id} className="border-b align-top last:border-0">
                  <td className="py-3 pr-2 text-center">
                    <input
                      type="checkbox"
                      name="ids"
                      value={item.id}
                      aria-label={`选中 ${item.name}`}
                      checked={visibleSelectedSet.has(item.id)}
                      onChange={(event) => toggleConfig(item.id, event.target.checked)}
                    />
                  </td>
                  <td className="py-3 pr-4">
                    <a href={`/dashboard/configs/${item.id}`} className="font-medium hover:underline">
                      {item.name}
                    </a>
                    <div className="mt-1 line-clamp-2 break-all text-xs text-muted-foreground" title={item.endpoint}>
                      {item.endpoint}
                    </div>
                  </td>
                  <td className="py-3 pr-4"><ProviderBadge type={item.type} /></td>
                  <td className="py-3 pr-4">
                    <div className="truncate" title={item.model ?? ""}>
                      {item.model ?? "-"}
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="truncate" title={item.group_name || "-"}>
                      {item.group_name || "-"}
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <div
                      className="truncate"
                      title={item.template_name ?? "-"}
                    >
                      {item.template_name ? formatTemplateLabel(item.template_name) : "-"}
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-wrap gap-2">
                      <BooleanBadge active={Boolean(item.enabled)} trueLabel="启用" falseLabel="停用" />
                      <BooleanBadge active={Boolean(item.is_maintenance)} trueLabel="维护中" falseLabel="非维护" />
                    </div>
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs">
                    <div className="truncate" title={maskSecret(item.api_key)}>
                      {maskSecret(item.api_key)}
                    </div>
                  </td>
                  <td className="py-3" title={formatDateTime(item.updated_at)}>{formatDate(item.updated_at)}</td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-2">
                      <a href={`/dashboard/configs/new?source=${item.id}`}>
                        <Button variant="outline" type="button">
                          <CopyIcon />
                          复制
                        </Button>
                      </a>
                      <AlertDialog>
                        <AlertDialogTrigger render={<Button type="button" variant="destructive" />}>
                          <EraserIcon />
                          清理历史
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>确认清理这条配置的请求历史？</AlertDialogTitle>
                            <AlertDialogDescription>
                              将清理配置「{item.name}」在 `check_history` 里的全部请求历史。
                              这不会删除配置本身，但历史记录不可恢复。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction
                              variant="destructive"
                              onClick={() => clearSingleHistory(item.id)}
                            >
                              确认清理
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={10} className="py-10 text-center text-sm text-muted-foreground">
                  没有匹配的配置，请调整筛选条件后重试。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Sheet open={isReplaceModelOpen && hasSelection} onOpenChange={setIsReplaceModelOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>批量更换引用模型</SheetTitle>
            <SheetDescription>
              {hasSelection
                ? `当前选中 ${visibleSelectedIds.length} 条配置。只允许同一 Provider 类型一起替换。`
                : "先在列表里勾选配置，再批量更换模型。"}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 px-6">
            <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
              <div>已选配置：{visibleSelectedIds.length}</div>
              <div>
                Provider：
                {selectedProviderType ? (
                  <span className="font-medium text-foreground">{selectedProviderType}</span>
                ) : hasSelection ? (
                  <span className="font-medium text-destructive">包含多个类型，不能批量替换</span>
                ) : (
                  <span>未选择</span>
                )}
              </div>
            </div>
            <label className="space-y-2">
              <span className="text-sm font-medium">目标模型</span>
              <select
                name="target_model_id"
                value={resolvedTargetModelId}
                onChange={(event) => setTargetModelId(event.target.value)}
                className={nativeSelectClassName}
                disabled={!selectedProviderType || filteredModels.length === 0}
                required
              >
                {filteredModels.length === 0 ? (
                  <option value="">
                    {selectedProviderType ? "当前类型下没有可选模型" : "请先选择同类型配置"}
                  </option>
                ) : null}
                {filteredModels.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.model}
                    {item.template_name ? ` · ${item.template_name}` : ""}
                  </option>
                ))}
              </select>
            </label>
            {hasMixedTypes ? (
              <p className="text-sm text-destructive">
                当前选中的配置包含多个 Provider 类型。请先筛选或分批选择后再更换模型。
              </p>
            ) : null}
          </div>
          <SheetFooter>
            <Button
              type="button"
              disabled={!hasSelection || hasMixedTypes || !resolvedTargetModelId}
              onClick={() => {
                setIsReplaceModelOpen(false)
                void runBatch("replace_model", { target_model_id: resolvedTargetModelId })
              }}
            >
              确认替换
            </Button>
            <Button type="button" variant="outline" onClick={() => setIsReplaceModelOpen(false)}>
              取消
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <Sheet open={isReplaceKeyOpen && hasSelection} onOpenChange={setIsReplaceKeyOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>批量替换密钥</SheetTitle>
            <SheetDescription>
              将选中的 {visibleSelectedIds.length} 条配置的 API Key 统一替换为新值。
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 px-6">
            <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
              已选配置：{visibleSelectedIds.length}
            </div>
            <label className="space-y-2">
              <span className="text-sm font-medium">新 API Key</span>
              <input
                type="password"
                value={targetApiKey}
                onChange={(event) => setTargetApiKey(event.target.value)}
                placeholder="输入新的 API Key"
                className={nativeFormControlClassName}
                required
                autoComplete="off"
              />
            </label>
          </div>
          <SheetFooter>
            <Button
              type="button"
              disabled={!hasSelection || !targetApiKey.trim()}
              onClick={() => {
                const value = targetApiKey.trim()
                setIsReplaceKeyOpen(false)
                if (value) void runBatch("replace_key", { target_api_key: value })
              }}
            >
              确认替换
            </Button>
            <Button type="button" variant="outline" onClick={() => setIsReplaceKeyOpen(false)}>
              取消
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <Sheet open={isReplaceEndpointOpen && hasSelection} onOpenChange={setIsReplaceEndpointOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>批量替换地址</SheetTitle>
            <SheetDescription>
              将选中的 {visibleSelectedIds.length} 条配置的 API 端点地址统一替换为新值。
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 px-6">
            <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
              已选配置：{visibleSelectedIds.length}
            </div>
            <label className="space-y-2">
              <span className="text-sm font-medium">新 API 地址</span>
              <input
                type="url"
                value={targetEndpoint}
                onChange={(event) => setTargetEndpoint(event.target.value)}
                placeholder="https://api.example.com/v1"
                className={nativeFormControlClassName}
                required
                autoComplete="off"
              />
            </label>
          </div>
          <SheetFooter>
            <Button
              type="button"
              disabled={!hasSelection || !targetEndpoint.trim()}
              onClick={() => {
                const value = targetEndpoint.trim()
                setIsReplaceEndpointOpen(false)
                if (value) void runBatch("replace_endpoint", { target_endpoint: value })
              }}
            >
              确认替换
            </Button>
            <Button type="button" variant="outline" onClick={() => setIsReplaceEndpointOpen(false)}>
              取消
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <Sheet open={isReplaceNameOpen && hasSelection} onOpenChange={setIsReplaceNameOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>批量替换名称</SheetTitle>
            <SheetDescription>
              将选中的 {visibleSelectedIds.length} 条配置的显示名称统一替换为新值。
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 px-6">
            <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
              已选配置：{visibleSelectedIds.length}
            </div>
            <label className="space-y-2">
              <span className="text-sm font-medium">新名称</span>
              <input
                type="text"
                value={targetName}
                onChange={(event) => setTargetName(event.target.value)}
                placeholder="输入新的显示名称"
                className={nativeFormControlClassName}
                required
                autoComplete="off"
              />
            </label>
          </div>
          <SheetFooter>
            <Button
              type="button"
              disabled={!hasSelection || !targetName.trim()}
              onClick={() => {
                const value = targetName.trim()
                setIsReplaceNameOpen(false)
                if (value) void runBatch("replace_name", { target_name: value })
              }}
            >
              确认替换
            </Button>
            <Button type="button" variant="outline" onClick={() => setIsReplaceNameOpen(false)}>
              取消
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </form>
  )
}
