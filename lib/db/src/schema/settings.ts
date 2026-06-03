import { pgTable, serial, varchar, text, timestamp, integer } from "drizzle-orm/pg-core";
import { z } from "zod";

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  botName: varchar("bot_name", { length: 256 }).notNull().default("BR0 PR0 BOT"),
  adminPassword: varchar("admin_password", { length: 256 }),
  minMediaRequired: integer("min_media_required").notNull().default(20),
  welcomeMessage: text("welcome_message").default("Welcome to BR0 PR0 BOT!\n\nRules:\n1. Send 20 videos to apply for admin approval\n2. Admin will review your application\n3. You will receive a confirmation message when approved or declined\n\nUse the buttons below to check your progress and bot stats."),
  approvalMessage: text("approval_message"),
  declineMessage: text("decline_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSettingsSchema = z.object({
  botName: z.string().optional(),
  adminPassword: z.string().nullable().optional(),
  minMediaRequired: z.number().optional(),
  welcomeMessage: z.string().nullable().optional(),
  approvalMessage: z.string().nullable().optional(),
  declineMessage: z.string().nullable().optional(),
});

export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settingsTable.$inferSelect;
