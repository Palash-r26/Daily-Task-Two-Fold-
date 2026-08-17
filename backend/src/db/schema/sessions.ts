import { createInsertSchema } from "drizzle-zod";
import { mysqlTable, varchar, timestamp, foreignKey } from "drizzle-orm/mysql-core";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const sessionsTable = mysqlTable("sessions", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  deviceLabel: varchar("device_label", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastActiveAt: timestamp("last_active_at").notNull().defaultNow(),
  revokedAt: timestamp("revoked_at"),
}, (table) => [
  foreignKey({
    name: "session_user_fk",
    columns: [table.userId],
    foreignColumns: [usersTable.id],
  }).onDelete("cascade"),
]);

export const insertSessionSchema = createInsertSchema(sessionsTable).omit({ createdAt: true, lastActiveAt: true });
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessionsTable.$inferSelect;