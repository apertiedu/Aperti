import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { accountsTable } from "./accounts";

export const contentcraftPagesTable = pgTable("contentcraft_pages", {
  id: serial("id").primaryKey(),
  teacherAccountId: integer("teacher_account_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("Untitled Page"),
  description: text("description"),
  board: text("board"),
  subject: text("subject"),
  topic: text("topic"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contentcraftBlocksTable = pgTable("contentcraft_blocks", {
  id: serial("id").primaryKey(),
  pageId: integer("page_id").notNull().references(() => contentcraftPagesTable.id, { onDelete: "cascade" }),
  blockType: text("block_type").notNull().default("text"),
  content: jsonb("content").notNull().default({}),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contentcraftBlockVersionsTable = pgTable("contentcraft_block_versions", {
  id: serial("id").primaryKey(),
  blockId: integer("block_id").notNull().references(() => contentcraftBlocksTable.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(1),
  content: jsonb("content").notNull().default({}),
  authorId: integer("author_id").references(() => accountsTable.id),
  authorName: text("author_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ContentcraftPage = typeof contentcraftPagesTable.$inferSelect;
export type ContentcraftBlock = typeof contentcraftBlocksTable.$inferSelect;
export type ContentcraftBlockVersion = typeof contentcraftBlockVersionsTable.$inferSelect;
