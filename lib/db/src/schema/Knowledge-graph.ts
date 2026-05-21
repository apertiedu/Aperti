import { pgTable, text, serial, integer, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const knowledgeNodesTable = pgTable("knowledge_nodes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("topic"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const knowledgeEdgesTable = pgTable("knowledge_edges", {
  id: serial("id").primaryKey(),
  fromNodeId: integer("from_node_id").notNull().references(() => knowledgeNodesTable.id, { onDelete: "cascade" }),
  toNodeId: integer("to_node_id").notNull().references(() => knowledgeNodesTable.id, { onDelete: "cascade" }),
  relationType: text("relation_type").notNull().default("prerequisite"),
  weight: integer("weight").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("edge_unique").on(t.fromNodeId, t.toNodeId)]);

export type KnowledgeNode = typeof knowledgeNodesTable.$inferSelect;
export type KnowledgeEdge = typeof knowledgeEdgesTable.$inferSelect;
