import { pgTable, text, serial, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { accountsTable } from "./accounts";

export const notebooksTable = pgTable("notebooks", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull().default("Untitled Notebook"),
  icon: text("icon").notNull().default("📓"),
  color: text("color").notNull().default("#00796B"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notebookPagesTable = pgTable("notebook_pages", {
  id: serial("id").primaryKey(),
  notebookId: integer("notebook_id").notNull().references(() => notebooksTable.id, { onDelete: "cascade" }),
  accountId: integer("account_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("Untitled Page"),
  strokes: jsonb("strokes").$type<unknown[]>(),
  background: text("background").notNull().default("blank"),
  isFavorite: boolean("is_favorite").notNull().default(false),
  tags: jsonb("tags").$type<string[]>(),
  thumbnailUrl: text("thumbnail_url"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Notebook = typeof notebooksTable.$inferSelect;
export type NotebookPage = typeof notebookPagesTable.$inferSelect;
