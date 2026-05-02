import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sessionsTable } from "./sessions";
import { accountsTable } from "./accounts";

export const studentsTable = pgTable("students", {
  id: serial("id").primaryKey(),
  studentCode: text("student_code").notNull().unique(),
  studentName: text("student_name").notNull(),
  phone: text("phone"),
  parentPhone: text("parent_phone"),
  notes: text("notes"),
  status: text("status").notNull().default("active"),
  teacherAccountId: integer("teacher_account_id").references(() => accountsTable.id, { onDelete: "cascade" }),
  lesson1SessionId: integer("lesson1_session_id").references(() => sessionsTable.id, { onDelete: "set null" }),
  lesson2SessionId: integer("lesson2_session_id").references(() => sessionsTable.id, { onDelete: "set null" }),
  lesson3SessionId: integer("lesson3_session_id").references(() => sessionsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertStudentSchema = createInsertSchema(studentsTable).omit({ id: true, createdAt: true });
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof studentsTable.$inferSelect;
