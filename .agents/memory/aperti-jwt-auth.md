---
name: Aperti JWT auth system
description: Critical auth wiring decisions for the Aperti monorepo — JWT secret, db.query aliases, table name mismatches, and frontend apiFetch
---

## JWT_SECRET consistency
`routes/auth.ts` signs tokens with `process.env.JWT_SECRET || "aperti-dev-secret-change-in-prod"`.
`middleware/auth.ts` must use the **exact same fallback string** or all tokens are invalid.

**Why:** The two files each defined their own fallback string and they differed, causing every authenticated request to fail with "Invalid token."

**How to apply:** Any new file that imports or re-defines JWT_SECRET must use the same fallback.

## db.query aliases (Drizzle relational queries)
`drizzle(pool, { schema })` enables `db.query.*` only if the schema object keys match what routes use.
The schema exports tables as `accountsTable`, `lessonsTable`, etc., but routes call `db.query.accounts`, `db.query.lessons`, etc.

Fix: `lib/db/src/index.ts` builds a `querySchema` object with aliases (e.g. `accounts: schema.accountsTable`) before passing to drizzle.

**Why:** Without aliases, `db.query.accounts` is `undefined` at runtime, crashing every auth and data route.

**How to apply:** When adding new routes that use `db.query.X`, add the alias `X: schema.XTable` to `querySchema` in `lib/db/src/index.ts`.

## sessionsTable is an alias for lessonsTable
`lib/db/src/schema/sessions.ts` exports `sessionsTable = lessonsTable` — both point to the `lessons` DB table.
Any raw SQL in routes (timetable, calendar, gradebook) must reference `lessons`, NOT `sessions`.

**Why:** There is no `sessions` table in the database; using `FROM sessions` causes "relation does not exist."

## Frontend apiFetch utility
All frontend pages that need auth must use `apiFetch` from `@/lib/api` (not raw `fetch` with `credentials: "include"`).
`apiFetch` reads `localStorage.getItem("aperti_token")` and injects `Authorization: Bearer <token>`.

**Why:** The backend abandoned session cookies for JWT; pages using `credentials: "include"` silently fail auth.

**How to apply:** Any new page making authenticated requests should import `{ apiFetch } from "@/lib/api"`.

## Router mounting prefixes
Routers whose routes start with `"/"` (root) must be mounted with a prefix:
- `router.use("/students", studentsRouter)` — GET "/" becomes GET "/api/students"
- `router.use("/attendance", attendanceRouter)` — GET "/today" becomes GET "/api/attendance/today"
- `router.use("/dashboard", dashboardRouter)` — GET "/summary" becomes GET "/api/dashboard/summary"

Routers whose routes already embed the resource name (e.g. `router.get("/subjects", ...)`) can be mounted without prefix.
