import { createInsertSchema } from "drizzle-zod";
import { mysqlTable, varchar, mysqlEnum, text, timestamp, date, foreignKey } from "drizzle-orm/mysql-core";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const tasksTable = mysqlTable("tasks", {
  id: varchar("id", { length: 255 }).primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["pending", "in_progress", "complete"]).notNull().default("pending"),
  assignedTo: varchar("assigned_to", { length: 255 }),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  dueDate: date("due_date", { mode: "string" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  foreignKey({
    name: "task_assignee_fk",
    columns: [table.assignedTo],
    foreignColumns: [usersTable.id],
  }).onDelete("set null"),
  foreignKey({
    name: "task_creator_fk",
    columns: [table.createdBy],
    foreignColumns: [usersTable.id],
  }).onDelete("cascade"),
]);

export const insertTaskSchema = createInsertSchema(tasksTable).omit({ createdAt: true, updatedAt: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;