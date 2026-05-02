import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { accountsTable } from "./accounts";

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  message: text("message"),
  type: text("type").notNull().default("info"),
  isRead: boolean("is_read").notNull().default(false),
  link: text("link"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Notification = typeof notificationsTable.$inferSelect;
