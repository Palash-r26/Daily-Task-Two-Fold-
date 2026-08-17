import { createInsertSchema } from "drizzle-zod";
import { pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const deliveryStatusEnum = pgEnum("important_updates_delivery_status", ["sent", "delivered", "read"]);

export const messagesTable = pgTable("important_updates_messages", {
  id: text("id").primaryKey(),
  senderId: text("sender_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  editedAt: timestamp("edited_at", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deliveryStatus: deliveryStatusEnum("delivery_status").notNull().default("sent"),
  readAt: timestamp("read_at", { withTimezone: true }),
});

export const insertMessageSchema = createInsertSchema(messagesTable).omit({ createdAt: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;