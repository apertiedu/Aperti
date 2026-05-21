import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";

export const pastPapersTable = pgTable("past_papers", {
  id: serial("id").primaryKey(),
  board: text("board").notNull(),
  subject: text("subject").notNull(),
  year: integer("year").notNull(),
  variant: text("variant"),
  fileUrl: text("file_url").notNull(),
  isPublic: text("is_public").notNull().default("true"),
  uploadedBy: integer("uploaded_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PastPaper = typeof pastPapersTable.$inferSelect;
