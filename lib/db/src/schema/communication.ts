import {
  pgTable, text, serial, integer, timestamp, jsonb, boolean,
} from "drizzle-orm/pg-core";
import { accountsTable } from "./accounts";

// ── Message Threads ────────────────────────────────────────────────────────────
export const messageThreadsExtTable = pgTable("message_threads_ext", {
  id: serial("id").primaryKey(),
  type: text("type").notNull().default("direct"), // direct | group | class | course | parent | ticket
  title: text("title"),
  contextType: text("context_type"), // lesson | homework | exam | course
  contextId: integer("context_id"),
  createdBy: integer("created_by").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const threadParticipantsTable = pgTable("thread_participants", {
  id: serial("id").primaryKey(),
  threadId: integer("thread_id").notNull().references(() => messageThreadsExtTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
});

export const threadMessagesTable = pgTable("thread_messages", {
  id: serial("id").primaryKey(),
  threadId: integer("thread_id").notNull().references(() => messageThreadsExtTable.id, { onDelete: "cascade" }),
  senderId: integer("sender_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  attachmentUrl: text("attachment_url"),
  attachmentType: text("attachment_type"), // image | document | voice | whiteboard
  aiGenerated: boolean("ai_generated").notNull().default(false),
  translationData: jsonb("translation_data").$type<Record<string, string>>(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Announcements ──────────────────────────────────────────────────────────────
export const announcementsTable = pgTable("announcements", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  audienceType: text("audience_type").notNull().default("class"), // class | course | parent | all
  audienceIds: jsonb("audience_ids").$type<number[]>().default([]),
  title: text("title").notNull(),
  body: text("body").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  status: text("status").notNull().default("draft"), // draft | scheduled | delivered
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const announcementReadsTable = pgTable("announcement_reads", {
  id: serial("id").primaryKey(),
  announcementId: integer("announcement_id").notNull().references(() => announcementsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Collaboration Rooms ────────────────────────────────────────────────────────
export const collaborationRoomsTable = pgTable("collaboration_rooms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("study_group"), // study_group | revision | exam_prep | peer_tutoring
  courseId: integer("course_id"),
  createdBy: integer("created_by").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  settings: jsonb("settings").$type<Record<string, unknown>>().default({}),
  isPublic: boolean("is_public").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const roomMembersTable = pgTable("room_members", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull().references(() => collaborationRoomsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"), // owner | moderator | member | viewer
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
});

export const roomMessagesTable = pgTable("room_messages", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull().references(() => collaborationRoomsTable.id, { onDelete: "cascade" }),
  senderId: integer("sender_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  attachmentUrl: text("attachment_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sharedResourcesTable = pgTable("shared_resources", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull().references(() => collaborationRoomsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  resourceType: text("resource_type").notNull(), // note | flashcard | quiz | whiteboard
  resourceId: integer("resource_id"),
  title: text("title"),
  sharedAt: timestamp("shared_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Support Tickets ────────────────────────────────────────────────────────────
export const supportTicketsTable = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull().default("technical"), // technical | academic | payment | account | exam
  status: text("status").notNull().default("open"), // open | assigned | in_progress | resolved | closed
  assignedTo: integer("assigned_to").references(() => accountsTable.id, { onDelete: "set null" }),
  priority: text("priority").notNull().default("normal"), // low | normal | high | urgent
  aiSuggestions: jsonb("ai_suggestions").$type<string[]>().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ticketResponsesTable = pgTable("ticket_responses", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull().references(() => supportTicketsTable.id, { onDelete: "cascade" }),
  responderId: integer("responder_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Notification Preferences ───────────────────────────────────────────────────
export const notificationPreferencesTable = pgTable("notification_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  category: text("category").notNull(), // messages | announcements | grades | attendance | system
  deliveryMethod: text("delivery_method").notNull().default("in_app"), // in_app | email | push | sms
  enabled: boolean("enabled").notNull().default(true),
  frequency: text("frequency").notNull().default("instant"), // instant | daily | weekly
});

// ── Moderation Logs ────────────────────────────────────────────────────────────
export const moderationLogsTable = pgTable("moderation_logs", {
  id: serial("id").primaryKey(),
  reportedBy: integer("reported_by").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  contentType: text("content_type").notNull(), // message | user | group | room
  contentId: integer("content_id").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"), // pending | reviewed | resolved | dismissed
  action: text("action"), // warn | remove | ban | none
  resolvedBy: integer("resolved_by").references(() => accountsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Class Channels ─────────────────────────────────────────────────────────────
export const classChannelsTable = pgTable("class_channels", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id"),
  name: text("name").notNull(),
  description: text("description"),
  createdBy: integer("created_by").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  isLocked: boolean("is_locked").notNull().default(false),
  pinnedMessageId: integer("pinned_message_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const channelMessagesTable = pgTable("channel_messages", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").notNull().references(() => classChannelsTable.id, { onDelete: "cascade" }),
  senderId: integer("sender_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  isPinned: boolean("is_pinned").notNull().default(false),
  attachmentUrl: text("attachment_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
