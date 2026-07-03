import { useState } from "react";
import { Github } from "lucide-react";
import type { Route } from "./+types/login";

export default function Login() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Client-side email/password sign-in: call Better Auth API directly so the
  // Set-Cookie reaches the browser (RRv8 action forwarding was unreliable).
  async function handleEmailLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;

    if (!email || !password) {
      setError("请输入邮箱和密码");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        setError((detail as { message?: string }).message ?? "登录失败");
        setLoading(false);
        return;
      }
      // Success — session cookie is set by the response. Redirect.
      window.location.href = "/dashboard";
    } catch {
      setError("网络错误，请重试");
      setLoading(false);
    }
  }

  // Initiate GitHub OAuth.
  async function handleGitHub() {
    const res = await fetch("/api/auth/sign-in/social", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "github", callbackURL: "/dashboard" }),
    });
    const data = (await res.json()) as { url?: string };
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

        <form onSubmit={handleEmailLogin} className="space-y-4">
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

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="h-9 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 disabled:opacity-60"
          >
            {loading ? "登录中…" : "登录"}
          </button>
        </form>

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
