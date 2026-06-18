---
name: Aperti red-team security hardening
description: All vulnerabilities found and fixed across two full adversarial audit sessions — patterns to not reintroduce.
---

## Session 1 fixes (exam, AI, billing, referral)
- exam.ts student routes: use requireStudentAccess (not authenticate+requireRole("student")); GET assigned must filter by teacherAccountId; GET take must verify exam belongs to student's teacher; POST submit must use req.studentId (not req.userId) and verify teacher ownership
- exams.ts: students blocked from GET /exams/:id/results; POST /exams/:id/marks validates studentId against teacher's roster + bounds-checks marksScored (0–10000)
- ai-gateway.ts: message.slice(0,4000), context.slice(0,2000); context injected as labeled user message NOT assistant role; trackInteraction uses safeMessage not raw message
- subscription-engine.ts: plan.type checked against req.role — students can't subscribe to teacher plans
- referral.ts: 48h window on referred account, 7-day minimum age on referrer
- app.ts: global body limit 1mb (was 10mb)

## Session 2 fixes (metrics, pool, admin, coupons, search, monitor, seed)
- prometheus.ts: /metrics now requires METRICS_TOKEN Bearer if env var set — never public in production
- lib/db/src/index.ts: pool max:25, idleTimeoutMillis:10000, connectionTimeoutMillis:3000, statement_timeout:30000
- app.ts seedDefaultAdmin: password is randomBytes(12).toString("hex") — never hardcode admin123
- subscription-engine.ts: per-user coupon replay check against coupon_redemptions before atomic UPDATE; records redemption after claim
- admin-users.ts PUT /:id: non-super_admin cannot set role:"super_admin"; admins cannot change their own role
- search.ts GET /: now requires authenticate middleware — was fully public, exposed user/course/student enumeration
- online-exams.ts GET /monitor: blocks students and parents with 403 — was only requireTenantAccess
- app.ts cron: DELETE FROM system_metrics_log WHERE created_at < NOW() - INTERVAL '30 days' runs daily at 03:00 UTC alongside api_metrics purge

## Architectural gaps (not fixed in code — require infra)
- File storage is local disk (uploads/ dir) — single server only; must migrate to S3/R2 before horizontal scaling
- Email is a stub (email.ts returns Promise.resolve()) — password reset is admin-manual; need SMTP provider
- No external alerting (Slack/PagerDuty) — errors stored in DB only; need webhook_url configured in founder settings
- Upload storage quota (storage_gb per plan) exists in enforceLimit middleware but is NOT wired to POST /upload or /snapgrade/scan

## Key invariants to maintain
- All student-facing exam routes MUST use requireStudentAccess (not raw authenticate)
- All AI user input MUST be sliced before being sent to model
- /metrics MUST require METRICS_TOKEN in production
- Coupon claim in subscription-engine MUST check coupon_redemptions before atomic UPDATE
- Admin role updates MUST block self-role-change and super_admin promotion by non-super_admins
