import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable, settingsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { mediaItemsTable, broadcastsTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";

// Telegram API helpers
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

async function sendMessage(chatId: number, text: string, replyMarkup?: unknown, parseMode = "HTML") {
  return telegramApi("sendMessage", { chat_id: chatId, text, parse_mode: parseMode, reply_markup: replyMarkup });
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

async function deleteMessage(chatId: number, messageId: number) {
  return telegramApi("deleteMessage", { chat_id: chatId, message_id: messageId });
}

// Keyboards
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

const backKeyboard = {
  keyboard: [[{ text: "Back to Menu" }]],
  resize_keyboard: true,
  one_time_keyboard: false,
};

// Inline keyboard for admin actions
function userActionsInline(userId: number, status: string) {
  const buttons: Array<Array<{ text: string; callback_data: string }>> = [];
  if (status === "pending") {
    buttons.push([
      { text: "Approve", callback_data: `approve_${userId}` },
      { text: "Decline", callback_data: `decline_${userId}` },
    ]);
  }
  if (status === "approved") {
    buttons.push([{ text: "Ban User", callback_data: `ban_${userId}` }]);
  }
  if (status === "banned") {
    buttons.push([{ text: "Unban User", callback_data: `unban_${userId}` }]);
  }
  return { inline_keyboard: buttons };
}

// Format helpers
function formatUser(u: typeof usersTable.$inferSelect, mediaCount: number, minRequired: number) {
  const statusEmoji = u.status === "approved" ? "✅" : u.status === "pending" ? "⏳" : u.status === "declined" ? "❌" : "🚫";
  return `<b>${u.firstName} ${u.lastName ?? ""}</b>\n` +
    `ID: <code>${u.id}</code>\n` +
    `Status: ${statusEmoji} ${u.status}\n` +
    `Admin: ${u.isAdmin ? "👑 Yes" : "No"}\n` +
    `Username: @${u.username ?? "N/A"}\n` +
    `Media: ${mediaCount}/${minRequired}\n` +
    `Joined: ${u.createdAt.toLocaleDateString()}`;
}

// Notify all admins
async function notifyAdmins(text: string, excludeTelegramId?: string) {
  try {
    const admins = await db.select().from(usersTable).where(eq(usersTable.isAdmin, true));
    for (const admin of admins) {
      if (excludeTelegramId && admin.telegramId === excludeTelegramId) continue;
      await sendMessage(Number(admin.telegramId), text);
    }
  } catch (err) {
    logger.error({ err }, "Admin notification error");
  }
}

// Media handler
async function handleMedia(telegramId: string, chatId: number, userId: number, type: "photo" | "video", fileId: string, caption: string | null, isApproved: boolean) {
  try {
    const botSettings = await db.select().from(settingsTable).limit(1);
    const minRequired = botSettings[0]?.minMediaRequired ?? 20;

    if (!isApproved) {
      // Pending user: ONLY videos count toward minimum
      if (type === "photo") {
        await sendMessage(chatId,
          `❌ <b>Photos Not Accepted!</b>\n\n` +
          `You must send <b>VIDEOS ONLY</b> to qualify for admin approval.\n` +
          `Please send 20 videos to apply.`,
          mainKeyboard
        );
        return;
      }

      // Save video
      await db.insert(mediaItemsTable).values({
        userId,
        type: "video",
        telegramFileId: fileId,
        caption,
      });

      // Count only videos for this user
      const videoCount = await db.select({ count: count() }).from(mediaItemsTable)
        .where(eq(mediaItemsTable.userId, userId));
      const countVal = videoCount[0]?.count ?? 0;
      const remaining = Math.max(0, minRequired - countVal);

      if (remaining === 0) {
        // User has submitted enough videos! Notify admins for review
        await sendMessage(chatId,
          `🎉 <b>All 20 Videos Submitted!</b>\n\n` +
          `⏳ Your application is now <b>PENDING REVIEW</b>.\n` +
          `Admin will review your videos and approve or decline.\n` +
          `You will receive a confirmation message soon.`,
          mainKeyboard
        );

        // Notify all admins
        await notifyAdmins(
          `🆕 <b>New Application Ready for Review!</b>\n\n` +
          `User: <b>${(await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1))[0]?.firstName}</b>\n` +
          `ID: <code>${userId}</code>\n` +
          `Videos: <b>${countVal}/${minRequired}</b>\n\n` +
          `Tap to review videos: <code>/review ${userId}</code>\n` +
          `Or use Admin: Approve in the menu.`,
          telegramId
        );
      } else {
        await sendMessage(chatId,
          `✅ <b>Video Saved!</b>\n\n` +
          `📊 Progress: <b>${countVal}/${minRequired}</b>\n` +
          `🎯 Need <b>${remaining}</b> more video${remaining === 1 ? "" : "s"} to qualify.\n\n` +
          `Send more videos! Only videos count.`,
          mainKeyboard
        );
      }
      return;
    }

    // Approved user: save and broadcast to all other approved users
    const inserted = await db.insert(mediaItemsTable).values({
      userId,
      type,
      telegramFileId: fileId,
      caption,
    }).returning();
    const mediaId = inserted[0]?.id;

    const approvedUsers = await db.select().from(usersTable).where(eq(usersTable.status, "approved"));
    let sent = 0;
    let failed = 0;

    for (const target of approvedUsers) {
      if (target.telegramId === telegramId) continue;
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

    if (mediaId) {
      await db.insert(broadcastsTable).values({ mediaId, sentCount: sent, failedCount: failed });
    }

    await sendMessage(chatId,
      `🚀 <b>Broadcast Complete!</b>\n\n` +
      `📤 Sent to <b>${sent}</b> approved user${sent === 1 ? "" : "s"}` +
      `${failed > 0 ? `\n⚠️ ${failed} failed` : ""}\n\n` +
      `✨ Your ${type} has been shared with the community!`,
      mainKeyboard
    );
  } catch (err) {
    logger.error({ err }, "Media save/broadcast error");
    await sendMessage(chatId, "❌ Error processing media. Please try again.");
  }
}

// Webhook handler
router.post("/webhooks/telegram", async (req, res) => {
  try {
    const update = req.body;

    // Handle callback queries (inline buttons)
    if (update.callback_query) {
      const callback = update.callback_query;
      const chatId = callback.message?.chat?.id;
      const telegramId = String(callback.from.id);
      const data = callback.data;

      if (!chatId || !data) { res.sendStatus(200); return; }

      const admin = await db.select().from(usersTable).where(eq(usersTable.telegramId, telegramId)).limit(1);
      if (!admin.length || !admin[0].isAdmin) {
        await telegramApi("answerCallbackQuery", { callback_query_id: callback.id, text: "Access denied", show_alert: true });
        res.sendStatus(200); return;
      }

      const action = data.split("_")[0];
      const targetId = Number(data.split("_")[1]);

      const target = await db.select().from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
      if (!target.length) {
        await telegramApi("answerCallbackQuery", { callback_query_id: callback.id, text: "User not found", show_alert: true });
        res.sendStatus(200); return;
      }

      const t = target[0];
      const settings = await db.select().from(settingsTable).limit(1);

      if (action === "approve") {
        await db.update(usersTable).set({ status: "approved", updatedAt: new Date() }).where(eq(usersTable.id, targetId));
        const msg = settings[0]?.approvalMessage ?? "Congratulations! Your application has been approved.";
        await sendMessage(Number(t.telegramId), `🎉 <b>Approved!</b>\n\nHi ${t.firstName},\n\n${msg}`);
        await telegramApi("answerCallbackQuery", { callback_query_id: callback.id, text: `${t.firstName} approved!`, show_alert: true });
        await notifyAdmins(`✅ <b>Admin Action</b>\n\n${admin[0].firstName} approved ${t.firstName}`, t.telegramId);
      } else if (action === "decline") {
        await db.update(usersTable).set({ status: "declined", updatedAt: new Date() }).where(eq(usersTable.id, targetId));
        const msg = settings[0]?.declineMessage ?? "Your application has been declined.";
        await sendMessage(Number(t.telegramId), `❌ <b>Declined</b>\n\nHi ${t.firstName},\n\n${msg}`);
        await telegramApi("answerCallbackQuery", { callback_query_id: callback.id, text: `${t.firstName} declined.`, show_alert: true });
        await notifyAdmins(`❌ <b>Admin Action</b>\n\n${admin[0].firstName} declined ${t.firstName}`, t.telegramId);
      } else if (action === "ban") {
        await db.update(usersTable).set({ status: "banned", updatedAt: new Date() }).where(eq(usersTable.id, targetId));
        await sendMessage(Number(t.telegramId), `🚫 <b>Banned</b>\n\nHi ${t.firstName},\n\nYou have been banned from the bot. Contact an admin if you believe this is a mistake.`);
        await telegramApi("answerCallbackQuery", { callback_query_id: callback.id, text: `${t.firstName} banned.`, show_alert: true });
        await notifyAdmins(`🚫 <b>Admin Action</b>\n\n${admin[0].firstName} banned ${t.firstName}`, t.telegramId);
      } else if (action === "unban") {
        await db.update(usersTable).set({ status: "approved", updatedAt: new Date() }).where(eq(usersTable.id, targetId));
        await sendMessage(Number(t.telegramId), `✅ <b>Unbanned!</b>\n\nHi ${t.firstName},\n\nYou have been unbanned and re-approved. Welcome back!`);
        await telegramApi("answerCallbackQuery", { callback_query_id: callback.id, text: `${t.firstName} unbanned.`, show_alert: true });
        await notifyAdmins(`✅ <b>Admin Action</b>\n\n${admin[0].firstName} unbanned ${t.firstName}`, t.telegramId);
      }

      res.sendStatus(200);
      return;
    }

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
    const isNewUser = !user.length;
    if (isNewUser) {
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

    // Notify admins of new user
    if (isNewUser) {
      await notifyAdmins(`🆕 <b>New User!</b>\n\n` +
        `<b>${firstName}</b> just joined the bot.\n` +
        `Username: @${username ?? "N/A"}\n` +
        `ID: <code>${u.id}</code>`, telegramId);
    }

    // Helper: check admin
    async function checkAdmin(): Promise<boolean> {
      if (!u.isAdmin) {
        await sendMessage(chatId, "🚫 <b>Access Denied</b>\n\nThis command is for admins only.");
        return false;
      }
      return true;
    }

    // Handle media
    if (message.photo || message.video) {
      const type = message.video ? "video" : "photo";
      const fileId = message.video ? message.video.file_id : message.photo[message.photo.length - 1].file_id;
      const caption = message.caption ?? null;
      const isApproved = u.status === "approved";
      await handleMedia(telegramId, chatId, u.id, type as "photo" | "video", fileId, caption, isApproved);

      // Try to delete the original message from sender
      try {
        await deleteMessage(chatId, message.message_id);
      } catch {
        // Ignore deletion errors (bot may not have permission)
      }
      res.sendStatus(200);
      return;
    }

    if (!text) {
      res.sendStatus(200);
      return;
    }

    // /start command
    if (text === "/start") {
      const settings = await db.select().from(settingsTable).limit(1);
      const welcomeMsg = settings[0]?.welcomeMessage ??
        `👋 <b>Welcome to BRO X BOT!</b>\n\n` +
        `📋 <b>MANDATORY RULES:</b>\n` +
        `1. You MUST send <b>20 VIDEOS</b> to qualify for admin approval\n` +
        `2. Photos are NOT accepted for approval\n` +
        `3. Admin will REVIEW your videos before approval\n` +
        `4. You will receive a confirmation when approved or declined\n\n` +
        `Use the buttons below to check your progress.`;
      const keyboard = u.isAdmin ? adminKeyboard : mainKeyboard;
      await sendMessage(chatId, welcomeMsg, keyboard);
      res.sendStatus(200);
      return;
    }

    // /help command
    if (text === "/help") {
      let helpText =
        `📖 <b>BRO X BOT Help</b>\n\n` +
        `<b>User Commands:</b>\n` +
        `/start - Show welcome message\n` +
        `/help - Show this help message\n` +
        `My Contribution - Check your progress\n` +
        `Stats - View bot statistics\n\n`;

      if (u.isAdmin) {
        helpText +=
          `<b>Admin Commands:</b>\n` +
          `/approve &lt;id&gt; - Approve a pending user\n` +
          `/decline &lt;id&gt; - Decline a pending user\n` +
          `/review &lt;id&gt; - View user's submitted videos\n` +
          `/ban &lt;id&gt; - Ban an approved user\n` +
          `/unban &lt;id&gt; - Unban a banned user\n` +
          `/br0 &lt;id&gt; - Promote user to admin\n` +
          `/info &lt;id&gt; - View user details\n` +
          `/broadcast &lt;msg&gt; - Send message to all approved\n` +
          `Admin: Users - List pending users\n` +
          `Admin: Approve - Quick approve list\n` +
          `Admin: Ban - Quick ban list\n` +
          `Admin: Broadcast - Broadcast guide`;
      }
      await sendMessage(chatId, helpText, u.isAdmin ? adminKeyboard : mainKeyboard);
      res.sendStatus(200);
      return;
    }

    // Back to Menu
    if (text === "Back to Menu") {
      const keyboard = u.isAdmin ? adminKeyboard : mainKeyboard;
      await sendMessage(chatId, "👋 Welcome back! Choose an option:", keyboard);
      res.sendStatus(200);
      return;
    }

    // /agentbro - promote self to admin
    if (text === "/agentbro") {
      if (u.isAdmin) {
        await sendMessage(chatId, "👑 You are already an admin of BRO X BOT.");
      } else {
        await db.update(usersTable).set({ isAdmin: true, updatedAt: new Date() }).where(eq(usersTable.id, u.id));
        await sendMessage(chatId,
          `🎉 <b>Congratulations ${firstName}!</b>\n\n` +
          `You are now an admin of BRO X BOT.\n` +
          `Use /help to see all admin commands.`,
          adminKeyboard
        );
        await notifyAdmins(`👑 <b>New Admin!</b>\n\n${firstName} promoted themselves to admin.`, telegramId);
      }
      res.sendStatus(200);
      return;
    }

    // /br0 <user_id> - promote another user to admin
    if (text.startsWith("/br0 ")) {
      if (!(await checkAdmin())) { res.sendStatus(200); return; }
      const targetId = Number(text.split(" ")[1]);
      if (!targetId) { await sendMessage(chatId, "Usage: <code>/br0 &lt;user_id&gt;</code>"); res.sendStatus(200); return; }

      const target = await db.select().from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
      if (!target.length) { await sendMessage(chatId, "❌ User not found."); }
      else if (target[0].isAdmin) { await sendMessage(chatId, `👑 ${target[0].firstName} is already an admin.`); }
      else {
        await db.update(usersTable).set({ isAdmin: true, updatedAt: new Date() }).where(eq(usersTable.id, targetId));
        await sendMessage(Number(target[0].telegramId),
          `🎉 <b>You have been promoted to Admin!</b>\n\n` +
          `Promoted by: <b>${firstName}</b>\n\n` +
          `<b>Your new powers:</b>\n` +
          `\u2022 Approve/decline users\n` +
          `\u2022 Ban/unban users\n` +
          `\u2022 Broadcast to all approved users\n` +
          `\u2022 Promote others to admin\n` +
          `\u2022 Access the web admin panel`,
          adminKeyboard
        );
        await sendMessage(chatId, `👑 <b>${target[0].firstName} promoted to admin!</b>`);
        await notifyAdmins(`👑 <b>New Admin</b>\n\n${firstName} promoted ${target[0].firstName} to admin.`, telegramId);
      }
      res.sendStatus(200);
      return;
    }

    // My Contribution
    if (text === "My Contribution") {
      const mediaCount = await db.select({ count: count() }).from(mediaItemsTable).where(eq(mediaItemsTable.userId, u.id));
      const countVal = mediaCount[0]?.count ?? 0;
      const botSettings = await db.select().from(settingsTable).limit(1);
      const minRequired = botSettings[0]?.minMediaRequired ?? 20;
      const progress = Math.min(100, Math.round((countVal / minRequired) * 100));

      const statusEmoji = u.status === "approved" ? "✅" : u.status === "pending" ? "⏳" : u.status === "declined" ? "❌" : "🚫";
      const statusText = u.status === "approved" ? "You are approved and can broadcast media!" :
        u.status === "pending" ? `Submit <b>${minRequired}</b> media items to apply. (${countVal}/${minRequired})` :
        "You have been declined or banned.";

      const videoOnlyNote = u.status === "pending"
        ? `\n\n🚨 <b>VIDEOS ONLY</b> - Photos are not accepted for approval.`
        : "";

      await sendMessage(chatId,
        `📊 <b>My Contribution</b>\n\n` +
        `🎬 Videos Submitted: <b>${countVal}</b>\n` +
        `📈 Progress: <b>${progress}%</b>\n` +
        `🎯 Minimum Required: <b>${minRequired} VIDEOS</b>\n` +
        `📋 Status: ${statusEmoji} <b>${u.status}</b>\n\n` +
        `${statusText}${videoOnlyNote}`
      );
      res.sendStatus(200);
      return;
    }

    // Stats
    if (text === "Stats") {
      const totalUsers = await db.select({ count: count() }).from(usersTable);
      const approvedUsers = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.status, "approved"));
      const pendingUsers = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.status, "pending"));
      const declinedUsers = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.status, "declined"));
      const bannedUsers = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.status, "banned"));
      const totalMedia = await db.select({ count: count() }).from(mediaItemsTable);
      const totalBroadcasts = await db.select({ count: count() }).from(broadcastsTable);

      await sendMessage(chatId,
        `📊 <b>Bot Statistics</b>\n\n` +
        `👥 Total Users: <b>${totalUsers[0]?.count ?? 0}</b>\n` +
        `✅ Approved: <b>${approvedUsers[0]?.count ?? 0}</b>\n` +
        `⏳ Pending: <b>${pendingUsers[0]?.count ?? 0}</b>\n` +
        `❌ Declined: <b>${declinedUsers[0]?.count ?? 0}</b>\n` +
        `🚫 Banned: <b>${bannedUsers[0]?.count ?? 0}</b>\n` +
        `📁 Total Media: <b>${totalMedia[0]?.count ?? 0}</b>\n` +
        `📢 Broadcasts: <b>${totalBroadcasts[0]?.count ?? 0}</b>`
      );
      res.sendStatus(200);
      return;
    }

    // Admin: Users - list all users with inline actions
    if (text === "Admin: Users") {
      if (!(await checkAdmin())) { res.sendStatus(200); return; }
      const allUsers = await db.select().from(usersTable).orderBy(usersTable.createdAt);
      if (!allUsers.length) {
        await sendMessage(chatId, "No users found.");
      } else {
        await sendMessage(chatId,
          `👥 <b>All Users (${allUsers.length})</b>\n\n` +
          allUsers.map(uu => {
            const emoji = uu.status === "approved" ? "✅" : uu.status === "pending" ? "⏳" : uu.status === "declined" ? "❌" : "🚫";
            return `${emoji} <b>${uu.firstName}</b> (ID: <code>${uu.id}</code>) - ${uu.status}${uu.isAdmin ? " 👑" : ""}`;
          }).join("\n") + "\n\nUse /info &lt;id&gt; for details"
        );
      }
      res.sendStatus(200);
      return;
    }

    // Admin: Approve
    if (text === "Admin: Approve") {
      if (!(await checkAdmin())) { res.sendStatus(200); return; }
      const pending = await db.select().from(usersTable).where(eq(usersTable.status, "pending")).orderBy(usersTable.createdAt);
      if (!pending.length) {
        await sendMessage(chatId, "⏳ No pending users to approve.");
      } else {
        await sendMessage(chatId,
          `⏳ <b>Pending Users (${pending.length})</b>\n\n` +
          pending.map(p => `/approve ${p.id} \u2014 ${p.firstName}`).join("\n") + "\n\n" +
          "Or tap a user below:"
        );
        for (const p of pending) {
          await sendMessage(chatId, formatUser(p, 0, 20), userActionsInline(p.id, p.status));
        }
      }
      res.sendStatus(200);
      return;
    }

    // Admin: Ban
    if (text === "Admin: Ban") {
      if (!(await checkAdmin())) { res.sendStatus(200); return; }
      const approved = await db.select().from(usersTable).where(eq(usersTable.status, "approved")).orderBy(usersTable.updatedAt);
      if (!approved.length) {
        await sendMessage(chatId, "✅ No approved users to ban.");
      } else {
        await sendMessage(chatId,
          `✅ <b>Approved Users (${approved.length})</b>\n\n` +
          approved.map(p => `/ban ${p.id} \u2014 ${p.firstName}`).join("\n") + "\n\n" +
          "Or tap a user below:"
        );
        for (const p of approved) {
          await sendMessage(chatId, formatUser(p, 0, 20), userActionsInline(p.id, p.status));
        }
      }
      res.sendStatus(200);
      return;
    }

    // /info <id>
    if (text.startsWith("/info ")) {
      if (!(await checkAdmin())) { res.sendStatus(200); return; }
      const targetId = Number(text.split(" ")[1]);
      if (!targetId) { await sendMessage(chatId, "Usage: <code>/info &lt;user_id&gt;</code>"); res.sendStatus(200); return; }

      const target = await db.select().from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
      if (!target.length) { await sendMessage(chatId, "❌ User not found."); }
      else {
        const mediaResult = await db.select({ count: count() }).from(mediaItemsTable).where(eq(mediaItemsTable.userId, targetId));
        const botSettings = await db.select().from(settingsTable).limit(1);
        const minRequired = botSettings[0]?.minMediaRequired ?? 20;
        await sendMessage(chatId, formatUser(target[0], mediaResult[0]?.count ?? 0, minRequired), userActionsInline(targetId, target[0].status));
      }
      res.sendStatus(200);
      return;
    }

    // /review <id> - view user's submitted videos
    if (text.startsWith("/review ")) {
      if (!(await checkAdmin())) { res.sendStatus(200); return; }
      const targetId = Number(text.split(" ")[1]);
      if (!targetId) { await sendMessage(chatId, "Usage: <code>/review &lt;user_id&gt;</code>"); res.sendStatus(200); return; }

      const target = await db.select().from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
      if (!target.length) { await sendMessage(chatId, "❌ User not found."); res.sendStatus(200); return; }

      const t = target[0];
      const media = await db.select().from(mediaItemsTable)
        .where(eq(mediaItemsTable.userId, targetId))
        .orderBy(mediaItemsTable.createdAt);
      const videoMedia = media.filter(m => m.type === "video");

      if (!videoMedia.length) {
        await sendMessage(chatId, `❌ <b>${t.firstName}</b> has not submitted any videos yet.`, userActionsInline(targetId, t.status));
      } else {
        await sendMessage(chatId,
          `🎬 <b>Review: ${t.firstName}</b>\n\n` +
          `Submitted <b>${videoMedia.length}</b> video${videoMedia.length === 1 ? "" : "s"}\n` +
          `Status: ${t.status === "pending" ? "⏳ PENDING REVIEW" : t.status === "approved" ? "✅ Approved" : "❌ Declined"}\n\n` +
          `Sending videos now...`,
          userActionsInline(targetId, t.status)
        );

        // Send all videos to admin for review
        for (const m of videoMedia) {
          await sendVideo(chatId, m.telegramFileId, m.caption ?? `Video from ${t.firstName}`);
        }
      }
      res.sendStatus(200);
      return;
    }

    // /approve <id>
    if (text.startsWith("/approve ")) {
      if (!(await checkAdmin())) { res.sendStatus(200); return; }
      const targetId = Number(text.split(" ")[1]);
      if (!targetId) { await sendMessage(chatId, "Usage: <code>/approve &lt;user_id&gt;</code>"); res.sendStatus(200); return; }

      const target = await db.select().from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
      if (!target.length) { await sendMessage(chatId, "❌ User not found."); }
      else {
        await db.update(usersTable).set({ status: "approved", updatedAt: new Date() }).where(eq(usersTable.id, targetId));
        const settings = await db.select().from(settingsTable).limit(1);
        const msg = settings[0]?.approvalMessage ?? "Congratulations! Your application has been approved.";
        await sendMessage(Number(target[0].telegramId), `🎉 <b>Approved!</b>\n\nHi ${target[0].firstName},\n\n${msg}`);
        await sendMessage(chatId, `✅ <b>${target[0].firstName}</b> has been approved.`);
        await notifyAdmins(`✅ <b>Admin Action</b>\n\n${firstName} approved ${target[0].firstName}`, target[0].telegramId);
      }
      res.sendStatus(200);
      return;
    }

    // /decline <id>
    if (text.startsWith("/decline ")) {
      if (!(await checkAdmin())) { res.sendStatus(200); return; }
      const targetId = Number(text.split(" ")[1]);
      if (!targetId) { await sendMessage(chatId, "Usage: <code>/decline &lt;user_id&gt;</code>"); res.sendStatus(200); return; }

      const target = await db.select().from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
      if (!target.length) { await sendMessage(chatId, "❌ User not found."); }
      else {
        await db.update(usersTable).set({ status: "declined", updatedAt: new Date() }).where(eq(usersTable.id, targetId));
        const settings = await db.select().from(settingsTable).limit(1);
        const msg = settings[0]?.declineMessage ?? "Your application has been declined.";
        await sendMessage(Number(target[0].telegramId), `❌ <b>Declined</b>\n\nHi ${target[0].firstName},\n\n${msg}`);
        await sendMessage(chatId, `❌ <b>${target[0].firstName}</b> has been declined.`);
        await notifyAdmins(`❌ <b>Admin Action</b>\n\n${firstName} declined ${target[0].firstName}`, target[0].telegramId);
      }
      res.sendStatus(200);
      return;
    }

    // /ban <id>
    if (text.startsWith("/ban ")) {
      if (!(await checkAdmin())) { res.sendStatus(200); return; }
      const targetId = Number(text.split(" ")[1]);
      if (!targetId) { await sendMessage(chatId, "Usage: <code>/ban &lt;user_id&gt;</code>"); res.sendStatus(200); return; }

      const target = await db.select().from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
      if (!target.length) { await sendMessage(chatId, "❌ User not found."); }
      else {
        await db.update(usersTable).set({ status: "banned", updatedAt: new Date() }).where(eq(usersTable.id, targetId));
        await sendMessage(Number(target[0].telegramId), `🚫 <b>Banned</b>\n\nHi ${target[0].firstName},\n\nYou have been banned from the bot. Contact an admin if you believe this is a mistake.`);
        await sendMessage(chatId, `🚫 <b>${target[0].firstName}</b> has been banned.`);
        await notifyAdmins(`🚫 <b>Admin Action</b>\n\n${firstName} banned ${target[0].firstName}`, target[0].telegramId);
      }
      res.sendStatus(200);
      return;
    }

    // /unban <id>
    if (text.startsWith("/unban ")) {
      if (!(await checkAdmin())) { res.sendStatus(200); return; }
      const targetId = Number(text.split(" ")[1]);
      if (!targetId) { await sendMessage(chatId, "Usage: <code>/unban &lt;user_id&gt;</code>"); res.sendStatus(200); return; }

      const target = await db.select().from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
      if (!target.length) { await sendMessage(chatId, "❌ User not found."); }
      else {
        await db.update(usersTable).set({ status: "approved", updatedAt: new Date() }).where(eq(usersTable.id, targetId));
        await sendMessage(Number(target[0].telegramId), `✅ <b>Unbanned!</b>\n\nHi ${target[0].firstName},\n\nYou have been unbanned and re-approved. Welcome back!`);
        await sendMessage(chatId, `✅ <b>${target[0].firstName}</b> has been unbanned and re-approved.`);
        await notifyAdmins(`✅ <b>Admin Action</b>\n\n${firstName} unbanned ${target[0].firstName}`, target[0].telegramId);
      }
      res.sendStatus(200);
      return;
    }

    // Admin: Broadcast guide
    if (text === "Admin: Broadcast") {
      if (!(await checkAdmin())) { res.sendStatus(200); return; }
      await sendMessage(chatId,
        `📢 <b>Broadcast Guide</b>\n\n` +
        `Send a message to ALL approved users:\n` +
        `<code>/broadcast Your message here</code>\n\n` +
        `Or send media directly — it will auto-broadcast!`,
        backKeyboard
      );
      res.sendStatus(200);
      return;
    }

    // /broadcast <message>
    if (text.startsWith("/broadcast ")) {
      if (!(await checkAdmin())) { res.sendStatus(200); return; }
      const broadcastText = text.slice("/broadcast ".length);
      if (!broadcastText.trim()) { await sendMessage(chatId, "Usage: <code>/broadcast &lt;message&gt;</code>"); res.sendStatus(200); return; }

      const approved = await db.select().from(usersTable).where(eq(usersTable.status, "approved"));
      let sent = 0;
      let failed = 0;
      for (const target of approved) {
        try {
          await sendMessage(Number(target.telegramId), broadcastText);
          sent++;
        } catch { failed++; }
      }
      await sendMessage(chatId,
        `📢 <b>Broadcast Complete!</b>\n\n` +
        `✅ Sent: <b>${sent}</b>\n` +
        `${failed > 0 ? `❌ Failed: <b>${failed}</b>\n` : ""}` +
        `👥 Total Approved: <b>${approved.length}</b>`
      );
      await notifyAdmins(`📢 <b>Broadcast Alert</b>\n\n${firstName} broadcast a message to ${sent} approved users.`, telegramId);
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
