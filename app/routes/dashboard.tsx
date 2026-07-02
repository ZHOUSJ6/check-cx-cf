import { NavLink, Outlet, useLoaderData } from "react-router";
import {
  Activity,
  Boxes,
  FileText,
  History,
  LayoutGrid,
  Settings,
  Tags,
  Users,
  Bell,
} from "lucide-react";
import type { Route } from "./+types/dashboard";

interface SessionUser {
  email: string;
  displayName: string;
  role: "admin" | "member";
  groupName: string | null;
}

// Loader: read the session user injected by the Worker entry (x-auth-user
// header). The entry resolves the Better Auth session before delegating to
// RRv8, since SSR loaders can't reliably access env or self-fetch cookies.
export async function loader({
  request,
}: Route.LoaderArgs): Promise<{ user: SessionUser } | Response> {
  const authHeader = request.headers.get("x-auth-user");
  if (!authHeader) {
    return new Response(null, { status: 302, headers: { Location: "/login" } });
  }

  try {
    const u = JSON.parse(authHeader) as { id: string; email: string; name: string | null };
    return {
      user: {
        email: u.email,
        displayName: u.name ?? u.email.split("@")[0] ?? "管理员",
        role: "admin",
        groupName: null,
      },
    };
  } catch {
    return new Response(null, { status: 302, headers: { Location: "/login" } });
  }
}

const NAV_ITEMS = [
  { to: "/dashboard", label: "概览", icon: LayoutGrid, end: true },
  { to: "/dashboard/configs", label: "配置", icon: Activity },
  { to: "/dashboard/models", label: "模型", icon: Boxes },
  { to: "/dashboard/templates", label: "模板", icon: FileText },
  { to: "/dashboard/groups", label: "分组", icon: Tags },
  { to: "/dashboard/history", label: "历史", icon: History },
  { to: "/dashboard/notifications", label: "通知", icon: Bell },
  { to: "/dashboard/users", label: "用户", icon: Users },
  { to: "/dashboard/system", label: "系统", icon: Settings },
];

export default function DashboardLayout() {
  const { user } = useLoaderData<typeof loader>();

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border/40 bg-background/60 backdrop-blur-sm md:flex">
        <div className="border-b border-border/40 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Activity className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">Check CX</p>
              <p className="truncate text-[10px] text-muted-foreground">后台管理</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border/40 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">{user.displayName}</p>
              <p className="truncate text-[10px] text-muted-foreground">{user.email}</p>
            </div>
            <a
              href="/api/auth/sign-out"
              className="rounded-md border border-border/40 px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              登出
            </a>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-border/40 bg-background/95 px-4 backdrop-blur md:hidden">
          <span className="text-sm font-bold">Check CX 后台</span>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
