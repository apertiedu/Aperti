---
name: Aperti route paths
description: Frontend fetch() calls must use /api/ prefix; dashboard sub-routes mount at /api/dashboard/.
---

## Rule
Every `fetch()` or `apiFetch()` call in the frontend must begin with `/api/`.

Known mount points:
- Most routes: `/api/...`
- Dashboard routes: `/api/dashboard/...` (includes activity-heatmap, live-stats)
- Auth: `/auth/login`, `/auth/logout` (no `/api/` prefix — handled separately)

**Why:** Several files (course-hub.tsx, my-courses.tsx, admin-command.tsx) used paths like `/courses/...` or `/dashboard/admin/...` without the `/api/` prefix, causing silent 404s. These only fail at runtime with null data — no crash — so they're hard to spot in reviews.

**How to apply:** When adding new frontend API calls, always start with `/api/`. If in doubt, check `artifacts/api-server/src/routes/index.ts` for the mount prefix.
