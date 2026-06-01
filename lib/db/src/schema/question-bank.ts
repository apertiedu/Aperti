import { pgTable, text, serial, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { accountsTable } from "./accounts";
import { subjectsTable } from "./subjects";

export const questionBankTable = pgTable("question_bank", {
  id: serial("id").primaryKey(),
  teacherAccountId: integer("teacher_account_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  subjectId: integer("subject_id").references(() => subjectsTable.id, { onDelete: "set null" }),
  questionText: text("question_text").notNull(),
  topic: text("topic"),
  subtopic: text("subtopic"),
  difficulty: text("difficulty").notNull().default("medium"),
  maxMarks: numeric("max_marks", { precision: 10, scale: 2 }).notNull().default("1"),
  modelAnswer: text("model_answer"),
  commonMistakes: text("common_mistakes"),
  tags: text("tags"),
  imageUrl: text("image_url"),
  timesUsed: integer("times_used").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type QuestionBankItem = typeof questionBankTable.$inferSelect;
