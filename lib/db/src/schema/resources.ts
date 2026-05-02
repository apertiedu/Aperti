import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { accountsTable } from "./accounts";
import { subjectsTable } from "./subjects";

export const resourcesTable = pgTable("resources", {
  id: serial("id").primaryKey(),
  teacherAccountId: integer("teacher_account_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  subjectId: integer("subject_id").references(() => subjectsTable.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull().default("link"),
  url: text("url"),
  content: text("content"),
  topic: text("topic"),
  tags: text("tags"),
  isStudentVisible: boolean("is_student_visible").notNull().default(true),
  viewCount: integer("view_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Resource = typeof resourcesTable.$inferSelect;
