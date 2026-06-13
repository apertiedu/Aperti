import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const enrollmentTimelineTable = pgTable("enrollment_timeline", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: integer("entity_id"),
  entityName: text("entity_name"),
  previousValue: text("previous_value"),
  newValue: text("new_value"),
  performedBy: integer("performed_by").notNull(),
  performedByName: text("performed_by_name"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EnrollmentTimeline = typeof enrollmentTimelineTable.$inferSelect;
