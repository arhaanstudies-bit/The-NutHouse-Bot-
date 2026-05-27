import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { mediaItemsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// List all media
router.get("/media", async (_req, res) => {
  try {
    const media = await db.select().from(mediaItemsTable).orderBy(mediaItemsTable.createdAt);
    res.json(media.map((m) => ({
      id: m.id,
      userId: m.userId,
      type: m.type,
      telegramFileId: m.telegramFileId,
      caption: m.caption,
      createdAt: m.createdAt.toISOString(),
    })));
  } catch (err) {
    logger.error({ err }, "List media error");
    res.status(500).json({ error: "Failed to load media" });
  }
});

// List media for a user
router.get("/users/:id/media", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const media = await db.select().from(mediaItemsTable).where(eq(mediaItemsTable.userId, id)).orderBy(mediaItemsTable.createdAt);
    res.json(media.map((m) => ({
      id: m.id,
      userId: m.userId,
      type: m.type,
      telegramFileId: m.telegramFileId,
      caption: m.caption,
      createdAt: m.createdAt.toISOString(),
    })));
  } catch (err) {
    logger.error({ err }, "List user media error");
    res.status(500).json({ error: "Failed to load user media" });
  }
});

export default router;
