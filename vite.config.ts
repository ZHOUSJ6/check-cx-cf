import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

// React Router v8 + Cloudflare Workers (single Worker, SSR + assets).
// cloudflare() plugin bundles workers/app.ts and injects context.cloudflare
// into loaders automatically. SSR runs in the "ssr" vite environment.
export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    reactRouter(),
  ],
  resolve: {
    alias: {
      "~/": "/app/",
      "#/": "/src/",
    },
  },
});
