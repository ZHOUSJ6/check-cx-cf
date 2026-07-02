/**
 * Worker entry — single Cloudflare Worker combining:
 *   - React Router v8 (SSR + assets) for non-API routes
 *   - Hono API app for /api/*
 *   - PollerDO (singleton durable object) for the health-check poller
 *   - scheduled() handler (Cron) that wakes the PollerDO
 */

import { createHonoApp } from "#/api/app";
import { createRequestHandler } from "react-router";
import { createAuth } from "#/auth";

// Re-export the DO class so wrangler can bind it.
export { PollerDO } from "#/do/poller-do";

const api = createHonoApp();

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);

    // Hono owns /api/* exclusively; everything else is React Router.
    if (url.pathname.startsWith("/api/")) {
      return api.fetch(request, env, ctx);
    }

    // For SSR pages under /dashboard/* or /login, resolve the Better Auth
    // session here (we have env) and pass user info to RRv8 loaders via a
    // custom header. RRv8 middleware mode blocks context.cloudflare, so we
    // inject the session through a request header instead.
    if (url.pathname.startsWith("/dashboard") || url.pathname === "/login") {
      const cookie = request.headers.get("cookie");
      if (cookie) {
        try {
          const auth = createAuth(env, url.origin);
          const session = await auth.api.getSession({
            headers: new Headers({ cookie }),
          } as Parameters<typeof auth.api.getSession>[0]);
          if (session) {
            // Workers Request headers can be immutable; create a fresh Request
            // with merged headers so the x-auth-user header reaches the loader.
            const mergedHeaders = new Headers(request.headers);
            mergedHeaders.set(
              "x-auth-user",
              JSON.stringify({
                id: session.user.id,
                email: session.user.email,
                name: session.user.name ?? null,
              }),
            );
            return requestHandler(new Request(request, { headers: mergedHeaders }));
          }
        } catch (e) {
          console.error("[check-cx] SSR session resolve failed:", e);
        }
      }
    }

    return requestHandler(request);
  },

  async scheduled(_event, env, ctx): Promise<void> {
    if (!env.POLLER) {
      return;
    }
    const id = env.POLLER.idFromName("1");
    const stub = env.POLLER.get(id);
    ctx.waitUntil(stub.fetch("https://do/wake").then((r) => r.body?.cancel()));
  },
} satisfies ExportedHandler<Env>;
