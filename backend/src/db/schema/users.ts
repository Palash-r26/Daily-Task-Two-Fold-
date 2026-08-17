import { createInsertSchema } from "drizzle-zod";
import { mysqlTable, varchar, timestamp } from "drizzle-orm/mysql-core";
import { z } from "zod/v4";

export const usersTable = mysqlTable("users", {
  id: varchar("id", { length: 255 }).primaryKey(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  profilePhotoUrl: varchar("profile_photo_url", { length: 2048 }),
  partnerId: varchar("partner_id", { length: 255 }),
  inviteCode: varchar("invite_code", { length: 64 }),
  resetToken: varchar("reset_token", { length: 255 }),
  resetTokenExpiry: timestamp("reset_token_expiry"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;