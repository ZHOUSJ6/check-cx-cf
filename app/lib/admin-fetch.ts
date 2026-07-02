/**
 * Browser-side admin API helpers. Used by dashboard route actions to forward
 * form submissions to /api/admin/* with the session cookie attached.
 */

export async function adminFetch(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(path, {
    ...options,
    credentials: "same-origin",
    headers: {
      ...(options.headers ?? {}),
    },
  });
}

export async function adminJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await adminFetch(path, options);
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error((detail as { error?: string }).error ?? `请求失败: ${res.status}`);
  }
  return (await res.json()) as T;
}
