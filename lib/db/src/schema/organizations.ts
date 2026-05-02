import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const organizationsTable = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  status: text("status").notNull().default("active"),
  plan: text("plan").notNull().default("basic"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Organization = typeof organizationsTable.$inferSelect;
