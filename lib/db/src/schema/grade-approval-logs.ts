import { pgTable, serial, integer, text, timestamp, numeric } from "drizzle-orm/pg-core";
import { accountsTable } from "./accounts";
import { studentsTable } from "./students";

/**
 * Immutable audit trail for every grading action.
 * Records who touched a grade, when, what it was before, and what it became.
 * Rows are append-only — never update or delete.
 */
export const gradeApprovalLogsTable = pgTable("grade_approval_logs", {
  id: serial("id").primaryKey(),

  // What was graded
  entityType: text("entity_type").notNull(), // 'student_mark' | 'snapgrade_submission' | 'homework_submission'
  entityId: integer("entity_id").notNull(),

  studentId: integer("student_id").references(() => studentsTable.id, { onDelete: "set null" }),

  // The action taken
  // 'ai_suggested'   → AI produced a grade suggestion (never official)
  // 'graded'         → Teacher/assistant set the official mark
  // 'approved'       → Teacher explicitly released grade to student
  // 'rejected'       → Teacher rejected an AI suggestion and re-graded
  // 'modified'       → Approved grade was corrected (rare — requires reason)
  action: text("action").notNull(),

  // Performed by
  actorId: integer("actor_id").references(() => accountsTable.id, { onDelete: "set null" }),
  actorRole: text("actor_role"), // 'teacher' | 'assistant' | 'system'

  // Grade values at the moment of action
  previousStatus: text("previous_status"),
  newStatus: text("new_status"),
  previousGrade: numeric("previous_grade", { precision: 10, scale: 2 }),
  newGrade: numeric("new_grade", { precision: 10, scale: 2 }),

  // Optional context
  reason: text("reason"),
  ipAddress: text("ip_address"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GradeApprovalLog = typeof gradeApprovalLogsTable.$inferSelect;
