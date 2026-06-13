import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { lessonsTable } from "./sessions";

export const sessionSlotsTable = pgTable("session_slots", {
  id: serial("id").primaryKey(),
  lessonId: integer("lesson_id").notNull().references(() => lessonsTable.id, { onDelete: "cascade" }),
  slotLabel: text("slot_label").notNull(),
  dayOfWeek: text("day_of_week").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time"),
  roomOrLink: text("room_or_link"),
  mode: text("mode").notNull().default("in-person"),
  capacity: integer("capacity"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSessionSlotSchema = createInsertSchema(sessionSlotsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSessionSlot = z.infer<typeof insertSessionSlotSchema>;
export type SessionSlot = typeof sessionSlotsTable.$inferSelect;
