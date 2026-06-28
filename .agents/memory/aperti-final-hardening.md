---
name: Aperti final hardening pass
description: Production hardening audit findings and fixes from the comprehensive 12-phase pass.
---

## Key Fixes Applied

### Security
- `app.ts` line 175: Removed `'unsafe-eval'` from CSP `scriptSrc` in production — was significantly weakening XSS protection
- `timetable.ts`: SQL injection via `teacherCond` string interpolation → converted to parameterized `$1` query
- `subjects.ts` PATCH: IDOR — no ownership check, any teacher could edit any subject → added `WHERE id=${id} AND teacher_account_id=${teacherId}` via `ownershipCond`
- `subjects.ts` DELETE: missing `accountId` in destructuring (was undefined at runtime) → added to `req.tenant` destructure
- `subjects.ts`: missing `and` import from drizzle-orm (DELETE handler used it but it was never imported)

### Performance / DB Safety
- `session-slots-conflicts.ts`: unbounded `SELECT * FROM session_slots WHERE is_active=true` → `.limit(500)`
- `qa.ts`: unbounded `SELECT * FROM test_cases` in run handler → `.limit(5000)`
- `weave-graph.ts` line 101: unbounded `SELECT * FROM knowledge_edges` for BFS → `.limit(10000)`

### Content Integrity
- `landing.tsx`: hardcoded marketing stats (2400/180/12000/98%) → replaced with live `StatsSection` component fetching `/api/auth/stats` (returns real DB counts)

### UI/UX
- `admin-push.tsx`: missing loading state and empty state for subscriber stats section → animated skeleton + "No subscribers by role yet" empty state
- `courses.tsx`: missing `onError` on course thumbnail `<img>` → hides broken image
- `course-detail.tsx`: same missing `onError` on hero thumbnail → hides broken image

### SEO
- `artifacts/aperti/public/robots.txt`: CREATED — was missing (critical for search indexing)
- `artifacts/aperti/public/sitemap.xml`: CREATED — was missing (7 public URLs with priorities)

## What NOT to fix (acceptable as-is)
- `math-renderer.tsx` `dangerouslySetInnerHTML` — already uses DOMPurify double-sanitization (false alarm from security scan)
- `content-craft.tsx` `dangerouslySetInnerHTML` — wraps `DOMPurify.sanitize()`
- `/auth/stats` public endpoint — returns only aggregate counts, no PII
- `student-home-summary.ts` N+1 (~14 queries) — uses `Promise.all()` parallelism; acceptable for now
- `subscriptionPlansTable` unbounded — plans are a static, small admin-configured table (~5-10 rows max)

## Remaining Manual Work (env secrets needed in prod)
- `EXAM_VAULT_KEY`, `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`, `SMTP_*`, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, `INSTAPAY_PHONE`/`INSTAPAY_NAME`
- Check `/api/health/diagnostics` to see which are missing in production
