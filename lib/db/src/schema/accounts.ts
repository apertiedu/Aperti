import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";

export const accountsTable = pgTable("accounts", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull().default(""),
  email: text("email"),
  role: text("role").notNull().default("teacher"),
  status: text("status").notNull().default("active"),
  teacherAccountId: integer("teacher_account_id"),
  systemMode: text("system_mode").notNull().default("full"),
  emailVerified: boolean("email_verified").notNull().default(false),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  isVerified: boolean("is_verified"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  verifiedBy: integer("verified_by"),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  phone: text("phone"),
  country: text("country"),
  firstName: text("first_name"),
  lastName: text("last_name"),
});

export const deviceSessionsTable = pgTable("device_sessions", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  deviceId: text("device_id").notNull(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const assistantPermissionsTable = pgTable("assistant_permissions", {
  id: serial("id").primaryKey(),
  assistantId: integer("assistant_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  permission: text("permission").notNull(),
  grantedBy: integer("granted_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Account = typeof accountsTable.$inferSelect;
export type DeviceSession = typeof deviceSessionsTable.$inferSelect;
export type AssistantPermission = typeof assistantPermissionsTable.$inferSelect;
