import { pgTable, serial, varchar, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { z } from "zod";

export const userStatusEnum = pgEnum("user_status", ["pending", "approved", "declined", "banned"]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  telegramId: varchar("telegram_id", { length: 64 }).notNull().unique(),
  username: varchar("username", { length: 64 }),
  firstName: varchar("first_name", { length: 256 }).notNull(),
  lastName: varchar("last_name", { length: 256 }),
  status: userStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = z.object({
  telegramId: z.string(),
  username: z.string().nullable().optional(),
  firstName: z.string(),
  lastName: z.string().nullable().optional(),
  status: z.enum(["pending", "approved", "declined", "banned"]).optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
