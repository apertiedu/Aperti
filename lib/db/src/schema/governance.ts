import {
  pgTable, text, serial, integer, timestamp, boolean, jsonb,
} from "drizzle-orm/pg-core";
import { accountsTable } from "./accounts";
import { organizationsTable } from "./organizations";
import { subscriptionPlansTable } from "./subscriptions";

export const govRolesTable = pgTable("gov_roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  hierarchyLevel: integer("hierarchy_level").notNull().default(10),
  organizationId: integer("organization_id").references(() => organizationsTable.id, { onDelete: "set null" }),
  isSystem: boolean("is_system").notNull().default(false),
  parentRoleId: integer("parent_role_id"),
  color: text("color").notNull().default("#0D9488"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const govPermissionsTable = pgTable("gov_permissions", {
  id: serial("id").primaryKey(),
  resource: text("resource").notNull(),
  action: text("action").notNull(),
  scope: text("scope").notNull().default("self"),
  description: text("description"),
  conditions: jsonb("conditions").$type<Record<string, any>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const govRolePermissionsTable = pgTable("gov_role_permissions", {
  id: serial("id").primaryKey(),
  roleId: integer("role_id").notNull().references(() => govRolesTable.id, { onDelete: "cascade" }),
  permissionId: integer("permission_id").notNull().references(() => govPermissionsTable.id, { onDelete: "cascade" }),
  scopeOverride: text("scope_override"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const govUserRolesTable = pgTable("gov_user_roles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  roleId: integer("role_id").notNull().references(() => govRolesTable.id, { onDelete: "cascade" }),
  organizationId: integer("organization_id").references(() => organizationsTable.id, { onDelete: "cascade" }),
  courseId: integer("course_id"),
  assignedBy: integer("assigned_by").references(() => accountsTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const govAssistantApprovalsTable = pgTable("gov_assistant_approvals", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  assistantId: integer("assistant_id").references(() => accountsTable.id, { onDelete: "set null" }),
  invitationId: integer("invitation_id"),
  status: text("status").notNull().default("pending"),
  reviewedBy: integer("reviewed_by").references(() => accountsTable.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  notes: text("notes"),
  permissions: jsonb("permissions").$type<string[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const govEnrollmentWorkflowsTable = pgTable("gov_enrollment_workflows", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").notNull(),
  type: text("type").notNull().default("automatic"),
  settings: jsonb("settings").$type<Record<string, any>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const govEnrollmentsTable = pgTable("gov_enrollments", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  courseId: integer("course_id").notNull(),
  courseName: text("course_name"),
  teacherId: integer("teacher_id").references(() => accountsTable.id),
  status: text("status").notNull().default("pending"),
  approvedBy: integer("approved_by").references(() => accountsTable.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const govCourseAccessRulesTable = pgTable("gov_course_access_rules", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").notNull(),
  roleName: text("role_name").notNull(),
  permissionLevel: text("permission_level").notNull().default("view"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const govSubscriptionGovernanceTable = pgTable("gov_subscription_governance", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").references(() => subscriptionPlansTable.id, { onDelete: "cascade" }),
  planName: text("plan_name"),
  featureKey: text("feature_key").notNull(),
  accessLevel: text("access_level").notNull().default("full"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const govFeatureAccessMatrixTable = pgTable("gov_feature_access_matrix", {
  id: serial("id").primaryKey(),
  featureKey: text("feature_key").notNull().unique(),
  featureName: text("feature_name").notNull(),
  requiredRole: text("required_role"),
  requiredPlan: text("required_plan"),
  requiredPermission: text("required_permission"),
  visibilityState: text("visibility_state").notNull().default("released"),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const govAuditEnforcementTable = pgTable("gov_audit_enforcement", {
  id: serial("id").primaryKey(),
  eventType: text("event_type").notNull(),
  userId: integer("user_id").references(() => accountsTable.id, { onDelete: "set null" }),
  targetType: text("target_type"),
  targetId: integer("target_id"),
  changes: jsonb("changes").$type<Record<string, any>>(),
  ipAddress: text("ip_address"),
  severity: text("severity").notNull().default("info"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const govConflictLogsTable = pgTable("gov_conflict_logs", {
  id: serial("id").primaryKey(),
  conflictType: text("conflict_type").notNull(),
  description: text("description").notNull(),
  affectedUserId: integer("affected_user_id"),
  affectedResourceType: text("affected_resource_type"),
  affectedResourceId: integer("affected_resource_id"),
  status: text("status").notNull().default("open"),
  resolution: text("resolution"),
  resolvedBy: integer("resolved_by").references(() => accountsTable.id),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const govCommunicationPermissionsTable = pgTable("gov_communication_permissions", {
  id: serial("id").primaryKey(),
  fromRole: text("from_role").notNull(),
  toRole: text("to_role").notNull(),
  channelType: text("channel_type").notNull().default("direct"),
  allowed: boolean("allowed").notNull().default(true),
  conditions: jsonb("conditions").$type<Record<string, any>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const govAiAccessRulesTable = pgTable("gov_ai_access_rules", {
  id: serial("id").primaryKey(),
  featureKey: text("feature_key").notNull(),
  featureName: text("feature_name").notNull().default(""),
  requiredRole: text("required_role"),
  requiredPlan: text("required_plan"),
  dailyLimit: integer("daily_limit"),
  monthlyLimit: integer("monthly_limit"),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GovRole = typeof govRolesTable.$inferSelect;
export type GovPermission = typeof govPermissionsTable.$inferSelect;
export type GovEnrollment = typeof govEnrollmentsTable.$inferSelect;
export type GovConflictLog = typeof govConflictLogsTable.$inferSelect;
export type FeatureAccessEntry = typeof govFeatureAccessMatrixTable.$inferSelect;
