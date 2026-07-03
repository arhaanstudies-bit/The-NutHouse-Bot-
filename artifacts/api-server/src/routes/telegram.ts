import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable, settingsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { mediaItemsTable, broadcastsTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";

async function telegramApi(method: string, body: object) {
  if (!BOT_TOKEN) {
    logger.warn("TELEGRAM_BOT_TOKEN not set, skipping Telegram API call");
    return null;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return await res.json();
  } catch (err) {
    logger.error({ err }, "Telegram API error");
    return null;
  }
}

async function sendMessage(chatId: number, text: string, replyMarkup?: unknown) {
  return telegramApi("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", reply_markup: replyMarkup });
}

async function sendPhoto(chatId: number, fileId: string, caption?: string | null) {
  const body: Record<string, unknown> = { chat_id: chatId, photo: fileId };
  if (caption) body.caption = caption;
  return telegramApi("sendPhoto", body);
}

async function sendVideo(chatId: number, fileId: string, caption?: string | null) {
  const body: Record<string, unknown> = { chat_id: chatId, video: fileId };
  if (caption) body.caption = caption;
  return telegramApi("sendVideo", body);
}

const mainKeyboard = {
  keyboard: [
    [{ text: "My Contribution" }],
    [{ text: "Stats" }],
  ],
  resize_keyboard: true,
  one_time_keyboard: false,
};

async function handleMedia(telegramId: string, chatId: number, userId: number, type: "photo" | "video", fileId: string, caption: string | null, isApproved: boolean) {
  try {
    // Save media to DB
    const inserted = await db.insert(mediaItemsTable).values({
      userId,
      type,
      telegramFileId: fileId,
      caption,
    }).returning();
    const mediaId = inserted[0]?.id;

    if (!isApproved) {
      // Pending user: just count toward their minimum
      const mediaCount = await db.select({ count: count() }).from(mediaItemsTable).where(eq(mediaItemsTable.userId, userId));
      const countVal = mediaCount[0]?.count ?? 0;
      const botSettings = await db.select().from(settingsTable).limit(1);
      const minRequired = botSettings[0]?.minMediaRequired ?? 20;
      await sendMessage(chatId, `Media received! (${countVal}/${minRequired} collected)\nKeep sending ${type === "photo" ? "photos" : "videos"} to reach the minimum.`);
      return;
    }

    // Approved user: broadcast to all OTHER approved users
    const approvedUsers = await db.select().from(usersTable).where(eq(usersTable.status, "approved"));
    let sent = 0;
    let failed = 0;

    for (const target of approvedUsers) {
      if (target.telegramId === telegramId) continue; // skip sender
      const targetChatId = Number(target.telegramId);
      try {
        if (type === "photo") {
          await sendPhoto(targetChatId, fileId, caption);
        } else {
          await sendVideo(targetChatId, fileId, caption);
        }
        sent++;
      } catch (err) {
        failed++;
        logger.error({ err, targetUserId: target.id }, "Broadcast send error");
      }
    }

    // Record broadcast
    if (mediaId) {
      await db.insert(broadcastsTable).values({
        mediaId,
        sentCount: sent,
        failedCount: failed,
      });
    }

    // Confirm to sender
    await sendMessage(chatId, `Your ${type} has been broadcast to ${sent} approved user${sent === 1 ? "" : "s"}.${failed > 0 ? ` (${failed} failed)` : ""}\nIt has been deleted from your chat.`);
  } catch (err) {
    logger.error({ err }, "Media save/broadcast error");
    await sendMessage(chatId, "Error processing media. Please try again.");
  }
}

router.post("/webhooks/telegram", async (req, res) => {
  try {
    const update = req.body;
    const message = update.message;
    if (!message || !message.from) {
      res.sendStatus(200);
      return;
    }

    const chatId = message.chat.id;
    const telegramId = String(message.from.id);
    const username = message.from.username ?? null;
    const firstName = message.from.first_name ?? "User";
    const lastName = message.from.last_name ?? null;
    const text = message.text?.trim();

    // Find or create user
    let user = await db.select().from(usersTable).where(eq(usersTable.telegramId, telegramId)).limit(1);
    if (!user.length) {
      const inserted = await db.insert(usersTable).values({
        telegramId,
        username,
        firstName,
        lastName,
        status: "pending",
      }).returning();
      user = inserted;
    }

    const u = user[0];

    // Handle media (photo or video)
    if (message.photo || message.video) {
      const type = message.video ? "video" : "photo";
      const fileId = message.video ? message.video.file_id : message.photo[message.photo.length - 1].file_id;
      const caption = message.caption ?? null;
      const isApproved = u.status === "approved";
      await handleMedia(telegramId, chatId, u.id, type as "photo" | "video", fileId, caption, isApproved);
      res.sendStatus(200);
      return;
    }

    if (!text) {
      res.sendStatus(200);
      return;
    }

    // /agentbro command - promote to admin
    if (text === "/agentbro") {
      if (u.isAdmin) {
        await sendMessage(chatId, "You are already an admin of BR0 PR0 BOT.");
      } else {
        await db.update(usersTable).set({ isAdmin: true, updatedAt: new Date() }).where(eq(usersTable.id, u.id));
        await sendMessage(chatId, `Congratulations ${firstName}! You are now an admin of BR0 PR0 BOT. You can access the admin panel.`);
      }
      res.sendStatus(200);
      return;
    }

    // /start command
    if (text === "/start") {
      const settings = await db.select().from(settingsTable).limit(1);
      const welcomeMsg = settings[0]?.welcomeMessage ?? "Welcome to BR0 PR0 BOT!\n\nRules:\n1. Send 20 videos to apply for admin approval\n2. Admin will review your application\n3. You will receive a confirmation message when approved or declined\n\nUse the buttons below to check your progress and bot stats.";
      await sendMessage(chatId, welcomeMsg, mainKeyboard);
      res.sendStatus(200);
      return;
    }

    // Handle "My Contribution" button
    if (text === "My Contribution") {
      const mediaCount = await db.select({ count: count() }).from(mediaItemsTable).where(eq(mediaItemsTable.userId, u.id));
      const countVal = mediaCount[0]?.count ?? 0;
      const botSettings = await db.select().from(settingsTable).limit(1);
      const minRequired = botSettings[0]?.minMediaRequired ?? 20;
      const statusMsg = u.status === "approved" ? "You are approved and can send media." : u.status === "pending" ? `You have submitted ${countVal} media. Need ${minRequired} to apply.` : "You have been declined or banned.";
      await sendMessage(chatId, `Your Contribution:\nMedia submitted: ${countVal}\nStatus: ${u.status}\n${statusMsg}`);
      res.sendStatus(200);
      return;
    }

    // Handle "Stats" button
    if (text === "Stats") {
      const totalUsers = await db.select({ count: count() }).from(usersTable);
      const approvedUsers = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.status, "approved"));
      const pendingUsers = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.status, "pending"));
      const totalMedia = await db.select({ count: count() }).from(mediaItemsTable);
      const totalBroadcasts = await db.select({ count: count() }).from(broadcastsTable);
      await sendMessage(chatId, `Bot Stats:\nTotal Users: ${totalUsers[0]?.count ?? 0}\nApproved: ${approvedUsers[0]?.count ?? 0}\nPending: ${pendingUsers[0]?.count ?? 0}\nTotal Media: ${totalMedia[0]?.count ?? 0}\nBroadcasts: ${totalBroadcasts[0]?.count ?? 0}`);
      res.sendStatus(200);
      return;
    }

    // Default: acknowledge
    res.sendStatus(200);
  } catch (err) {
    logger.error({ err }, "Telegram webhook error");
    res.sendStatus(200);
  }
});

export default router;
