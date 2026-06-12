# Founder Guide — Aperti

## Daily Command Check

Visit `/admin/os` (Founder Control section in the sidebar) for your daily dashboard:
- **Revenue** — total and this-month revenue from live transactions
- **Active users** — DAU/WAU/MAU
- **Error count (24h)** — frontend and backend errors from `frontend_error_logs`
- **Platform health** — DB connectivity, API uptime
- **AI usage** — token consumption this month

## Launch Certification
Admin OS → Launch Certification — the 12-check gate before going live.
All 12 checks must pass before you launch to real users.

## No Mock Data Audit
Admin OS → No Mock Data Audit — verifies every public-facing number comes from the database.

## Analytics Deep Dive
Admin OS → Analytics Deep Dive — user growth, revenue growth, retention cohorts, error trends.

## Key Operational Actions
- **Vacuum database**: DB Health → Run VACUUM ANALYZE
- **Review errors**: Error Intelligence → filter by severity
- **Performance**: Slow Queries → identify bottlenecks
- **Notify users**: Announcement system or Notification Rules

## Founder Absence Checklist
If handing off to a new developer, point them to:
1. `README.md` — project setup
2. `.env.example` — all required environment variables
3. `docs/` — role guides
4. `lib/db/src/schema.ts` — full database schema
5. `artifacts/api-server/src/app.ts` — route registration map
