import { Outlet, useLoaderData } from "react-router";
import type { Route } from "./+types/dashboard";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

interface SessionUser {
  email: string;
  displayName: string;
  role: "admin" | "member";
  groupName: string | null;
}

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

export default function DashboardLayout() {
  const { user } = useLoaderData<typeof loader>();

  return (
    <SidebarProvider>
      <AppSidebar
        user={{
          name: user.displayName,
          email: user.email,
          avatar: null,
          role: user.role,
          groupName: user.groupName,
        }}
      />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-16" />
          <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">check-cx 后台管理</p>
              <p className="truncate text-xs text-muted-foreground">
                当前登录：{user.email}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                fetch('/api/auth/sign-out', { method: 'POST', credentials: 'same-origin', headers: {'Content-Type':'application/json'}, body: '{}' })
                  .then(() => { window.location.href = '/login'; });
              }}
              className="rounded-md border border-border/40 px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              登出
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
