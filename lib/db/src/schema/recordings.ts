import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { accountsTable } from "./accounts";
import { subjectsTable } from "./subjects";

export const recordingsTable = pgTable("recordings", {
  id: serial("id").primaryKey(),
  teacherAccountId: integer("teacher_account_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  subjectId: integer("subject_id").references(() => subjectsTable.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  url: text("url").notNull(),
  passcode: text("passcode"),
  platform: text("platform").notNull().default("zoom"),
  accessType: text("access_type").notNull().default("free"),
  accessUntil: timestamp("access_until", { withTimezone: true }),
  isPublished: boolean("is_published").notNull().default(true),
  viewCount: integer("view_count").notNull().default(0),
  duration: text("duration"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Recording = typeof recordingsTable.$inferSelect;
