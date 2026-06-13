import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const attendanceAuditTable = pgTable("attendance_audit", {
  id: serial("id").primaryKey(),
  attendanceId: integer("attendance_id"),
  studentId: integer("student_id").notNull(),
  lessonId: integer("lesson_id"),
  action: text("action").notNull(),
  oldStatus: text("old_status"),
  newStatus: text("new_status"),
  performedBy: integer("performed_by").notNull(),
  performedByName: text("performed_by_name"),
  performedByRole: text("performed_by_role"),
  deviceInfo: text("device_info"),
  ipAddress: text("ip_address"),
  scanMethod: text("scan_method"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AttendanceAudit = typeof attendanceAuditTable.$inferSelect;
