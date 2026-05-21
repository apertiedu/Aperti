import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { subjectsTable } from "./subjects";

export const examinerReportsTable = pgTable("examiner_reports", {
  id: serial("id").primaryKey(),
  subjectId: integer("subject_id").notNull().references(() => subjectsTable.id, { onDelete: "cascade" }),
  board: text("board").notNull(),
  year: integer("year").notNull(),
  content: text("content").notNull(),
  commonMistakes: text("common_mistakes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ExaminerReport = typeof examinerReportsTable.$inferSelect;
