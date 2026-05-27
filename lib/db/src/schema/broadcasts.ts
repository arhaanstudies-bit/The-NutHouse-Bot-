import { pgTable, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { z } from "zod";

export const broadcastsTable = pgTable("broadcasts", {
  id: serial("id").primaryKey(),
  mediaId: integer("media_id").notNull(),
  sentCount: integer("sent_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBroadcastSchema = z.object({
  mediaId: z.number(),
  sentCount: z.number().optional(),
  failedCount: z.number().optional(),
});

export type InsertBroadcast = z.infer<typeof insertBroadcastSchema>;
export type Broadcast = typeof broadcastsTable.$inferSelect;
