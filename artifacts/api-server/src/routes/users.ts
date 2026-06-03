import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable, mediaItemsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { UpdateUserBody } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// List pending users with media count
router.get("/pending-users", async (_req, res) => {
  try {
    const users = await db.select().from(usersTable).where(eq(usersTable.status, "pending")).orderBy(usersTable.createdAt);
    const result = await Promise.all(
      users.map(async (u) => {
        const mediaResult = await db.select({ count: count() }).from(mediaItemsTable).where(eq(mediaItemsTable.userId, u.id));
        return {
          id: u.id,
          telegramId: u.telegramId,
          username: u.username,
          firstName: u.firstName,
          lastName: u.lastName,
          mediaCount: mediaResult[0]?.count ?? 0,
          isAdmin: u.isAdmin,
          submittedAt: u.createdAt.toISOString(),
        };
      })
    );
    res.json(result);
  } catch (err) {
    logger.error({ err }, "List pending users error");
    res.status(500).json({ error: "Failed to load pending users" });
  }
});

// Approve user
router.post("/pending-users/:id/approve", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const updated = await db.update(usersTable).set({ status: "approved", updatedAt: new Date() }).where(eq(usersTable.id, id)).returning();
    if (!updated.length) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({
      id: updated[0].id,
      telegramId: updated[0].telegramId,
      username: updated[0].username,
      firstName: updated[0].firstName,
      lastName: updated[0].lastName,
      status: updated[0].status,
      isAdmin: updated[0].isAdmin,
      mediaCount: 0,
      createdAt: updated[0].createdAt.toISOString(),
      updatedAt: updated[0].updatedAt.toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "Approve user error");
    res.status(500).json({ error: "Failed to approve user" });
  }
});

// Decline user
router.post("/pending-users/:id/decline", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const updated = await db.update(usersTable).set({ status: "declined", updatedAt: new Date() }).where(eq(usersTable.id, id)).returning();
    if (!updated.length) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({
      id: updated[0].id,
      telegramId: updated[0].telegramId,
      username: updated[0].username,
      firstName: updated[0].firstName,
      lastName: updated[0].lastName,
      status: updated[0].status,
      isAdmin: updated[0].isAdmin,
      mediaCount: 0,
      createdAt: updated[0].createdAt.toISOString(),
      updatedAt: updated[0].updatedAt.toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "Decline user error");
    res.status(500).json({ error: "Failed to decline user" });
  }
});

// List approved users (includes banned)
router.get("/approved-users", async (_req, res) => {
  try {
    const users = await db.select().from(usersTable).where(eq(usersTable.status, "approved")).orderBy(usersTable.updatedAt);
    const banned = await db.select().from(usersTable).where(eq(usersTable.status, "banned")).orderBy(usersTable.updatedAt);
    const all = [...users, ...banned];
    const result = await Promise.all(
      all.map(async (u) => {
        const mediaResult = await db.select({ count: count() }).from(mediaItemsTable).where(eq(mediaItemsTable.userId, u.id));
        return {
          id: u.id,
          telegramId: u.telegramId,
          username: u.username,
          firstName: u.firstName,
          lastName: u.lastName,
          status: u.status,
          isAdmin: u.isAdmin,
          mediaCount: mediaResult[0]?.count ?? 0,
          createdAt: u.createdAt.toISOString(),
          updatedAt: u.updatedAt.toISOString(),
        };
      })
    );
    res.json(result);
  } catch (err) {
    logger.error({ err }, "List approved users error");
    res.status(500).json({ error: "Failed to load approved users" });
  }
});

// Get user detail with media
router.get("/approved-users/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const user = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!user.length) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const mediaResult = await db.select({ count: count() }).from(mediaItemsTable).where(eq(mediaItemsTable.userId, id));
    const media = await db.select().from(mediaItemsTable).where(eq(mediaItemsTable.userId, id)).orderBy(mediaItemsTable.createdAt);
    res.json({
      id: user[0].id,
      telegramId: user[0].telegramId,
      username: user[0].username,
      firstName: user[0].firstName,
      lastName: user[0].lastName,
      status: user[0].status,
      isAdmin: user[0].isAdmin,
      mediaCount: mediaResult[0]?.count ?? 0,
      createdAt: user[0].createdAt.toISOString(),
      updatedAt: user[0].updatedAt.toISOString(),
      media: media.map((m) => ({
        id: m.id,
        userId: m.userId,
        type: m.type,
        telegramFileId: m.telegramFileId,
        caption: m.caption,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    logger.error({ err }, "Get user error");
    res.status(500).json({ error: "Failed to load user" });
  }
});

// Update user status (ban/unban) or admin flag
router.patch("/approved-users/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const parsed = UpdateUserBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }
    const updates: Partial<typeof usersTable.$inferInsert> = { updatedAt: new Date() };
    if (parsed.data.status !== undefined) updates.status = parsed.data.status;
    if (parsed.data.isAdmin !== undefined) updates.isAdmin = parsed.data.isAdmin;
    const updated = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
    if (!updated.length) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({
      id: updated[0].id,
      telegramId: updated[0].telegramId,
      username: updated[0].username,
      firstName: updated[0].firstName,
      lastName: updated[0].lastName,
      status: updated[0].status,
      isAdmin: updated[0].isAdmin,
      mediaCount: 0,
      createdAt: updated[0].createdAt.toISOString(),
      updatedAt: updated[0].updatedAt.toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "Update user error");
    res.status(500).json({ error: "Failed to update user" });
  }
});

export default router;
