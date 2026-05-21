import { pgTable, text, serial, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { accountsTable } from "./accounts";

export const kudosSettingsTable = pgTable("kudos_settings", {
  id: serial("id").primaryKey(),
  teacherAccountId: integer("teacher_account_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  isEnabled: text("is_enabled").notNull().default("off"),
  rewardPoolPercent: numeric("reward_pool_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const kudosPointsTable = pgTable("kudos_points", {
  id: serial("id").primaryKey(),
  teacherAccountId: integer("teacher_account_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  assistantAccountId: integer("assistant_account_id").notNull().references(() => accountsTable.id),
  taskCategory: text("task_category").notNull(),
  points: integer("points").notNull(),
  earnedAt: timestamp("earned_at", { withTimezone: true }).notNull().defaultNow(),
});

export const kudosBadgesTable = pgTable("kudos_badges", {
  id: serial("id").primaryKey(),
  assistantAccountId: integer("assistant_account_id").notNull().references(() => accountsTable.id),
  badgeName: text("badge_name").notNull(),
  level: integer("level").notNull().default(1),
  earnedAt: timestamp("earned_at", { withTimezone: true }).notNull().defaultNow(),
});

export type KudosSettings = typeof kudosSettingsTable.$inferSelect;
export type KudosPoint = typeof kudosPointsTable.$inferSelect;
export type KudosBadge = typeof kudosBadgesTable.$inferSelect;
