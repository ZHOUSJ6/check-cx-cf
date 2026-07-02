import { Form, useActionData, useNavigation } from "react-router";
import { Github } from "lucide-react";
import type { Route } from "./+types/login";

interface ActionResult {
  error?: string;
}

// Server action: handle email/password sign-in via Better Auth.
// (GitHub OAuth is initiated client-side — see the GitHub button onClick.)
export async function action({ request }: Route.ActionArgs): Promise<ActionResult | Response> {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "请输入邮箱和密码" };
  }

  const origin = new URL(request.url).origin;
  const res = await fetch(`${origin}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    return { error: (detail as { message?: string }).message ?? "登录失败" };
  }

  // Forward the Set-Cookie from the auth response so the browser gets the session.
  const setCookie = res.headers.get("set-cookie");
  const headers = new Headers({ Location: "/dashboard" });
  if (setCookie) {
    headers.set("set-cookie", setCookie);
  }
  return new Response(null, { status: 302, headers });
}

export default function Login() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // Initiate GitHub OAuth: call Better Auth's sign-in/social endpoint, then
  // redirect the browser to the GitHub authorization URL it returns.
  async function handleGitHub() {
    const res = await fetch("/api/auth/sign-in/social", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "github", callbackURL: "/dashboard" }),
    });
    const data = (await res.json()) as { url?: string; redirect?: boolean };
    if (data.url) {
      window.location.href = data.url;
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border border-border/40 bg-background/60 p-8 backdrop-blur-sm">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold">Check CX</h1>
          <p className="text-sm text-muted-foreground">后台管理登录</p>
        </div>

        <Form method="post" className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs font-medium text-muted-foreground">
              邮箱
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoFocus
              className="h-9 w-full rounded-md border border-input bg-input/20 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs font-medium text-muted-foreground">
              密码
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="h-9 w-full rounded-md border border-input bg-input/20 px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </div>

          {actionData?.error && (
            <p className="text-sm text-destructive">{actionData.error}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="h-9 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-60"
          >
            {isSubmitting ? "登录中…" : "登录"}
          </button>
        </Form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border/40" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-background/60 px-2 text-xs text-muted-foreground">或</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGitHub}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
        >
          <Github className="h-4 w-4" />
          使用 GitHub 登录
        </button>
      </div>
    </main>
  );
}
