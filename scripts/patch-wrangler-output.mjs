/**
 * Patch the cloudflare vite plugin's generated output wrangler.json to restore
 * top-level routing fields (routes, workers_dev) that the plugin strips during
 * build. Without this, `wrangler deploy` (which reads build/server/wrangler.json)
 * would not apply custom-domain or workers.dev-disabling config.
 *
 * Run after `react-router build`, before `wrangler deploy`.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const OUT = "build/server/wrangler.json";

if (!existsSync(OUT)) {
  console.warn(`[patch-wrangler] ${OUT} not found, skipping`);
  process.exit(0);
}

const config = JSON.parse(readFileSync(OUT, "utf8"));

// Custom domain binding (Worker is the origin; DNS + TLS auto-managed).
config.routes = [{ pattern: "cx.020212.xyz", custom_domain: true }];
// Serve only via the custom domain; disable the *.workers.dev subdomain.
config.workers_dev = false;

writeFileSync(OUT, JSON.stringify(config, null, 2));
console.log("[patch-wrangler] injected routes + workers_dev=false into", OUT);
