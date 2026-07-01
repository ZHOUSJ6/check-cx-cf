/**
 * Worker entry — single Cloudflare Worker combining:
 *   - React Router v7 (SSR + assets) for non-API routes
 *   - Hono API app for /api/*
 *   - PollerDO (singleton durable object) for the health-check poller
 *   - scheduled() handler (Cron) that wakes the PollerDO
 *
 * Pattern: @cloudflare/vite-plugin + reactRouter. The virtual
 * react-router/server-build module is resolved by the vite plugin at build time
 * and bundled into this Worker.
 */

import { createHonoApp } from "#/api/app";
import { createRequestHandler } from "react-router";

// Re-export the DO class so wrangler can bind it (matches wrangler.jsonc
// durable_objects.bindings[].class_name = "PollerDO").
export { PollerDO } from "#/do/poller-do";

const api = createHonoApp();

// Lazy import of the RRv8 server build (virtual module, resolved at build time).
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

    // React Router SSR. env/ctx are accessed in loaders via
    // `import { env } from "cloudflare:workers"`.
    void env;
    void ctx;
    return requestHandler(request);
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
