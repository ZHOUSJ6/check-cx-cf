/**
 * Admin API sub-app — mounted at /api/admin/*. Every route requires an
 * authenticated Better Auth session + an active admin_users directory row.
 *
 * Resolves AppUser (role + group scope) once via middleware and exposes it
 * to handlers via c.get("appUser").
 */

import { Hono } from "hono";

import { resolveAppUser, type AppUser } from "#/middleware/require-session";
import type { Database } from "#/db/client";
import { configsRouter } from "#/api/admin/configs/router";
import { modelsRouter } from "#/api/admin/models/router";
import { templatesRouter } from "#/api/admin/templates/router";
import { groupsRouter } from "#/api/admin/groups/router";
import { historyRouter } from "#/api/admin/history/router";
import { notificationsRouter } from "#/api/admin/notifications/router";
import { usersRouter } from "#/api/admin/users/router";
import { systemRouter } from "#/api/admin/system/router";

export interface AdminEnv {
  Bindings: Env;
  Variables: {
    appUser: AppUser;
    db: Database;
  };
}

export function createAdminApp(): Hono<AdminEnv> {
  const app = new Hono<AdminEnv>();

  // Session + role resolution for all admin routes.
  app.use("*", async (c, next) => {
    const result = await resolveAppUser(c.env, c.req.raw);
    if (!result) {
      return c.json({ error: "unauthorized" }, 401);
    }
    c.set("appUser", result.user);
    c.set("db", result.db);
    await next();
  });

  app.route("/configs", configsRouter);
  app.route("/models", modelsRouter);
  app.route("/templates", templatesRouter);
  app.route("/groups", groupsRouter);
  app.route("/history", historyRouter);
  app.route("/notifications", notificationsRouter);
  app.route("/users", usersRouter);
  app.route("/system", systemRouter);

  return app;
}
