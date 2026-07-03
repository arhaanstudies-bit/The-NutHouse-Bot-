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

const adminKeyboard = {
  keyboard: [
    [{ text: "My Contribution" }, { text: "Stats" }],
    [{ text: "Admin: Users" }, { text: "Admin: Broadcast" }],
    [{ text: "Admin: Approve" }, { text: "Admin: Ban" }],
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

    // Helper: check admin
    async function checkAdmin(): Promise<boolean> {
      if (!u.isAdmin) {
        await sendMessage(chatId, "Access denied. Admin commands are for admins only.");
        return false;
      }
      return true;
    }

    // /start command
    if (text === "/start") {
      const settings = await db.select().from(settingsTable).limit(1);
      const welcomeMsg = settings[0]?.welcomeMessage ?? "Welcome to BR0 PR0 BOT!\n\nRules:\n1. Send 20 videos to apply for admin approval\n2. Admin will review your application\n3. You will receive a confirmation message when approved or declined\n\nUse the buttons below to check your progress and bot stats.";
      const keyboard = u.isAdmin ? adminKeyboard : mainKeyboard;
      await sendMessage(chatId, welcomeMsg, keyboard);
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

    // Admin: Users - list pending users
    if (text === "Admin: Users") {
      if (!(await checkAdmin())) { res.sendStatus(200); return; }
      const pending = await db.select().from(usersTable).where(eq(usersTable.status, "pending")).orderBy(usersTable.createdAt);
      if (!pending.length) {
        await sendMessage(chatId, "No pending users.");
      } else {
        const lines = pending.map((p, i) => `${i + 1}. ${p.firstName} (@${p.username ?? "no username"}) - ID: ${p.id}`);
        await sendMessage(chatId, `Pending Users:\n${lines.join("\n")}\n\nUse /approve <id> or /decline <id>`);
      }
      res.sendStatus(200);
      return;
    }

    // Admin: Approve - show pending for quick approval
    if (text === "Admin: Approve") {
      if (!(await checkAdmin())) { res.sendStatus(200); return; }
      const pending = await db.select().from(usersTable).where(eq(usersTable.status, "pending")).orderBy(usersTable.createdAt);
      if (!pending.length) {
        await sendMessage(chatId, "No pending users to approve.");
      } else {
        const lines = pending.map((p) => `/approve ${p.id} \u2014 ${p.firstName}`);
        await sendMessage(chatId, `Click to approve:\n${lines.join("\n")}`);
      }
      res.sendStatus(200);
      return;
    }

    // Admin: Ban - show approved users for banning
    if (text === "Admin: Ban") {
      if (!(await checkAdmin())) { res.sendStatus(200); return; }
      const approved = await db.select().from(usersTable).where(eq(usersTable.status, "approved")).orderBy(usersTable.updatedAt);
      if (!approved.length) {
        await sendMessage(chatId, "No approved users to ban.");
      } else {
        const lines = approved.map((p) => `/ban ${p.id} \u2014 ${p.firstName}`);
        await sendMessage(chatId, `Click to ban:\n${lines.join("\n")}`);
      }
      res.sendStatus(200);
      return;
    }

    // /approve <id> command
    if (text.startsWith("/approve ")) {
      if (!(await checkAdmin())) { res.sendStatus(200); return; }
      const targetId = Number(text.split(" ")[1]);
      if (!targetId) {
        await sendMessage(chatId, "Usage: /approve <user_id>");
        res.sendStatus(200); return;
      }
      const target = await db.select().from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
      if (!target.length) {
        await sendMessage(chatId, "User not found.");
      } else {
        await db.update(usersTable).set({ status: "approved", updatedAt: new Date() }).where(eq(usersTable.id, targetId));
        const settings = await db.select().from(settingsTable).limit(1);
        const msg = settings[0]?.approvalMessage ?? "Congratulations! Your application has been approved.";
        await sendMessage(Number(target[0].telegramId), `Hi ${target[0].firstName},\n\n${msg}`);
        await sendMessage(chatId, `User ${target[0].firstName} approved.`);
      }
      res.sendStatus(200);
      return;
    }

    // /decline <id> command
    if (text.startsWith("/decline ")) {
      if (!(await checkAdmin())) { res.sendStatus(200); return; }
      const targetId = Number(text.split(" ")[1]);
      if (!targetId) {
        await sendMessage(chatId, "Usage: /decline <user_id>");
        res.sendStatus(200); return;
      }
      const target = await db.select().from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
      if (!target.length) {
        await sendMessage(chatId, "User not found.");
      } else {
        await db.update(usersTable).set({ status: "declined", updatedAt: new Date() }).where(eq(usersTable.id, targetId));
        const settings = await db.select().from(settingsTable).limit(1);
        const msg = settings[0]?.declineMessage ?? "Your application has been declined.";
        await sendMessage(Number(target[0].telegramId), `Hi ${target[0].firstName},\n\n${msg}`);
        await sendMessage(chatId, `User ${target[0].firstName} declined.`);
      }
      res.sendStatus(200);
      return;
    }

    // /ban <id> command
    if (text.startsWith("/ban ")) {
      if (!(await checkAdmin())) { res.sendStatus(200); return; }
      const targetId = Number(text.split(" ")[1]);
      if (!targetId) {
        await sendMessage(chatId, "Usage: /ban <user_id>");
        res.sendStatus(200); return;
      }
      const target = await db.select().from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
      if (!target.length) {
        await sendMessage(chatId, "User not found.");
      } else {
        await db.update(usersTable).set({ status: "banned", updatedAt: new Date() }).where(eq(usersTable.id, targetId));
        await sendMessage(chatId, `User ${target[0].firstName} banned.`);
      }
      res.sendStatus(200);
      return;
    }

    // Admin: Broadcast - send message to all approved users
    if (text === "Admin: Broadcast") {
      if (!(await checkAdmin())) { res.sendStatus(200); return; }
      await sendMessage(chatId, "To broadcast, reply to this message with:\n/broadcast <your message>\n\nIt will be sent to all approved users.");
      res.sendStatus(200);
      return;
    }

    // /broadcast <message> command
    if (text.startsWith("/broadcast ")) {
      if (!(await checkAdmin())) { res.sendStatus(200); return; }
      const broadcastText = text.slice("/broadcast ".length);
      if (!broadcastText.trim()) {
        await sendMessage(chatId, "Usage: /broadcast <message>");
        res.sendStatus(200); return;
      }
      const approved = await db.select().from(usersTable).where(eq(usersTable.status, "approved"));
      let sent = 0;
      for (const target of approved) {
        try {
          await sendMessage(Number(target.telegramId), broadcastText);
          sent++;
        } catch {
          // ignore individual failures
        }
      }
      await sendMessage(chatId, `Broadcast sent to ${sent} approved users.`);
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
