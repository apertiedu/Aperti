import { pgTable, serial, text, integer, boolean, timestamp, jsonb, numeric } from "drizzle-orm/pg-core";
import { accountsTable } from "./accounts";

export const bugsTable = pgTable("bugs", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  stepsToReproduce: text("steps_to_reproduce"),
  severity: text("severity").notNull().default("medium"), // critical, high, medium, low
  status: text("status").notNull().default("reported"), // reported, triaged, in_progress, testing, resolved, closed
  reportedBy: integer("reported_by").references(() => accountsTable.id, { onDelete: "set null" }),
  assignedTo: integer("assigned_to").references(() => accountsTable.id, { onDelete: "set null" }),
  module: text("module"), // assessment, liveclass, auth, billing, etc.
  linkedFeatureId: integer("linked_feature_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const testCasesTable = pgTable("test_cases", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default("functional"), // functional, role, permission, ui, api, performance, security, accessibility
  status: text("status").notNull().default("pending"), // pending, passed, failed, skipped
  testedBy: integer("tested_by").references(() => accountsTable.id, { onDelete: "set null" }),
  testedAt: timestamp("tested_at", { withTimezone: true }),
  linkedModule: text("linked_module"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const testRunsTable = pgTable("test_runs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  executedAt: timestamp("executed_at", { withTimezone: true }).notNull().defaultNow(),
  totalTests: integer("total_tests").notNull().default(0),
  passed: integer("passed").notNull().default(0),
  failed: integer("failed").notNull().default(0),
  skipped: integer("skipped").notNull().default(0),
  coveragePercentage: numeric("coverage_percentage", { precision: 5, scale: 2 }).default("0"),
  triggeredBy: text("triggered_by").notNull().default("manual"), // manual, automated
  details: jsonb("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const qualityScoresTable = pgTable("quality_scores", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(), // YYYY-MM-DD
  category: text("category").notNull(), // functionality, performance, security, accessibility, reliability, ux
  score: numeric("score", { precision: 5, scale: 2 }).notNull().default("0"),
  details: jsonb("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const launchChecklistTable = pgTable("launch_checklist", {
  id: serial("id").primaryKey(),
  item: text("item").notNull(),
  category: text("category").notNull().default("general"), // auth, payments, performance, security, content, legal
  isCompleted: boolean("is_completed").notNull().default(false),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  verifiedBy: integer("verified_by").references(() => accountsTable.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
