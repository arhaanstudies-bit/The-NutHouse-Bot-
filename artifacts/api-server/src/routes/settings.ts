import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UpdateSettingsBody } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/settings", async (_req, res) => {
  try {
    const settings = await db.select().from(settingsTable).limit(1);
    if (!settings.length) {
      // Create default settings
      const created = await db.insert(settingsTable).values({}).returning();
      res.json({
        id: created[0].id,
        botName: created[0].botName,
        adminPassword: created[0].adminPassword,
        minMediaRequired: created[0].minMediaRequired,
        welcomeMessage: created[0].welcomeMessage,
        approvalMessage: created[0].approvalMessage,
        declineMessage: created[0].declineMessage,
        createdAt: created[0].createdAt.toISOString(),
        updatedAt: created[0].updatedAt.toISOString(),
      });
      return;
    }
    const s = settings[0];
    res.json({
      id: s.id,
      botName: s.botName,
      adminPassword: s.adminPassword,
      minMediaRequired: s.minMediaRequired,
      welcomeMessage: s.welcomeMessage,
      approvalMessage: s.approvalMessage,
      declineMessage: s.declineMessage,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "Get settings error");
    res.status(500).json({ error: "Failed to load settings" });
  }
});

router.post("/settings", async (req, res) => {
  try {
    const parsed = UpdateSettingsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }
    const data = parsed.data;
    const existing = await db.select().from(settingsTable).limit(1);
    let result;
    if (!existing.length) {
      result = await db.insert(settingsTable).values({
        botName: data.botName,
        adminPassword: data.adminPassword,
        minMediaRequired: data.minMediaRequired,
        welcomeMessage: data.welcomeMessage,
        approvalMessage: data.approvalMessage,
        declineMessage: data.declineMessage,
      }).returning();
    } else {
      result = await db.update(settingsTable).set({
        botName: data.botName ?? existing[0].botName,
        adminPassword: data.adminPassword ?? existing[0].adminPassword,
        minMediaRequired: data.minMediaRequired ?? existing[0].minMediaRequired,
        welcomeMessage: data.welcomeMessage ?? existing[0].welcomeMessage,
        approvalMessage: data.approvalMessage ?? existing[0].approvalMessage,
        declineMessage: data.declineMessage ?? existing[0].declineMessage,
        updatedAt: new Date(),
      }).where(eq(settingsTable.id, existing[0].id)).returning();
    }
    const s = result[0];
    res.json({
      id: s.id,
      botName: s.botName,
      adminPassword: s.adminPassword,
      minMediaRequired: s.minMediaRequired,
      welcomeMessage: s.welcomeMessage,
      approvalMessage: s.approvalMessage,
      declineMessage: s.declineMessage,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "Update settings error");
    res.status(500).json({ error: "Failed to update settings" });
  }
});

export default router;
