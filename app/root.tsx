import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  isRouteErrorResponse,
  useRouteError,
} from "react-router";

import type { Route } from "./+types/root";
import { ThemeProvider } from "@/components/theme-provider";
import { NotificationBanner } from "@/components/notification-banner";
import { cn } from "@/lib/utils";

import "./app.css";

export function links() {
  return [
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    {
      rel: "preconnect",
      href: "https://fonts.gstatic.com",
      crossOrigin: "anonymous",
    },
    {
      rel: "stylesheet",
      href: "https://fonts.googleapis.com/css2?family=Geist:wght@100..900&family=Geist+Mono:wght@100..900&family=JetBrains+Mono:wght@100..900&display=swap",
    },
  ];
}

// Auto dark mode based on local hour (19:00-07:00), before hydration.
const themeBootScript = `(()=>{
  const hour = new Date().getHours();
  const isDark = hour >= 19 || hour < 7;
  const root = document.documentElement;
  root.classList.toggle('dark', isDark);
  root.style.colorScheme = isDark ? 'dark' : 'light';
})();`;

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning className={cn("font-mono")}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>LINUX DO - 模型中转状态检测</title>
        <meta
          name="description"
          content="实时检测 OpenAI / Gemini / Anthropic 对话接口的可用性与延迟"
        />
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <Meta />
        <Links />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <NotificationBanner />
          {children}
        </ThemeProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : 500;
  const message = isRouteErrorResponse(error)
    ? error.statusText || "未知错误"
    : error instanceof Error
      ? error.message
      : "未知错误";

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-4xl font-bold">{status}</h1>
      <p className="text-muted-foreground">{message}</p>
      <a href="/" className="text-primary underline">
        返回首页
      </a>
    </main>
  );
}

export type { Route };
