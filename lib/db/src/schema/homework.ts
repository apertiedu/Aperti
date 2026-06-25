import { pgTable, text, serial, integer, numeric, boolean, timestamp, date, unique } from "drizzle-orm/pg-core";
import { accountsTable } from "./accounts";
import { studentsTable } from "./students";
import { subjectsTable } from "./subjects";

export const homeworkTable = pgTable("homework", {
  id: serial("id").primaryKey(),
  teacherAccountId: integer("teacher_account_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  subjectId: integer("subject_id").references(() => subjectsTable.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  instructions: text("instructions"),
  dueDate: date("due_date"),
  totalMarks: numeric("total_marks", { precision: 10, scale: 2 }),
  classFilter: text("class_filter"),
  allowLate: boolean("allow_late").notNull().default(false),
  isPublished: boolean("is_published").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const homeworkSubmissionsTable = pgTable("homework_submissions", {
  id: serial("id").primaryKey(),
  homeworkId: integer("homework_id").notNull().references(() => homeworkTable.id, { onDelete: "cascade" }),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  content: text("content"),
  status: text("status").notNull().default("draft"),
  marksAwarded: numeric("marks_awarded", { precision: 10, scale: 2 }),
  teacherFeedback: text("teacher_feedback"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  gradedAt: timestamp("graded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // Human-grading authority fields
  // pending  → not yet teacher-reviewed
  // graded   → teacher has set marksAwarded
  // approved → officially released; students may view this grade
  gradingStatus: text("grading_status").notNull().default("pending"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvedBy: integer("approved_by").references(() => accountsTable.id, { onDelete: "set null" }),
}, (t) => [unique().on(t.homeworkId, t.studentId)]);

export type Homework = typeof homeworkTable.$inferSelect;
export type HomeworkSubmission = typeof homeworkSubmissionsTable.$inferSelect;
