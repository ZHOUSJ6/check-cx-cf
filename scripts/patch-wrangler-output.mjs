/**
 * Patch the cloudflare vite plugin's generated output wrangler.json to restore
 * top-level routing fields (routes, workers_dev) that the plugin strips during
 * build. Without this, `wrangler deploy` would not apply custom-domain or
 * workers.dev-disabling config.
 *
 * Custom domain is driven by DEPLOY_DOMAIN env var so the repo stays generic:
 *   DEPLOY_DOMAIN=cx.example.com pnpm deploy
 *
 * If DEPLOY_DOMAIN is not set, workers.dev stays enabled (no custom domain).
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

const deployDomain = process.env.DEPLOY_DOMAIN;

if (deployDomain) {
  config.routes = [{ pattern: deployDomain, custom_domain: true }];
  config.workers_dev = false;
  console.log(`[patch-wrangler] custom domain: ${deployDomain}, workers_dev: false`);
} else {
  delete config.routes;
  config.workers_dev = true;
  console.log(`[patch-wrangler] no DEPLOY_DOMAIN set, workers.dev enabled`);
}

writeFileSync(OUT, JSON.stringify(config, null, 2));
console.log(`[patch-wrangler] patched ${OUT}`);
