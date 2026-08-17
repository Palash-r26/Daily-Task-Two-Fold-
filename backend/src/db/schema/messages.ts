import { createInsertSchema } from "drizzle-zod";
import { mysqlTable, varchar, mysqlEnum, text, timestamp, foreignKey } from "drizzle-orm/mysql-core";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const messagesTable = mysqlTable("messages", {
  id: varchar("id", { length: 255 }).primaryKey(),
  senderId: varchar("sender_id", { length: 255 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  editedAt: timestamp("edited_at"),
  deletedAt: timestamp("deleted_at"),
  deliveryStatus: mysqlEnum("delivery_status", ["sent", "delivered", "read"]).notNull().default("sent"),
  readAt: timestamp("read_at"),
}, (table) => [
  foreignKey({
    name: "msg_sender_fk",
    columns: [table.senderId],
    foreignColumns: [usersTable.id],
  }).onDelete("cascade"),
]);

export const insertMessageSchema = createInsertSchema(messagesTable).omit({ createdAt: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;