import { createInsertSchema } from "drizzle-zod";
import { mysqlTable, varchar, boolean } from "drizzle-orm/mysql-core";
import { z } from "zod/v4";

export const appSettingsTable = mysqlTable("settings", {
  id: varchar("id", { length: 255 }).primaryKey(),
  theme: varchar("theme", { length: 255 }).notNull().default("system"),
  bubbleStyle: varchar("bubble_style", { length: 255 }).notNull().default("emoji"),
  autoLock: varchar("auto_lock", { length: 255 }).notNull().default("five_minutes"),
  notifications: boolean("notifications").notNull().default(true),
  journeyUrl: varchar("journey_url", { length: 2048 }).notNull().default("https://www.google.com"),
});

export const insertAppSettingsSchema = createInsertSchema(appSettingsTable);
export type InsertAppSettings = z.infer<typeof insertAppSettingsSchema>;
export type AppSettings = typeof appSettingsTable.$inferSelect;