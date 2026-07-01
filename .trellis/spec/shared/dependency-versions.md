# Dependency Version Constraints

> Critical version constraints for Cloudflare Workers + React Router + Vite projects.

> **Note**: The versions below represent a known-working combination as of this writing.
> Adjust versions to your project's needs, but pay close attention to the **Critical Version Constraints** section -- those packages have specific compatibility requirements that can cause hard-to-debug runtime errors.

---

## Overview

This guide documents critical dependency version constraints that must be followed to avoid runtime errors. These constraints exist due to:

1. **Vite + unenv polyfills** - Some Node.js APIs aren't fully implemented in edge environments
2. **SSR compatibility** - Client-side libraries need special handling
3. **Breaking API changes** - Major version upgrades change APIs significantly

---

## Recommended Version Reference

### Production Dependencies

| Package | Version | Category | Notes |
|---------|---------|----------|-------|
| `react` | `^19.x` | Core | React 19 with concurrent features |
| `react-dom` | `^19.x` | Core | Must match React version |
| `react-router` | `8.x` | Routing | React Router v8 with SSR support. **Note:** the create-cloudflare template and `@cloudflare/vite-plugin` 1.42+ now require v8; v7 causes client-manifest ordering failures under vite 8 |
| `hono` | `^4.x` | Backend | Cloudflare Workers web framework |
| `@libsql/client` | See below | Database | Check compat with your Vite + unenv version |
| `drizzle-orm` | `^0.45.x` | Database | ORM for libsql/Turso |
| `better-auth` | `^1.x` | Auth | Backend authentication |
| `zod` | `^4.x` | Validation | Zod v4 for schema validation |
| `isbot` | `^5.x` | Utility | Bot detection for SSR |

### Development Dependencies

| Package | Version | Category | Notes |
|---------|---------|----------|-------|
| `typescript` | `^5.x` | Language | TypeScript 5.x |
| `vite` | `^8.x` | Build | **Vite 8.x** (rolldown). `@cloudflare/vite-plugin` 1.42+ requires the Environment API; vite 6 produces broken client→SSR manifest ordering |
| `@cloudflare/vite-plugin` | `^1.42.4` | Build | 1.42+ bundles the custom worker entry with the virtual react-router server-build resolved |
| `@react-router/dev` | `8.x` | Build | Must match react-router version |
| `tailwindcss` | `^4.x` | Styling | Tailwind CSS v4 |
| `@tailwindcss/vite` | `^4.x` | Styling | Vite plugin for Tailwind v4 |
| `drizzle-kit` | `^0.31.x` | Database | Migration tool for Drizzle |
| `wrangler` | `^4.106.x` | Deploy | `@cloudflare/vite-plugin` 1.42+ peer-requires wrangler ^4.106 |
| `@types/react` | `^19.x` | Types | Must match React version |
| `@types/react-dom` | `^19.x` | Types | Must match React DOM version |

> **Note:** `@cloudflare/workers-types` is **no longer needed**. `wrangler types`
> generates runtime types into `worker-configuration.d.ts` (per wrangler's own
> guidance). Do not add `@cloudflare/workers-types` to `tsconfig` `types`.
| `@types/react` | `^19.x` | Types | Must match React version |
| `@types/react-dom` | `^19.x` | Types | Must match React DOM version |

---

## Critical Version Constraints

### @libsql/client - Check Vite/unenv Compatibility

```bash
# Check the latest compatible version before installing
pnpm add @libsql/client
```

**Known issue**: Some versions of `@libsql/client` use Node.js `https` module internally, causing errors in edge environments:

```
[unenv] https.request is not implemented yet!
```

This happens because:
1. Vite uses `unenv` to polyfill Node.js APIs for edge environments
2. `unenv` doesn't fully implement `https.request`
3. Certain `@libsql/client` versions call `https.request` directly

**Workaround** (if you hit this issue): Pin to the last known compatible version (e.g., `0.15.x`), or check if newer `unenv` versions have resolved the polyfill gap.

**Connection Pattern:**

```typescript
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";

export function createDb(env: DatabaseEnv): LibSQLDatabase<typeof schema> {
  const url = `${env.DATABASE_URL}?authToken=${env.DATABASE_AUTH_TOKEN}`;
  const client: Client = createClient({ url });
  return drizzle(client, { schema });
}
```

---

### @cloudflare/vite-plugin - ^1.42.4 + cloudflare() plugin (NOT cloudflareDevProxy)

```bash
pnpm add -D @cloudflare/vite-plugin@^1.42.4 wrangler@^4.106.0 vite@^8.0.0
```

**Use `cloudflare()` from `@cloudflare/vite-plugin`, not `cloudflareDevProxy`**
from `@react-router/dev/vite/cloudflare`. The `cloudflare()` plugin bundles
the custom worker entry (`workers/app.ts`) and resolves the virtual
`react-router/server-build` module at build time. It is the only setup that
produces a deployable Worker with a custom entry (for DO / `scheduled`).

```ts
// vite.config.ts
import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    reactRouter(),
  ],
  resolve: { alias: { "~/": "/app/", "#/": "/src/" } }, // worker env doesn't read tsconfig paths
});
```

**Critical: requires Vite 8 (rolldown).** On Vite 6 the SSR environment reads
the client manifest before it is written → `ENOENT build/client/.vite/manifest.json`.

**Custom `app/entry.server.tsx` is required** — the default `@react-router/node`
entry uses `renderToPipeableStream` (Node-only, absent on Workers). Use
`renderToReadableStream` from `react-dom/server` (see the create-cloudflare
react-router template).

**`wrangler.jsonc` must NOT set `assets`** when using this plugin — the plugin
manages static assets automatically. Setting it causes manifest resolution issues.

---

### react-router + @react-router/dev - Version Match (v8)

```bash
pnpm add react-router@8.0.0
pnpm add -D @react-router/dev@8.0.0
```

**These versions MUST match.** The create-cloudflare react-router template
now ships v8; v7 + vite-plugin 1.42+ is not a working combination.

---

### Tailwind CSS v4

```bash
pnpm add -D tailwindcss@^4.x @tailwindcss/vite@^4.x
```

**Breaking Changes from v3:**

1. `@apply` with CSS variable names doesn't work directly
2. Color utilities use `--color-*` namespace
3. Configuration moved from `tailwind.config.js` to CSS `@theme`

See [Tailwind CSS v4 Gotchas](#tailwind-css-v4-gotchas) section below for details and solutions.

---

### Zod v4

```bash
pnpm add zod@^4.x
```

**v4 Changes:**
- New `z.interface()` for object types
- Improved error messages
- Better TypeScript inference

---

## Tailwind CSS v4 Gotchas

> **Canonical reference** for Tailwind v4 issues in this project.
> Other spec files should reference this section rather than duplicating the content.

### @apply with CSS Variables

```css
/* FAILS in Tailwind v4 */
@layer base {
  body {
    @apply bg-background text-foreground;
  }
}

/* CORRECT - Use bracket syntax */
@layer base {
  body {
    @apply bg-[hsl(var(--background))] text-[hsl(var(--foreground))];
  }
}

/* ALSO CORRECT - Plain CSS */
@layer base {
  body {
    background-color: hsl(var(--background));
    color: hsl(var(--foreground));
  }
}
```

### Color Variable Namespace Mismatch

**CRITICAL:** Tailwind v4 uses `--color-*` namespace, but shadcn/better-auth-ui define `--*` variables.

**Problem:**
- shadcn defines: `--popover: 0 0% 100%;`
- Tailwind v4's `bg-popover` looks for: `--color-popover`
- Result: Transparent backgrounds, broken component styling

**Symptom:**
- Dropdown menus have transparent backgrounds
- Text colors don't apply correctly
- Borders are invisible

**Solution:** Add color mappings in `@theme` block of `app.css`:

```css
@theme {
  /* Map shadcn variables to Tailwind v4 color namespace */
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  --color-card: hsl(var(--card));
  --color-card-foreground: hsl(var(--card-foreground));
  --color-popover: hsl(var(--popover));
  --color-popover-foreground: hsl(var(--popover-foreground));
  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));
  --color-secondary: hsl(var(--secondary));
  --color-secondary-foreground: hsl(var(--secondary-foreground));
  --color-muted: hsl(var(--muted));
  --color-muted-foreground: hsl(var(--muted-foreground));
  --color-accent: hsl(var(--accent));
  --color-accent-foreground: hsl(var(--accent-foreground));
  --color-destructive: hsl(var(--destructive));
  --color-destructive-foreground: hsl(var(--destructive-foreground));
  --color-border: hsl(var(--border));
  --color-input: hsl(var(--input));
  --color-ring: hsl(var(--ring));
}
```

---

## Radix UI (via better-auth-ui)

### Layout Shift on Dropdown/Popover Open

**Problem:** Clicking `UserButton` or other Radix dropdowns causes horizontal page shift.

**Root Cause:**
- Radix UI enables `modal` mode by default
- Triggers `react-remove-scroll` to lock background scrolling
- Adds `margin-right` to body to compensate for hidden scrollbar

**Solution:** Add to global stylesheet:

```css
/* Fix layout shift when Radix Dropdown/Popover opens */
html {
  scrollbar-gutter: stable;
}

html body[data-scroll-locked] {
  overflow: visible !important;
  margin-right: 0 !important;
  padding-right: 0 !important;
}
```

### UserButton Default Styling

**Problem:** `UserButton` has dark `bg-primary` background by default.

**Solution:** Override with `classNames` prop:

```tsx
<UserButton
  classNames={{
    trigger: {
      base: "bg-transparent text-foreground hover:bg-accent transition-colors",
    },
  }}
/>
```

---

## Troubleshooting Guide

### Error: `[unenv] https.request is not implemented yet!`

**Cause:** `@libsql/client` version incompatible with current `unenv` polyfills

**Solution:**
Pin to a compatible version or check if newer `unenv` resolves the issue.

### Error: `Cannot read properties of null (reading 'useContext')`

**Cause:** SSR rendering client-only UI components (e.g., better-auth-ui)

**Solution:** Add `isMounted` pattern to all auth components:

```tsx
const [isMounted, setIsMounted] = useState(false);

useEffect(() => {
  setIsMounted(true);
}, []);

if (!isMounted) {
  return <LoadingSkeleton />;
}

return <AuthUIComponent />;
```

### Error: `Cannot apply unknown utility class: bg-background`

**Cause:** Tailwind v4 + `@apply` with CSS variable names

**Solution:** Use bracket syntax or plain CSS. See [Tailwind CSS v4 Gotchas](#tailwind-css-v4-gotchas).

### Dropdown/Popover Has Transparent Background

**Cause:** Tailwind v4 color variable namespace mismatch

**Solution:** Add `--color-*` mappings in `@theme` block. See [Tailwind CSS v4 Gotchas](#tailwind-css-v4-gotchas).

### Page Shifts Horizontally When Opening Dropdown

**Cause:** Radix UI's `react-remove-scroll` compensating for scrollbar

**Solution:** Add `scrollbar-gutter: stable` CSS fix. See [Radix UI](#radix-ui-via-better-auth-ui) section.

---

## Version Update Checklist

Before updating any of these packages:

1. [ ] Check changelog for breaking changes
2. [ ] Test in development environment first
3. [ ] Verify SSR still works (page refresh without errors)
4. [ ] Test all auth flows (login, register, logout)
5. [ ] Test database operations
6. [ ] Run full build (`pnpm build`)
7. [ ] Run type check (`pnpm typecheck`)
8. [ ] Deploy to staging before production
