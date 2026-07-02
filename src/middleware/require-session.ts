/**
 * Session + AppUser resolution for the admin API.
 *
 * Flow: Better Auth session cookie → getSession → resolve admin_users row by
 * auth_user_id (role + group scope). Bridges Better Auth's user identity to
 * our 2-level role model (admin/member).
 */

import { eq } from "drizzle-orm";

import { createAuth, type Auth } from "#/auth";
import { createDb, type Database } from "#/db/client";
import { adminUsers } from "#/db/schema";

export interface AppUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: "admin" | "member";
  groupName: string | null;
  directoryUserId: string | null;
  isActive: boolean;
}

interface SessionEnv {
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  ADMIN_EMAILS?: string;
  DATABASE_URL: string;
  DATABASE_AUTH_TOKEN: string;
}

interface AuthSession {
  user: { id: string; email: string; name?: string | null; image?: string | null };
  session: { id: string; userId: string };
}

/** Resolve the authenticated session + AppUser, or null if unauthenticated. */
export async function resolveAppUser(
  env: SessionEnv,
  request: Request,
): Promise<{ user: AppUser; auth: Auth; db: Database; session: AuthSession } | null> {
  const baseURL = new URL(request.url).origin;
  const auth = createAuth(env, baseURL);
  const db = createDb(env);

  const session = await auth.api.getSession({
    headers: request.headers,
  } as Parameters<typeof auth.api.getSession>[0]);

  if (!session) {
    return null;
  }

  const typedSession = session as unknown as AuthSession;

  // Look up the admin_users directory row by auth_user_id.
  const rows = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.authUserId, typedSession.user.id));
  let directory = rows[0];

  // Bootstrap: a pre-seeded invite row (by email, auth_user_id NULL) binds on
  // first login. If no row at all but the email is in ADMIN_EMAILS, create an
  // admin directory row automatically.
  if (!directory) {
    const adminEmails = (env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const normalizedEmail = (typedSession.user.email ?? "").trim().toLowerCase();

    // Bind an existing invite (by email, not yet activated).
    const inviteRows = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.email, normalizedEmail));
    const invite = inviteRows[0];
    if (invite && !invite.authUserId) {
      await db
        .update(adminUsers)
        .set({ authUserId: typedSession.user.id, activatedAt: new Date() })
        .where(eq(adminUsers.id, invite.id));
      directory = { ...invite, authUserId: typedSession.user.id, activatedAt: new Date() };
    } else if (adminEmails.includes(normalizedEmail)) {
      // Auto-create admin row for bootstrap emails.
      const inserted = await db
        .insert(adminUsers)
        .values({
          email: normalizedEmail,
          role: "admin",
          authUserId: typedSession.user.id,
          isActive: true,
          activatedAt: new Date(),
        })
        .returning();
      directory = inserted[0];
    }
  }

  if (!directory || !directory.isActive) {
    return null;
  }

  const user: AppUser = {
    id: typedSession.user.id,
    email: directory.email,
    displayName: typedSession.user.name || directory.email.split("@")[0] || "管理员",
    avatarUrl: typedSession.user.image ?? null,
    role: directory.role,
    groupName: directory.groupName,
    directoryUserId: directory.id,
    isActive: directory.isActive,
  };

  return { user, auth, db, session: typedSession };
}

export function isAdminUser(user: AppUser): boolean {
  return user.role === "admin";
}

/** Group name a member is scoped to (admins pass null = all groups). */
export function getRequiredGroupName(user: AppUser): string | null {
  if (isAdminUser(user)) {
    return null;
  }
  const groupName = user.groupName?.trim() ?? "";
  if (groupName.length === 0) {
    throw new Error("当前成员未绑定分组，无法访问后台配置");
  }
  return groupName;
}

export function isGroupInUserScope(user: AppUser, groupName: string | null | undefined): boolean {
  if (isAdminUser(user)) {
    return true;
  }
  return (groupName?.trim() ?? "") === (getRequiredGroupName(user) ?? "");
}
