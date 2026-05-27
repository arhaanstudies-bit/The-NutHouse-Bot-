import { pgTable, serial, varchar, text, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { z } from "zod";

export const mediaTypeEnum = pgEnum("media_type", ["photo", "video"]);

export const mediaItemsTable = pgTable("media_items", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: mediaTypeEnum("type").notNull(),
  telegramFileId: varchar("telegram_file_id", { length: 512 }).notNull(),
  caption: text("caption"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMediaItemSchema = z.object({
  userId: z.number(),
  type: z.enum(["photo", "video"]),
  telegramFileId: z.string(),
  caption: z.string().nullable().optional(),
});

export type InsertMediaItem = z.infer<typeof insertMediaItemSchema>;
export type MediaItem = typeof mediaItemsTable.$inferSelect;
