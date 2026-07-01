/**
 * Worker entry — single Cloudflare Worker combining:
 *   - React Router v7 (SSR + assets) for non-API routes
 *   - Hono API app for /api/*
 *   - PollerDO (singleton durable object) for the health-check poller
 *   - scheduled() handler (Cron) that wakes the PollerDO
 *
 * Pattern: @cloudflare/vite-plugin + reactRouter cloudflare preset.
 * The RRv7 server build is imported via the "virtual:react-router/server-build"
 * module injected by @react-router/dev at build time.
 */

import { createHonoApp } from "#/api/app";
import { createRequestHandler } from "react-router";
import type { ServerBuild } from "react-router";

// Re-export the DO class so wrangler can bind it (matches wrangler.jsonc
// durable_objects.bindings[].class_name = "PollerDO").
export { PollerDO } from "#/do/poller-do";

const api = createHonoApp();

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);

    // Hono owns /api/* exclusively; everything else is React Router.
    if (url.pathname.startsWith("/api/")) {
      return api.fetch(request, env, ctx);
    }

    // React Router SSR + static assets. The virtual module is injected by
    // @react-router/dev at build time.
    // @ts-expect-error — virtual module resolved by the Vite build
    const build = (await import("virtual:react-router/server-build")) as ServerBuild;
    const handler = createRequestHandler(build);
    return handler(request, {
      cloudflare: { env, ctx, cf: request.cf },
    });
  },

  async scheduled(_event, env, ctx): Promise<void> {
    // Cron (1/min) nudges the singleton PollerDO awake; the DO re-arms its
    // own alarm to keep precise 60s/300s cadences.
    if (!env.POLLER) {
      return;
    }
    const id = env.POLLER.idFromName("1");
    const stub = env.POLLER.get(id);
    ctx.waitUntil(stub.fetch("https://do/wake").then((r) => r.body?.cancel()));
  },
} satisfies ExportedHandler<Env>;
