import { pgTable, text, serial, jsonb, boolean, timestamp } from "drizzle-orm/pg-core";

export const landingSettingsTable = pgTable("landing_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: jsonb("value"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LandingSetting = typeof landingSettingsTable.$inferSelect;
