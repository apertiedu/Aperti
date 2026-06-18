---
name: Aperti security + performance audit findings
description: Critical bugs fixed during the full system investigation — patterns to watch for in future work
---

## SQL injection pattern
- `admin-learning-efficiency.ts` had ILIKE with `replace(/'/g,"''")` — insufficient. Always use `$N` parameterized queries. Dynamic WHERE clauses should build a params array and inject `$${params.length}` positions only.

## Rate limiter key extraction
- `extractRateLimitKey` in `app.ts` was reading `cookies["token"]` — cookie is named `aperti_token`. Always match the auth middleware cookie name. Add `req.ip` fallback when token is absent.

## IDOR in teacher-courses mutations
- PUT/DELETE on `/units/:id`, `/topics/:id`, `/lessons/:id` had no ownership check. Fix: JOIN through the resource → course_units → teacher_courses WHERE teacher_account_id = req.userId. Admin bypass is `isAdmin ? simple existence check : ownership JOIN`.

## N+1 pattern in reports/analytics
- `reports/weekly-data` and `reports/generate` were doing 5+ queries per student in a loop (up to 500+ queries). Fix: bulk fetch with `inArray(studentId, studentIds)` + `GROUP BY student_id`, then aggregate in-memory with Maps.
- `analytics/class-overview` was doing one `studentMarks.findMany` per exam (up to 5 queries). Fix: single `SELECT exam_id, AVG(...) GROUP BY exam_id WHERE exam_id = ANY($1)` pool.query.

## Unbounded accounts table scan
- `reports/system-stats` did `db.select().from(accountsTable)` (all rows) to count by role and to populate a full accounts list in the response. Fix: separate `COUNT(*)` queries per role, fetch only the ~110 accounts actually referenced by top teachers + audit log actors via `inArray`, return paginated 200-row list.

## requestObserver DB write
- Logs every request to `system_metrics_log`. Added `if (Math.random() > 0.1) return;` in the `finish` handler to sample 10%.

## Analytics attendance data isolation
- `analytics/class-overview` fetched ALL attendance for last 30 days with no teacher filter. Fix: add `inArray(studentId, studentIds)` where studentIds comes from the teacher's own students list.

## Upload magic byte validation
- `upload.ts` only validated `fileType` from request body (client-controlled). Added `hasMagicBytes(buffer, fileType)` check after base64 decode: PNG=0x89504E47, JPEG=0xFFD8FF, PDF=0x25504446.

## CORS production warning
- When `ALLOWED_ORIGINS` env var not set, CORS defaults to `origin: true` (allow all). Added `console.warn` in production to surface this without blocking dev.
