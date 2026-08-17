import { createInsertSchema } from "drizzle-zod";
import { pgEnum, pgTable, text, timestamp, date } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const taskStatusEnum = pgEnum("important_updates_task_status", ["pending", "in_progress", "complete"]);

export const tasksTable = pgTable("important_updates_tasks", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  status: taskStatusEnum("status").notNull().default("pending"),
  assignedTo: text("assigned_to").references(() => usersTable.id, { onDelete: "set null" }),
  createdBy: text("created_by").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  dueDate: date("due_date", { mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({ createdAt: true, updatedAt: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;