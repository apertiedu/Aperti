import { pgTable, serial, integer, text, timestamp, date } from "drizzle-orm/pg-core";
import { studentsTable } from "./students";
import { sessionsTable } from "./sessions";

export const attendanceTable = pgTable("attendance", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  sessionId: integer("session_id").notNull().references(() => sessionsTable.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  status: text("status").notNull().default("Present"),
  markedAt: timestamp("marked_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Attendance = typeof attendanceTable.$inferSelect;
