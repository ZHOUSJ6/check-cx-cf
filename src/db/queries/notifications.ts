/**
 * System notifications — migrated from check-cx lib/database/notifications.ts.
 * Supabase → Drizzle.
 */

import { asc, eq } from "drizzle-orm";

import type { Database } from "#/db/client";
import { systemNotifications } from "#/db/schema";
import type { NotificationLevel } from "#/db/schema";

export interface SystemNotification {
  id: string;
  message: string;
  isActive: boolean;
  level: NotificationLevel;
  createdAt: Date;
}

export async function getActiveSystemNotifications(
  db: Database,
): Promise<SystemNotification[]> {
  try {
    const rows = await db
      .select({
        id: systemNotifications.id,
        message: systemNotifications.message,
        isActive: systemNotifications.isActive,
        level: systemNotifications.level,
        createdAt: systemNotifications.createdAt,
      })
      .from(systemNotifications)
      .where(eq(systemNotifications.isActive, true))
      .orderBy(asc(systemNotifications.createdAt));

    return rows;
  } catch (error) {
    console.error("Failed to fetch system notifications:", error);
    return [];
  }
}
