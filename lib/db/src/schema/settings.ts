import { createInsertSchema } from "drizzle-zod";
import { pgTable, text, boolean } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const appSettingsTable = pgTable("important_updates_settings", {
  id: text("id").primaryKey(),
  theme: text("theme").notNull().default("system"),
  bubbleStyle: text("bubble_style").notNull().default("emoji"),
  autoLock: text("auto_lock").notNull().default("five_minutes"),
  notifications: boolean("notifications").notNull().default(true),
  journeyUrl: text("journey_url").notNull().default("https://www.google.com"),
});

export const insertAppSettingsSchema = createInsertSchema(appSettingsTable);
export type InsertAppSettings = z.infer<typeof insertAppSettingsSchema>;
export type AppSettings = typeof appSettingsTable.$inferSelect;