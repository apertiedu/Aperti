import { pgTable, text, serial, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id"),
  teacherId: integer("teacher_id"),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  resourceId: integer("resource_id"),
  details: jsonb("details"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AuditLog = typeof auditLogsTable.$inferSelect;
