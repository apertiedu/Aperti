---
name: Subscriptions schema gaps
description: Missing columns in subscriptions table and Drizzle relational API not configured
---

## Rule
The `subscriptions` table was pre-existing with only basic columns. Drizzle schema (`lib/db/src/schema/subscriptions.ts`) expects `screenshot_url TEXT` and `coupon_id INTEGER REFERENCES coupons(id)` which were absent — causing `select` to fail.

**Fix applied:** `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS screenshot_url TEXT, ADD COLUMN IF NOT EXISTS coupon_id INTEGER REFERENCES coupons(id);`

**Why:** The table was created by an earlier migration that didn't include all columns the Drizzle schema later defined.

**How to apply:** After any schema change to `subscriptions.ts`, check actual DB columns via `\d subscriptions` and apply `ALTER TABLE ADD COLUMN IF NOT EXISTS` for any gaps.

## Drizzle Relations Not Configured
`lib/db/src/index.ts` builds `querySchema` as a plain object of table aliases. No `relations()` definitions exist. This means `db.query.X.findMany({ with: { plan: true } })` always throws `Cannot read properties of undefined (reading 'referencedTable')`.

**Fix:** Replace all relational queries in route files with plain `db.select()` + manual join logic. Do NOT add `with: {...}` anywhere until `relations()` are properly defined and exported.
