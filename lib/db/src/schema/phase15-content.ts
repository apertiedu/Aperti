import { pgTable, text, serial, integer, boolean, timestamp, jsonb, numeric } from "drizzle-orm/pg-core";
import { accountsTable } from "./accounts";
import { lessonContentTable } from "./lesson-content";

export const contentBlocksTable = pgTable("content_blocks", {
  id: serial("id").primaryKey(),
  pageId: integer("page_id").notNull().references(() => lessonContentTable.id, { onDelete: "cascade" }),
  blockType: text("block_type").notNull().default("text"),
  content: jsonb("content").notNull().default({}),
  ord: integer("ord").notNull().default(0),
  settings: jsonb("settings").notNull().default({}),
  createdBy: integer("created_by").references(() => accountsTable.id, { onDelete: "set null" }),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const curriculumMappingsTable = pgTable("curriculum_mappings", {
  id: serial("id").primaryKey(),
  contentType: text("content_type").notNull(),
  contentId: integer("content_id").notNull(),
  board: text("board"),
  subject: text("subject"),
  paper: text("paper"),
  topic: text("topic"),
  subtopic: text("subtopic"),
  learningObjective: text("learning_objective"),
  skill: text("skill"),
  commandWord: text("command_word"),
  difficulty: text("difficulty"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const courseBuilderTemplatesTable = pgTable("course_builder_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull().default("teacher"),
  structure: jsonb("structure").notNull().default({}),
  createdBy: integer("created_by").references(() => accountsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const questionImportLogsTable = pgTable("question_import_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  sourceType: text("source_type").notNull().default("pdf"),
  sourceUrl: text("source_url"),
  questionsImported: integer("questions_imported").notNull().default(0),
  status: text("status").notNull().default("pending"),
  errors: jsonb("errors").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const questionExtractionJobsTable = pgTable("question_extraction_jobs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  fileUrl: text("file_url"),
  status: text("status").notNull().default("pending"),
  extractedData: jsonb("extracted_data").notNull().default({}),
  reviewedBy: integer("reviewed_by").references(() => accountsTable.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const handwrittenSubmissionsTable = pgTable("handwritten_submissions", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id"),
  imageUrl: text("image_url"),
  processedText: text("processed_text"),
  diagramData: jsonb("diagram_data").notNull().default({}),
  equationData: jsonb("equation_data").notNull().default({}),
  stepAnalysis: jsonb("step_analysis").notNull().default({}),
  confidenceScore: numeric("confidence_score", { precision: 5, scale: 2 }),
  studentId: integer("student_id").references(() => accountsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const labConfigurationsTable = pgTable("lab_configurations", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  labType: text("lab_type").notNull(),
  config: jsonb("config").notNull().default({}),
  isPublished: boolean("is_published").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const practiceSessionsTable = pgTable("practice_sessions", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  subject: text("subject"),
  topics: jsonb("topics").notNull().default([]),
  questionsAnswered: integer("questions_answered").notNull().default(0),
  correct: integer("correct").notNull().default(0),
  timeSpent: integer("time_spent").notNull().default(0),
  answers: jsonb("answers").notNull().default([]),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const academicAnalyticsTable = pgTable("academic_analytics", {
  id: serial("id").primaryKey(),
  contentType: text("content_type").notNull(),
  contentId: integer("content_id").notNull(),
  metrics: jsonb("metrics").notNull().default({}),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contentCommentsTable = pgTable("content_comments", {
  id: serial("id").primaryKey(),
  blockId: integer("block_id").notNull(),
  userId: integer("user_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  comment: text("comment").notNull(),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const blockVersionHistoryTable = pgTable("block_version_history", {
  id: serial("id").primaryKey(),
  blockId: integer("block_id").notNull(),
  version: integer("version").notNull(),
  content: jsonb("content").notNull().default({}),
  settings: jsonb("settings").notNull().default({}),
  changedBy: integer("changed_by").references(() => accountsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const geometrixSessionsTable = pgTable("geometrix_sessions", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  module: text("module").notNull(),
  tool: text("tool"),
  data: jsonb("data").notNull().default({}),
  score: numeric("score", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ContentBlock = typeof contentBlocksTable.$inferSelect;
export type CurriculumMapping = typeof curriculumMappingsTable.$inferSelect;
export type QuestionExtractionJob = typeof questionExtractionJobsTable.$inferSelect;
export type HandwrittenSubmission = typeof handwrittenSubmissionsTable.$inferSelect;
export type LabConfiguration = typeof labConfigurationsTable.$inferSelect;
export type PracticeSession = typeof practiceSessionsTable.$inferSelect;
export type AcademicAnalytics = typeof academicAnalyticsTable.$inferSelect;
