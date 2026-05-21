import { pgTable, serial, integer, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { subscriptionsTable } from "./subscriptions";

export const flexSeatsTable = pgTable("flex_seats", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id").notNull().references(() => subscriptionsTable.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull().default(1),
  priceEgp: numeric("price_egp", { precision: 10, scale: 2 }).notNull(),
  active: text("active").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type FlexSeat = typeof flexSeatsTable.$inferSelect;
