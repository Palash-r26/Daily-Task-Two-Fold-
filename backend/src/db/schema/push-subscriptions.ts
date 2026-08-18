import { mysqlTable, varchar, text, timestamp } from "drizzle-orm/mysql-core";

export const pushSubscriptionsTable = mysqlTable("push_subscriptions", {
  id: varchar("id", { length: 255 }).primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
