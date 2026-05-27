import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable, mediaItemsTable, broadcastsTable } from "@workspace/db";
import { count, eq, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/dashboard", async (_req, res) => {
  try {
    const totalUsersResult = await db.select({ count: count() }).from(usersTable);
    const pendingUsersResult = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.status, "pending"));
    const approvedUsersResult = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.status, "approved"));
    const bannedUsersResult = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.status, "banned"));
    const totalMediaResult = await db.select({ count: count() }).from(mediaItemsTable);
    const totalBroadcastsResult = await db.select({ count: count() }).from(broadcastsTable);

    // Recent activity: last 10 user actions
    const recentUsers = await db.select().from(usersTable).orderBy(sql`${usersTable.createdAt} desc`).limit(5);
    const recentMedia = await db.select().from(mediaItemsTable).orderBy(sql`${mediaItemsTable.createdAt} desc`).limit(5);

    const activity = [
      ...recentUsers.map((u) => ({
        type: u.status === "pending" ? "user_joined" : u.status === "approved" ? "user_approved" : "user_declined",
        message: `${u.firstName} ${u.status === "pending" ? "joined" : u.status === "approved" ? "was approved" : "was declined"}`,
        timestamp: u.createdAt.toISOString(),
        userId: u.id,
      })),
      ...recentMedia.map((m) => ({
        type: "media_submitted" as const,
        message: `Media submitted by user #${m.userId}`,
        timestamp: m.createdAt.toISOString(),
        userId: m.userId,
      })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10);

    res.json({
      totalUsers: totalUsersResult[0]?.count ?? 0,
      pendingUsers: pendingUsersResult[0]?.count ?? 0,
      approvedUsers: approvedUsersResult[0]?.count ?? 0,
      bannedUsers: bannedUsersResult[0]?.count ?? 0,
      totalMedia: totalMediaResult[0]?.count ?? 0,
      totalBroadcasts: totalBroadcastsResult[0]?.count ?? 0,
      recentActivity: activity,
    });
  } catch (err) {
    logger.error({ err }, "Dashboard error");
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

export default router;
