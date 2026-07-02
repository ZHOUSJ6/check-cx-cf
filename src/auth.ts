/**
 * Better Auth instance factory — created per request from `env` (spec:
 * environment.md). Uses @better-auth/drizzle-adapter on our Turso/libSQL
 * client (same createDb as phase 1). Session tables (user/session/account/
 * verification) already exist in the phase-1 schema.
 *
 * NOT using better-auth-cloudflare (targets D1/KV bindings). Standard betterAuth
 * + drizzleAdapter works with the libSQL HTTP driver.
 */

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";

import { createDb, schema } from "#/db/client";

interface AuthEnv {
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  DATABASE_URL: string;
  DATABASE_AUTH_TOKEN: string;
}

export function createAuth(env: AuthEnv, baseURL: string) {
  const db = createDb(env);
  const github =
    env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
      ? {
          github: {
            clientId: env.GITHUB_CLIENT_ID,
            clientSecret: env.GITHUB_CLIENT_SECRET,
          },
        }
      : undefined;

  // BETTER_AUTH_SECRET is a wrangler secret (not in [vars]); required at runtime.
  const secret = env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is not configured");
  }

  return betterAuth({
    baseURL,
    secret,
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        user: schema.authUsers,
        session: schema.authSessions,
        account: schema.authAccounts,
        verification: schema.authVerifications,
      },
    }),
    emailAndPassword: {
      enabled: true,
    },
    ...(github ? { socialProviders: github } : {}),
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // 5 min — cookie-cached session reuses without DB hit
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
