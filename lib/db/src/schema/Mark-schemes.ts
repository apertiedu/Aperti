import { pgTable, text, serial, integer, timestamp, jsonb, numeric } from "drizzle-orm/pg-core";
import { questionBankTable } from "./question-bank";
import { examQuestionsTable } from "./exams";

export const markSchemesTable = pgTable("mark_schemes", {
  id: serial("id").primaryKey(),
  questionBankId: integer("question_bank_id").references(() => questionBankTable.id, { onDelete: "cascade" }),
  examQuestionId: integer("exam_question_id").references(() => examQuestionsTable.id, { onDelete: "cascade" }),
  criteria: jsonb("criteria").$type<Array<{
    keyword: string;
    marks: number;
    description?: string;
  }>>().notNull().default([]),
  totalMarks: numeric("total_marks", { precision: 10, scale: 2 }).notNull().default("0"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type MarkScheme = typeof markSchemesTable.$inferSelect;
