import { pgTable, text, serial, integer, timestamp, jsonb, numeric } from "drizzle-orm/pg-core";
import { studentsTable } from "./students";

export const echoMemoryTable = pgTable("echo_memory", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  weakTopics: jsonb("weak_topics").$type<string[]>(),
  strongTopics: jsonb("strong_topics").$type<string[]>(),
  mistakeHistory: jsonb("mistake_history").$type<Record<string, number>>(),
  retentionScores: jsonb("retention_scores").$type<Record<string, number>>(),
  learningPace: text("learning_pace").notNull().default("medium"),
  preferredStyle: text("preferred_style").notNull().default("visual"),
  burnoutRisk: numeric("burnout_risk", { precision: 5, scale: 2 }).notNull().default("0"),
  confidenceScore: numeric("confidence_score", { precision: 5, scale: 2 }).notNull().default("0"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const behaviorPatternsTable = pgTable("behavior_patterns", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  lateNightSessions: integer("late_night_sessions").notNull().default(0),
  inactivityStreaks: integer("inactivity_streaks").notNull().default(0),
  preExamPanic: boolean("pre_exam_panic").notNull().default(false),
  consistencyScore: numeric("consistency_score", { precision: 5, scale: 2 }).notNull().default("0"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EchoMemory = typeof echoMemoryTable.$inferSelect;
export type BehaviorPattern = typeof behaviorPatternsTable.$inferSelect;
