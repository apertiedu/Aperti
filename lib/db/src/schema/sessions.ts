import { pgTable, text, serial, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { accountsTable } from "./accounts";
import { subjectsTable } from "./subjects";

export const lessonsTable = pgTable("lessons", {
  id: serial("id").primaryKey(),
  lessonNumber: integer("lesson_number").notNull(),
  dayOfWeek: text("day_of_week").notNull(),
  startTime: text("start_time").notNull(),
  type: text("type").notNull().default("centre"),
  mode: text("mode").notNull().default("online"),
  capacity: integer("capacity"),
  subjectId: integer("subject_id").references(() => subjectsTable.id, { onDelete: "set null" }),
  teacherAccountId: integer("teacher_account_id").references(() => accountsTable.id, { onDelete: "cascade" }),
  onlineLink: text("online_link"),
  recurrenceRule: text("recurrence_rule"),
  studentGroupIds: jsonb("student_group_ids").$type<number[]>(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLessonSchema = createInsertSchema(lessonsTable).omit({ id: true, createdAt: true });
export type InsertLesson = z.infer<typeof insertLessonSchema>;
export type Lesson = typeof lessonsTable.$inferSelect;
