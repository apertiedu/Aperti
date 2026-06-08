import {
  pgTable, text, serial, integer, timestamp, boolean, jsonb, numeric,
} from "drizzle-orm/pg-core";
import { accountsTable } from "./accounts";
import { organizationsTable } from "./organizations";
import { subscriptionPlansTable, subscriptionsTable } from "./subscriptions";

/* ─── Extended Organizations ─────────────────────────────────────────────── */
export const organizationSettingsTable = pgTable("organization_settings", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  workingHours: jsonb("working_hours").$type<Record<string, any>>(),
  academicYearStart: text("academic_year_start"),
  academicYearEnd: text("academic_year_end"),
  defaultCurrency: text("default_currency").notNull().default("EGP"),
  paymentMethods: jsonb("payment_methods").$type<string[]>(),
  featureAccess: jsonb("feature_access").$type<Record<string, boolean>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ─── Payment Transactions ───────────────────────────────────────────────── */
export const paymentTransactionsTable = pgTable("payment_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  subscriptionId: integer("subscription_id").references(() => subscriptionsTable.id),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("EGP"),
  method: text("method").notNull().default("instapay"),
  referenceNumber: text("reference_number"),
  screenshotUrl: text("screenshot_url"),
  status: text("status").notNull().default("pending"),
  verifiedBy: integer("verified_by").references(() => accountsTable.id),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ─── Revenue Records ────────────────────────────────────────────────────── */
export const revenueRecordsTable = pgTable("revenue_records", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  source: text("source").notNull().default("subscription"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("EGP"),
  teacherId: integer("teacher_id").references(() => accountsTable.id),
  organizationId: integer("organization_id").references(() => organizationsTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ─── Platform Analytics ─────────────────────────────────────────────────── */
export const platformAnalyticsTable = pgTable("platform_analytics", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  metricType: text("metric_type").notNull(),
  value: jsonb("value").$type<Record<string, any>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ─── System Health Logs ─────────────────────────────────────────────────── */
export const systemHealthLogsTable = pgTable("system_health_logs", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  service: text("service").notNull(),
  metric: text("metric").notNull(),
  value: text("value").notNull(),
  status: text("status").notNull().default("ok"),
});

/* ─── Feature Flags ──────────────────────────────────────────────────────── */
export const featureFlagsTable = pgTable("feature_flags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  enabled: boolean("enabled").notNull().default(false),
  targetRoles: jsonb("target_roles").$type<string[]>(),
  targetPlans: jsonb("target_plans").$type<string[]>(),
  targetOrgs: jsonb("target_orgs").$type<number[]>(),
  status: text("status").notNull().default("enabled"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ─── Knowledge Base Articles ────────────────────────────────────────────── */
export const knowledgeBaseArticlesTable = pgTable("knowledge_base_articles", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull().default("general"),
  language: text("language").notNull().default("en"),
  createdBy: integer("created_by").references(() => accountsTable.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ─── Compliance Requests ────────────────────────────────────────────────── */
export const complianceRequestsTable = pgTable("compliance_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => accountsTable.id),
  type: text("type").notNull().default("data_export"),
  status: text("status").notNull().default("pending"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  notes: text("notes"),
});

/* ─── Backup Logs ────────────────────────────────────────────────────────── */
export const backupLogsTable = pgTable("backup_logs", {
  id: serial("id").primaryKey(),
  type: text("type").notNull().default("auto"),
  status: text("status").notNull().default("pending"),
  fileUrl: text("file_url"),
  sizeBytes: integer("size_bytes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ─── Assistant Invitations ──────────────────────────────────────────────── */
export const assistantInvitationsTable = pgTable("assistant_invitations", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  organizationId: integer("organization_id").references(() => organizationsTable.id),
  invitedBy: integer("invited_by").notNull().references(() => accountsTable.id),
  status: text("status").notNull().default("pending"),
  permissions: jsonb("permissions").$type<string[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ─── Platform Settings ──────────────────────────────────────────────────── */
export const platformSettingsTable = pgTable("platform_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: jsonb("value"),
  updatedBy: integer("updated_by").references(() => accountsTable.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ─── Content Moderation Queue ───────────────────────────────────────────── */
export const contentModerationTable = pgTable("content_moderation", {
  id: serial("id").primaryKey(),
  contentType: text("content_type").notNull(),
  contentId: integer("content_id").notNull(),
  reportedBy: integer("reported_by").references(() => accountsTable.id),
  reason: text("reason"),
  status: text("status").notNull().default("pending"),
  reviewedBy: integer("reviewed_by").references(() => accountsTable.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ─── Types ──────────────────────────────────────────────────────────────── */
export type OrganizationSettings = typeof organizationSettingsTable.$inferSelect;
export type PaymentTransaction = typeof paymentTransactionsTable.$inferSelect;
export type RevenueRecord = typeof revenueRecordsTable.$inferSelect;
export type PlatformAnalytics = typeof platformAnalyticsTable.$inferSelect;
export type SystemHealthLog = typeof systemHealthLogsTable.$inferSelect;
export type FeatureFlag = typeof featureFlagsTable.$inferSelect;
export type KnowledgeBaseArticle = typeof knowledgeBaseArticlesTable.$inferSelect;
export type ComplianceRequest = typeof complianceRequestsTable.$inferSelect;
export type BackupLog = typeof backupLogsTable.$inferSelect;
export type AssistantInvitation = typeof assistantInvitationsTable.$inferSelect;
export type PlatformSetting = typeof platformSettingsTable.$inferSelect;
export type ContentModeration = typeof contentModerationTable.$inferSelect;
