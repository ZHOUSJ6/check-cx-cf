"use client"

import { deleteTemplateAction } from "@/lib/admin-actions"
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

type TemplateRowActionsProps = {
  id: string
  name: string
  modelCount: number
}

export function TemplateRowActions({ id, name, modelCount }: TemplateRowActionsProps) {
  const isDeleteDisabled = modelCount > 0

  return (
    <div className="flex items-center gap-2">
      <a
        href={`/dashboard/templates/${id}`}
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
          <AlertDialogTrigger render={<Button type="button" variant="destructive" />}>
            删除
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除模板？</AlertDialogTitle>
              <AlertDialogDescription>
                将删除模板「{name}」。当前没有模型引用它，但删除后无法恢复。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => void deleteTemplateAction(id).then(() => window.location.reload())}
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
