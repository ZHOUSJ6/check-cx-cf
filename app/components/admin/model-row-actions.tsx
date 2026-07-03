"use client"

import { deleteModelAction } from "@/lib/admin-actions"
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
import { Button, buttonVariants } from "@/components/ui/button"

type ModelRowActionsProps = {
  id: string
  model: string
  configCount: number
}

export function ModelRowActions({ id, model, configCount }: ModelRowActionsProps) {
  const isDeleteDisabled = configCount > 0

  return (
    <div className="flex items-center gap-2">
      <a
        href={`/dashboard/models/${id}`}
        className={buttonVariants({ variant: "outline" })}
      >
        编辑
      </a>
      {isDeleteDisabled ? (
        <Button type="button" variant="destructive" disabled>
          删除
        </Button>
      ) : (
        <AlertDialog>
          <AlertDialogTrigger
            render={<Button type="button" variant="destructive" />}
          >
            删除
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除模型？</AlertDialogTitle>
              <AlertDialogDescription>
                将删除模型「{model}」。当前没有配置引用它，但删除后无法恢复。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => void deleteModelAction(id).then(() => window.location.reload())}
              >
                确认删除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
