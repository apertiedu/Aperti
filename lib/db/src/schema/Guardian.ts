import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { accountsTable } from "./accounts";
import { studentsTable } from "./students";

export const guardianLinksTable = pgTable("guardian_links", {
  id: serial("id").primaryKey(),
  parentAccountId: integer("parent_account_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  pairingCode: text("pairing_code"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const guardianMessagesTable = pgTable("guardian_messages", {
  id: serial("id").primaryKey(),
  fromAccountId: integer("from_account_id").notNull().references(() => accountsTable.id),
  toAccountId: integer("to_account_id").notNull().references(() => accountsTable.id),
  message: text("message").notNull(),
  read: text("read").notNull().default("false"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GuardianLink = typeof guardianLinksTable.$inferSelect;
export type GuardianMessage = typeof guardianMessagesTable.$inferSelect;
