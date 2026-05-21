import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { accountsTable } from "./accounts";

export const helpdeskTicketsTable = pgTable("helpdesk_tickets", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  priority: text("priority").notNull().default("normal"),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type HelpdeskTicket = typeof helpdeskTicketsTable.$inferSelect;
