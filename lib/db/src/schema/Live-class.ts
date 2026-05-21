import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { accountsTable } from "./accounts";
import { lessonsTable } from "./sessions";

export const liveClassRoomsTable = pgTable("live_class_rooms", {
  id: serial("id").primaryKey(),
  lessonId: integer("lesson_id").notNull().references(() => lessonsTable.id, { onDelete: "cascade" }),
  roomName: text("room_name").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  endedAt: timestamp("ended_at", { withTimezone: true }),
  recordingUrl: text("recording_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const twinControlSessionsTable = pgTable("twin_control_sessions", {
  id: serial("id").primaryKey(),
  liveClassId: integer("live_class_id").notNull().references(() => liveClassRoomsTable.id, { onDelete: "cascade" }),
  hostDeviceId: text("host_device_id").notNull(),
  controlDeviceId: text("control_device_id").notNull(),
  token: text("token").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const engagementHeatmapTable = pgTable("engagement_heatmap", {
  id: serial("id").primaryKey(),
  liveClassId: integer("live_class_id").notNull().references(() => liveClassRoomsTable.id, { onDelete: "cascade" }),
  studentId: integer("student_id").notNull(),
  engagementScore: integer("engagement_score").notNull().default(0),
  attentionTimeline: text("attention_timeline"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LiveClassRoom = typeof liveClassRoomsTable.$inferSelect;
export type TwinControlSession = typeof twinControlSessionsTable.$inferSelect;
export type EngagementHeatmap = typeof engagementHeatmapTable.$inferSelect;
