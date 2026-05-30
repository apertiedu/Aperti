import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { accountsTable } from "./accounts";

export const lessonContentTable = pgTable("lesson_content", {
  id: serial("id").primaryKey(),
  teacherAccountId: integer("teacher_account_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  sections: jsonb("sections").$type<Array<{
    type: "text" | "video" | "quiz" | "simulation" | "flashcards";
    title?: string;
    content?: string; // for text and video URL
    quizQuestionIds?: number[]; // references to QueryVault question IDs
    simulationId?: number;
    flashcardDeckId?: number;
  }>>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LessonContent = typeof lessonContentTable.$inferSelect;
