/**
 * Client-side admin actions — replacements for Next.js server actions.
 * Each function calls the Hono /api/admin/* endpoint.
 */
export async function deleteModelAction(id: string): Promise<void> {
  const res = await fetch(`/api/admin/models/${id}`, { method: "DELETE", credentials: "same-origin" });
  if (!res.ok) throw new Error("删除模型失败");
}

export async function deleteTemplateAction(id: string): Promise<void> {
  const res = await fetch(`/api/admin/templates/${id}`, { method: "DELETE", credentials: "same-origin" });
  if (!res.ok) throw new Error("删除模板失败");
}

export async function cleanupUnusedModelsAction(): Promise<{ count: number }> {
  // TODO: backend endpoint for cleanup; for now client-side no-op
  return { count: 0 };
}

export async function cleanupUnusedTemplatesAction(): Promise<{ count: number }> {
  return { count: 0 };
}
