import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { subscriptionPlansTable } from "./subscriptions";

export const organizationsTable = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  type: text("type").notNull().default("tutoring_center"),
  logoUrl: text("logo_url"),
  branding: jsonb("branding").$type<Record<string, any>>(),
  contactInfo: jsonb("contact_info").$type<Record<string, any>>(),
  address: text("address"),
  country: text("country").notNull().default("EG"),
  language: text("language").notNull().default("en"),
  timezone: text("timezone").notNull().default("Africa/Cairo"),
  subscriptionPlanId: integer("subscription_plan_id").references(() => subscriptionPlansTable.id),
  status: text("status").notNull().default("active"),
  plan: text("plan").notNull().default("basic"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Organization = typeof organizationsTable.$inferSelect;
