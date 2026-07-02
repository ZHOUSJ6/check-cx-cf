/**
 * Better Auth handler mounted at /api/auth/*. Delegates all auth endpoints
 * (sign-in/up, callback, sign-out, session) to Better Auth.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";

import { createAuth } from "#/auth";

export const authRouter = new Hono<{ Bindings: Env }>();

// Auth endpoints are called from the browser with credentials; allow the
// same origin and the necessary methods/headers.
authRouter.use(
  "/*",
  cors({
    origin: (origin) => origin,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["POST", "GET", "OPTIONS"],
    credentials: true,
  }),
);

authRouter.all("/*", async (c) => {
  const baseURL = new URL(c.req.url).origin;
  const auth = createAuth(c.env, baseURL);
  return auth.handler(c.req.raw);
});
