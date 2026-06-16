---
name: Aperti Phase 52 FinTech Suite
description: Fraud detection, refund engine, teacher revenue analytics, subscription lifecycle — routes, tables, frontend pages all complete.
---

## New backend routes
- `POST /api/fraud/analyze` + `GET /api/fraud/audit-log` → `fraud-detection.ts`
- `POST /api/refunds/request`, `GET /api/refunds`, `POST /api/refunds/:id/evaluate`, `POST /api/refunds/:id/process`, `GET|POST /api/refunds/rules` → `refund-engine.ts`
- `GET /api/revenue/my` (teacher), `GET /api/revenue/teacher/:id` (admin), `GET /api/revenue/platform` (admin) → `teacher-revenue.ts`
- `GET /api/subscriptions/lifecycle/status`, `PATCH /api/subscriptions/lifecycle/auto-renew`, `POST /api/subscriptions/lifecycle/run-expiry-check`, `POST /api/subscriptions/lifecycle/restore/:id`, `GET /api/subscriptions/lifecycle/overview` → `subscription-lifecycle.ts`

## DB tables added (PHASE52_MIGRATIONS in migrate.ts)
- `fraud_audit_log` — UNIQUE on transaction_id, risk_level/score indexes
- `refund_requests` — status check constraint, FK to payment_transactions
- `refund_rules` — seeded with 4 default rules (within 24h/course accessed/not accessed/over 7 days)
- `subscriptions` — added `auto_renew BOOLEAN`, `grace_period_days INTEGER`, `renewal_attempted_at TIMESTAMPTZ`

## Frontend pages
- `src/pages/admin/fraud-monitor.tsx` — risk log table, score bar, re-analyze modal; route `/admin/fraud-monitor`
- `src/pages/teacher/revenue-dashboard.tsx` — daily/weekly mini-bar charts, course breakdown; route `/teacher/revenue`
- `src/pages/admin/admin-os/RefundManagementPage.tsx` — requests table + rules tab; route `/admin/os/refunds`
- `src/pages/admin/admin-os/PlatformRevenuePage.tsx` — top teachers, MRR breakdown, daily bar; route `/admin/os/revenue-analytics`
- `src/pages/admin/admin-os/SubscriptionLifecyclePage.tsx` — overview stats, run expiry check, manual restore; route `/admin/os/subscription-lifecycle`

## AdminLayout.tsx nav section added
`— FinTech` header with 4 entries: Fraud Monitor, Refund Engine, Revenue Analytics, Subscription Lifecycle

## Fraud risk signals (7 total, weighted 0.20–0.40)
duplicate_reference(0.40), new_account_high_value(0.35), burst_activity(0.30), approver_collusion(0.30), repeated_failures(0.25), discount_abuse(0.25), multiple_pending(0.20)
Score >= 0.7 → block, >= 0.3 → manual_review, < 0.3 → approve

**Why:** FinTech subsystems use financial_audit_log (existing) for all actions via auditLog() helper; fraud_audit_log is the separate dedicated ML-style scoring table.
