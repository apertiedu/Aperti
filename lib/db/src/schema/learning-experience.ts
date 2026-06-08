import {
  pgTable, text, serial, integer, timestamp, jsonb, boolean, numeric
} from "drizzle-orm/pg-core";
import { studentsTable } from "./students";
import { accountsTable } from "./accounts";
import { subjectsTable } from "./subjects";

// ── Mastery Records ───────────────────────────────────────────────────────────

export const masteryRecordsTable = pgTable("mastery_records", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  courseId: integer("course_id"),
  topicId: integer("topic_id"),
  topicName: text("topic_name").notNull().default(""),
  masteryState: text("mastery_state").notNull().default("not_started"),
  confidenceScore: integer("confidence_score").notNull().default(0),
  lastInteractedAt: timestamp("last_interacted_at", { withTimezone: true }).defaultNow(),
  evidence: jsonb("evidence").$type<number[]>().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Learning Paths ────────────────────────────────────────────────────────────

export const learningPathsTable = pgTable("learning_paths", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  courseId: integer("course_id"),
  pathType: text("path_type").notNull().default("adaptive"),
  nodes: jsonb("nodes").$type<Array<{
    id: string; title: string; type: string; status: string;
    order: number; prerequisites: string[]; estimatedMinutes: number;
    resourceUrl?: string;
  }>>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Micro Assessments ─────────────────────────────────────────────────────────

export const microAssessmentsTable = pgTable("micro_assessments", {
  id: serial("id").primaryKey(),
  lessonId: integer("lesson_id"),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("knowledge_check"),
  topic: text("topic"),
  questions: jsonb("questions").$type<Array<{
    id: string; question: string; options: string[]; correct: number;
    explanation: string; commonMistakes?: string;
  }>>().notNull().default([]),
  answers: jsonb("answers").$type<Record<string, number>>(),
  score: numeric("score", { precision: 10, scale: 2 }),
  feedback: text("feedback"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Learning Goals ────────────────────────────────────────────────────────────

export const learningGoalsTable = pgTable("learning_goals", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("custom"),
  title: text("title").notNull(),
  target: text("target"),
  deadline: text("deadline"),
  progress: integer("progress").notNull().default(0),
  status: text("status").notNull().default("active"),
  icon: text("icon").default("🎯"),
  xpReward: integer("xp_reward").notNull().default(100),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Challenges ────────────────────────────────────────────────────────────────

export const challengesTable = pgTable("challenges", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull().default("weekly"),
  rules: jsonb("rules").$type<Record<string, unknown>>().notNull().default({}),
  xpReward: integer("xp_reward").notNull().default(200),
  startDate: text("start_date"),
  endDate: text("end_date"),
  createdBy: integer("created_by").references(() => accountsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const challengeParticipationsTable = pgTable("challenge_participations", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  challengeId: integer("challenge_id").notNull().references(() => challengesTable.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("joined"),
  score: numeric("score", { precision: 10, scale: 2 }).default("0"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Learning Analytics Snapshots ──────────────────────────────────────────────

export const learningAnalyticsSnapshotsTable = pgTable("learning_analytics_snapshots", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  metrics: jsonb("metrics").$type<{
    masteryPct?: number; engagementScore?: number; predictedGrade?: number;
    revisionHours?: number; completedGoals?: number; streakDays?: number;
    weakTopicsCount?: number; strongTopicsCount?: number;
  }>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Offline Content ───────────────────────────────────────────────────────────

export const offlineContentTable = pgTable("offline_content", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  contentType: text("content_type").notNull().default("lesson"),
  contentData: jsonb("content_data").$type<Record<string, unknown>>().notNull().default({}),
  syncedAt: timestamp("synced_at", { withTimezone: true }),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Recommendation Feedback ───────────────────────────────────────────────────

export const recommendationFeedbackTable = pgTable("recommendation_feedback", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  recommendationType: text("recommendation_type").notNull(),
  resourceId: text("resource_id"),
  rating: text("rating").notNull().default("helpful"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Types ─────────────────────────────────────────────────────────────────────

export type MasteryRecord = typeof masteryRecordsTable.$inferSelect;
export type LearningPath = typeof learningPathsTable.$inferSelect;
export type MicroAssessment = typeof microAssessmentsTable.$inferSelect;
export type LearningGoal = typeof learningGoalsTable.$inferSelect;
export type Challenge = typeof challengesTable.$inferSelect;
export type ChallengeParticipation = typeof challengeParticipationsTable.$inferSelect;
export type LearningAnalyticsSnapshot = typeof learningAnalyticsSnapshotsTable.$inferSelect;
export type OfflineContent = typeof offlineContentTable.$inferSelect;
export type RecommendationFeedback = typeof recommendationFeedbackTable.$inferSelect;
