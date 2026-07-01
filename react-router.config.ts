import type { Config } from "@react-router/dev/config";

export default {
  ssr: true,
  // Prerender is off: dashboard data is dynamic (force-dynamic in source).
  prerender: false,
} satisfies Config;
