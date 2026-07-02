/**
 * Hono API app — owns the /api/* namespace exclusively (design §6).
 * React Router v7 owns all non-/api routes.
 */

import { Hono } from "hono";

import { createDb } from "#/db/client";
import { authRouter } from "#/api/auth-router";
import { createAdminApp } from "#/api/admin/app";
import { statusRouter } from "#/api/status/router";
import { dashboardRouter } from "#/api/dashboard/router";
import { groupRouter } from "#/api/group/router";
import { notificationsRouter } from "#/api/notifications/router";
import { internalRouter } from "#/api/internal/router";

export interface AppEnv {
  Bindings: Env;
  Variables: {
    db: ReturnType<typeof createDb>;
  };
}

export function createHonoApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  // Better Auth owns /api/auth/* — mounted before the per-request DB middleware
  // since it creates its own auth+db instances internally.
  app.route("/api/auth", authRouter);

  // Per-request DB instance from env (spec: environment.md) for read/admin routes.
  app.use("*", async (c, next) => {
    c.set("db", createDb(c.env));
    await next();
  });

  app.route("/api/v1", statusRouter);
  app.route("/api/dashboard", dashboardRouter);
  app.route("/api/group", groupRouter);
  app.route("/api/notifications", notificationsRouter);
  app.route("/api/internal", internalRouter);

  // Admin CRUD API — session-gated, mounted last.
  app.route("/api/admin", createAdminApp());

  return app;
}
