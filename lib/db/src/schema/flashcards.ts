import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { accountsTable } from "./accounts";
import { subjectsTable } from "./subjects";

export const flashcardDecksTable = pgTable("flashcard_decks", {
  id: serial("id").primaryKey(),
  teacherAccountId: integer("teacher_account_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  subjectId: integer("subject_id").references(() => subjectsTable.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const flashcardItemsTable = pgTable("flashcard_items", {
  id: serial("id").primaryKey(),
  deckId: integer("deck_id").notNull().references(() => flashcardDecksTable.id, { onDelete: "cascade" }),
  front: text("front").notNull(),
  back: text("back").notNull(),
  imageUrl: text("image_url"),
  latexContent: text("latex_content"),
  difficulty: text("difficulty").notNull().default("medium"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const flashcardProgressTable = pgTable("flashcard_progress", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull(),
  cardId: integer("card_id").notNull().references(() => flashcardItemsTable.id, { onDelete: "cascade" }),
  repetitions: integer("repetitions").notNull().default(0),
  easeFactor: integer("ease_factor").notNull().default(250),
  interval: integer("interval").notNull().default(0),
  nextReview: timestamp("next_review", { withTimezone: true }).notNull().defaultNow(),
  lastReview: timestamp("last_review", { withTimezone: true }),
  masteryLevel: text("mastery_level").notNull().default("new"),
});

export type FlashcardDeck = typeof flashcardDecksTable.$inferSelect;
export type FlashcardItem = typeof flashcardItemsTable.$inferSelect;
export type FlashcardProgress = typeof flashcardProgressTable.$inferSelect;
