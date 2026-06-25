import { pgTable, text, serial, timestamp, numeric, integer } from "drizzle-orm/pg-core";

export const apertiCoursesTable = pgTable("aperti_courses", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default("programming"),
  priceEgp: numeric("price_egp", { precision: 10, scale: 2 }),
  syllabusJson: text("syllabus_json"),
  certificateAvailable: text("certificate_available").notNull().default("false"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  deletedBy: integer("deleted_by"),
});

export type ApertiCourse = typeof apertiCoursesTable.$inferSelect;
