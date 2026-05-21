import { pgTable, text, serial, integer, timestamp, numeric, jsonb } from "drizzle-orm/pg-core";
import { accountsTable } from "./accounts";

export const subscriptionPlansTable = pgTable("subscription_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("teacher"),
  priceEgp: numeric("price_egp", { precision: 10, scale: 2 }).notNull(),
  features: jsonb("features").$type<string[]>(),
  studentLimit: integer("student_limit"),
  flexSeatPriceEgp: numeric("flex_seat_price_egp", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const subscriptionsTable = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => accountsTable.id, { onDelete: "cascade" }),
  planId: integer("plan_id").notNull().references(() => subscriptionPlansTable.id),
  status: text("status").notNull().default("active"),
  startDate: timestamp("start_date", { withTimezone: true }).notNull().defaultNow(),
  endDate: timestamp("end_date", { withTimezone: true }),
  instaPayCode: text("instapay_code"),
  paymentStatus: text("payment_status").notNull().default("approved"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const flexSeatsTable = pgTable("flex_seats", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id").notNull().references(() => subscriptionsTable.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull().default(1),
  priceEgp: numeric("price_egp", { precision: 10, scale: 2 }).notNull(),
  active: text("active").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SubscriptionPlan = typeof subscriptionPlansTable.$inferSelect;
export type Subscription = typeof subscriptionsTable.$inferSelect;
export type FlexSeat = typeof flexSeatsTable.$inferSelect;
