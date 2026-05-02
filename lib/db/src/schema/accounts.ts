import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";

export const accountsTable = pgTable("accounts", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull().default(""),
  role: text("role").notNull().default("admin"),
  status: text("status").notNull().default("active"),
  teacherAccountId: integer("teacher_account_id"),
  systemMode: text("system_mode").notNull().default("full"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Account = typeof accountsTable.$inferSelect;
