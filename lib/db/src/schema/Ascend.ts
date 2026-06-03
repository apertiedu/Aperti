import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { accountsTable } from "./accounts";

export const ascendProfilesTable = pgTable("ascend_profiles", {
  id: serial("id").primaryKey(),
  studentAccountId: integer("student_account_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  xp: integer("xp").notNull().default(0),
  level: integer("level").notNull().default(1),
  streak: integer("streak").notNull().default(0),
  rank: text("rank").notNull().default("Bronze"),
  archetype: text("archetype").notNull().default("Explorer"),
  privacyMode: text("privacy_mode").notNull().default("public"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const questsTable = pgTable("quests", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull().default("daily"),
  xpReward: integer("xp_reward").notNull().default(100),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AscendProfile = typeof ascendProfilesTable.$inferSelect;
export type Quest = typeof questsTable.$inferSelect;
