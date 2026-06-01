import { pgTable, serial, integer, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { liveClassRoomsTable } from "./Live-class";
import { studentsTable } from "./students";

export const engagementRecordsTable = pgTable("engagement_records", {
  id: serial("id").primaryKey(),
  liveClassId: integer("live_class_id").notNull().references(() => liveClassRoomsTable.id, { onDelete: "cascade" }),
  studentId: integer("student_id").notNull().references(() => studentsTable.id, { onDelete: "cascade" }),
  handRaises: integer("hand_raises").notNull().default(0),
  chatMessages: integer("chat_messages").notNull().default(0),
  pollResponses: integer("poll_responses").notNull().default(0),
  attentionPercentage: integer("attention_percentage").notNull().default(100),
  joinedAt: timestamp("joined_at"),
  leftAt: timestamp("left_at"),
  participationScore: integer("participation_score").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EngagementRecord = typeof engagementRecordsTable.$inferSelect;
