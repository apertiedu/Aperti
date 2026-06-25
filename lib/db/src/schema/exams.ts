import { pgTable, text, serial, integer, timestamp, date, numeric, jsonb } from "drizzle-orm/pg-core";
import { accountsTable } from "./accounts";
import { subjectsTable } from "./subjects";
import { studentsTable } from "./students";

export const examsTable = pgTable("exams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  subjectId: integer("subject_id").references(() => subjectsTable.id, { onDelete: "set null" }),
  teacherAccountId: integer("teacher_account_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  examDate: date("exam_date"),
  totalMarks: numeric("total_marks", { precision: 10, scale: 2 }),
  timeLimitMinutes: integer("time_limit_minutes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const examQuestionsTable = pgTable("exam_questions", {
  id: serial("id").primaryKey(),
  examId: integer("exam_id").notNull().references(() => examsTable.id, { onDelete: "cascade" }),
  parentId: integer("parent_id"),
  questionText: text("question_text"),
  topic: text("topic"),
  maxMarks: numeric("max_marks", { precision: 10, scale: 2 }).notNull().default("0"),
  questionOrder: integer("question_order").notNull().default(0),
  questionType: text("question_type").notNull().default("written"),
  options: jsonb("options").$type<string[]>(),
  correctOption: integer("correct_option"),
});

export const studentMarksTable = pgTable("student_marks", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  examId: integer("exam_id").notNull().references(() => examsTable.id, { onDelete: "cascade" }),
  questionId: integer("question_id").notNull().references(() => examQuestionsTable.id, { onDelete: "cascade" }),
  marksScored: numeric("marks_scored", { precision: 10, scale: 2 }),
  mistakes: text("mistakes"),
  markedAt: timestamp("marked_at", { withTimezone: true }).notNull().defaultNow(),
  // Human-grading authority: AI may suggest but never sets the official grade.
  // pending  → entered (by AI or teacher draft) — not yet officially reviewed
  // graded   → teacher has reviewed and confirmed the mark
  // approved → officially released; students may view this grade
  gradingStatus: text("grading_status").notNull().default("pending"),
  gradedAt: timestamp("graded_at", { withTimezone: true }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvedBy: integer("approved_by").references(() => accountsTable.id, { onDelete: "set null" }),
  aiSuggestedMarks: numeric("ai_suggested_marks", { precision: 10, scale: 2 }),
  aiConfidence: numeric("ai_confidence", { precision: 5, scale: 4 }),
});

export type Exam = typeof examsTable.$inferSelect;
export type ExamQuestion = typeof examQuestionsTable.$inferSelect;
export type StudentMark = typeof studentMarksTable.$inferSelect;
