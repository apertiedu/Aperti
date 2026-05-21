import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { accountsTable } from "./accounts";

export const subjectsTable = pgTable("subjects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  board: text("board").notNull().default("CAIE"),
  code: text("code"),
  level: text("level").notNull().default("Core"),
  modules: jsonb("modules").$type<string[]>(),
  teacherAccountId: integer("teacher_account_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Subject = typeof subjectsTable.$inferSelect;
