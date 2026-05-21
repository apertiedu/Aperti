import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { accountsTable } from "./accounts";

export const simulationsTable = pgTable("simulations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  config: jsonb("config"),
  createdBy: integer("created_by").references(() => accountsTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const simulationResultsTable = pgTable("simulation_results", {
  id: serial("id").primaryKey(),
  simulationId: integer("simulation_id").notNull().references(() => simulationsTable.id, { onDelete: "cascade" }),
  studentId: integer("student_id").notNull(),
  actions: jsonb("actions"),
  conclusion: text("conclusion"),
  grade: text("grade"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Simulation = typeof simulationsTable.$inferSelect;
export type SimulationResult = typeof simulationResultsTable.$inferSelect;
