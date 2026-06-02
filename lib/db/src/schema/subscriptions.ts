import { pgTable, text, serial, integer, timestamp, numeric, jsonb, boolean } from "drizzle-orm/pg-core";
import { accountsTable } from "./accounts";

export const subscriptionPlansTable = pgTable("subscription_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("teacher"),
  priceEgp: numeric("price_egp", { precision: 10, scale: 2 }).notNull(),
  features: jsonb("features").$type<string[]>(),
  studentLimit: integer("student_limit"),
  flexSeatPriceEgp: numeric("flex_seat_price_egp", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const couponsTable = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }).notNull(),
  maxUses: integer("max_uses"),
  usedCount: integer("used_count").notNull().default(0),
  expiryDate: timestamp("expiry_date", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: integer("created_by").references(() => accountsTable.id),
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
  screenshotUrl: text("screenshot_url"),
  couponId: integer("coupon_id").references(() => couponsTable.id),
  paymentStatus: text("payment_status").notNull().default("approved"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SubscriptionPlan = typeof subscriptionPlansTable.$inferSelect;
export type Coupon = typeof couponsTable.$inferSelect;
export type Subscription = typeof subscriptionsTable.$inferSelect;
