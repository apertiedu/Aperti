import {
  pgTable, text, serial, integer, timestamp, jsonb, boolean, numeric
} from "drizzle-orm/pg-core";
import { studentsTable } from "./students";
import { accountsTable } from "./accounts";
import { homeworkTable } from "./homework";
import { examsTable } from "./exams";
import { subjectsTable } from "./subjects";

// ── Study Groups ──────────────────────────────────────────────────────────────

export const studyGroupsTable = pgTable("study_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  creatorId: integer("creator_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  subjectId: integer("subject_id").references(() => subjectsTable.id, { onDelete: "set null" }),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const groupMembersTable = pgTable("group_members", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull().references(() => studyGroupsTable.id, { onDelete: "cascade" }),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
});

export const groupChallengesTable = pgTable("group_challenges", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull().references(() => studyGroupsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  type: text("type").notNull().default("quiz"),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Focus Coach ───────────────────────────────────────────────────────────────

export const studentGoalsTable = pgTable("student_goals", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  type: text("type").notNull().default("daily"),
  targetDate: text("target_date"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  xpReward: integer("xp_reward").notNull().default(50),
  source: text("source").notNull().default("manual"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const focusSessionsTable = pgTable("focus_sessions", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  mode: text("mode").notNull().default("pomodoro"),
  durationMinutes: integer("duration_minutes").notNull().default(25),
  xpEarned: integer("xp_earned").notNull().default(0),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Trial Vault ───────────────────────────────────────────────────────────────

export const trialVaultAttemptsTable = pgTable("trial_vault_attempts", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  subjectId: integer("subject_id").references(() => subjectsTable.id, { onDelete: "set null" }),
  config: jsonb("config").$type<Record<string, unknown>>(),
  questions: jsonb("questions").$type<unknown[]>(),
  answers: jsonb("answers").$type<Record<string, unknown>>(),
  score: numeric("score", { precision: 10, scale: 2 }),
  topicBreakdown: jsonb("topic_breakdown").$type<Record<string, unknown>>(),
  timingData: jsonb("timing_data").$type<Record<string, unknown>>(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Exam Vault ────────────────────────────────────────────────────────────────

export const examVaultPackagesTable = pgTable("exam_vault_packages", {
  id: serial("id").primaryKey(),
  examId: integer("exam_id").notNull().references(() => examsTable.id, { onDelete: "cascade" }),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  encryptedData: text("encrypted_data"),
  encryptionKey: text("encryption_key"),
  downloadedAt: timestamp("downloaded_at", { withTimezone: true }),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  submissionData: text("submission_data"),
  gradedScore: numeric("graded_score", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── InkSpace ──────────────────────────────────────────────────────────────────

export const inkspaceNotebooksTable = pgTable("inkspace_notebooks", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("Untitled Notebook"),
  color: text("color").notNull().default("#00796B"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const inkspacePagesTable = pgTable("inkspace_pages", {
  id: serial("id").primaryKey(),
  notebookId: integer("notebook_id").notNull().references(() => inkspaceNotebooksTable.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("Untitled Page"),
  sortOrder: integer("sort_order").notNull().default(0),
  content: jsonb("content").$type<unknown>(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const inkspaceBlocksTable = pgTable("inkspace_blocks", {
  id: serial("id").primaryKey(),
  pageId: integer("page_id").notNull().references(() => inkspacePagesTable.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("text"),
  data: jsonb("data").$type<unknown>(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Student Feed ──────────────────────────────────────────────────────────────

export const studentFeedItemsTable = pgTable("student_feed_items", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  priority: numeric("priority", { precision: 10, scale: 4 }).notNull().default("0"),
  actionUrl: text("action_url"),
  icon: text("icon"),
  isRead: boolean("is_read").notNull().default(false),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── SnapGrade ─────────────────────────────────────────────────────────────────

export const snapgradeSubmissionsTable = pgTable("snapgrade_submissions", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  homeworkId: integer("homework_id").references(() => homeworkTable.id, { onDelete: "set null" }),
  imageUrl: text("image_url"),
  ocrText: text("ocr_text"),
  aiAnalysis: jsonb("ai_analysis").$type<Record<string, unknown>>(),
  grade: numeric("grade", { precision: 10, scale: 2 }),
  feedback: text("feedback"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Peer Reviews ──────────────────────────────────────────────────────────────

export const peerReviewsTable = pgTable("peer_reviews", {
  id: serial("id").primaryKey(),
  reviewerId: integer("reviewer_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  submissionId: integer("submission_id").notNull().references(() => snapgradeSubmissionsTable.id, { onDelete: "cascade" }),
  rating: integer("rating"),
  comment: text("comment"),
  rubric: jsonb("rubric").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Student Messages (threaded) ───────────────────────────────────────────────

export const messageThreadsTable = pgTable("message_threads", {
  id: serial("id").primaryKey(),
  participants: jsonb("participants").$type<number[]>().notNull(),
  subject: text("subject"),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const studentMessagesTable = pgTable("student_messages", {
  id: serial("id").primaryKey(),
  threadId: integer("thread_id").notNull().references(() => messageThreadsTable.id, { onDelete: "cascade" }),
  senderId: integer("sender_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  readBy: jsonb("read_by").$type<number[]>().notNull().default([]),
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Types ─────────────────────────────────────────────────────────────────────

export type StudyGroup = typeof studyGroupsTable.$inferSelect;
export type GroupMember = typeof groupMembersTable.$inferSelect;
export type GroupChallenge = typeof groupChallengesTable.$inferSelect;
export type StudentGoal = typeof studentGoalsTable.$inferSelect;
export type FocusSession = typeof focusSessionsTable.$inferSelect;
export type TrialVaultAttempt = typeof trialVaultAttemptsTable.$inferSelect;
export type ExamVaultPackage = typeof examVaultPackagesTable.$inferSelect;
export type InkspaceNotebook = typeof inkspaceNotebooksTable.$inferSelect;
export type InkspacePage = typeof inkspacePagesTable.$inferSelect;
export type InkspaceBlock = typeof inkspaceBlocksTable.$inferSelect;
export type StudentFeedItem = typeof studentFeedItemsTable.$inferSelect;
export type SnapgradeSubmission = typeof snapgradeSubmissionsTable.$inferSelect;
export type PeerReview = typeof peerReviewsTable.$inferSelect;
export type MessageThread = typeof messageThreadsTable.$inferSelect;
export type StudentMessage = typeof studentMessagesTable.$inferSelect;
