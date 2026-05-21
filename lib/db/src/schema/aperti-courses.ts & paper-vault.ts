import { pgTable, text, serial, integer, timestamp, numeric } from "drizzle-orm/pg-core";

export const apertiCoursesTable = pgTable("aperti_courses", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default("programming"),
  priceEgp: numeric("price_egp", { precision: 10, scale: 2 }),
  syllabusJson: text("syllabus_json"),
  certificateAvailable: text("certificate_available").notNull().default("false"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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

export type ApertiCourse = typeof apertiCoursesTable.$inferSelect;
export type PastPaper = typeof pastPapersTable.$inferSelect;
