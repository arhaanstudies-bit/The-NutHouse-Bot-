import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { broadcastsTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/broadcasts", async (_req, res) => {
  try {
    const broadcasts = await db.select().from(broadcastsTable).orderBy(broadcastsTable.createdAt);
    res.json(broadcasts.map((b) => ({
      id: b.id,
      mediaId: b.mediaId,
      sentCount: b.sentCount,
      failedCount: b.failedCount,
      createdAt: b.createdAt.toISOString(),
    })));
  } catch (err) {
    logger.error({ err }, "List broadcasts error");
    res.status(500).json({ error: "Failed to load broadcasts" });
  }
});

export default router;
