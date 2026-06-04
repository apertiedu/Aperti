import { pgTable, text, serial, integer, timestamp, boolean, numeric, jsonb } from "drizzle-orm/pg-core";
import { accountsTable } from "./accounts";

export const aiInteractionsTable = pgTable("ai_interactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => accountsTable.id, { onDelete: "set null" }),
  module: text("module").notNull(),
  action: text("action").notNull(),
  inputSummary: text("input_summary"),
  outputSummary: text("output_summary"),
  confidence: numeric("confidence", { precision: 4, scale: 3 }),
  tokensUsed: integer("tokens_used"),
  accepted: boolean("accepted"),
  sources: jsonb("sources").$type<string[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const misconceptionsTable = pgTable("misconceptions", {
  id: serial("id").primaryKey(),
  topic: text("topic").notNull(),
  subject: text("subject").notNull(),
  pattern: text("pattern").notNull(),
  description: text("description").notNull(),
  examples: jsonb("examples").$type<string[]>().default([]),
  severity: text("severity").notNull().default("medium"),
  createdBy: integer("created_by").references(() => accountsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AiInteraction = typeof aiInteractionsTable.$inferSelect;
export type Misconception = typeof misconceptionsTable.$inferSelect;
