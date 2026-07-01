import { reactRouter } from "@react-router/dev/vite";
import { cloudflareDevProxy } from "@react-router/dev/vite/cloudflare";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

// React Router v7 + Cloudflare Workers (single Worker, SSR + assets).
// cloudflareDevProxy proxies local workerd bindings (read from wrangler.jsonc)
// into loaders/actions as context.cloudflare during dev.
export default defineConfig({
  plugins: [
    cloudflareDevProxy(),
    reactRouter(),
    tailwindcss(),
    tsconfigPaths(),
  ],
  build: {
    sourcemap: true,
  },
});
