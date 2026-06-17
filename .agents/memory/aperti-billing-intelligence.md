---
name: Aperti Billing Intelligence Layer
description: Features 26–34 — subscription analytics, upgrade/downgrade, billing event bus, payment recovery, A/B pricing experiments, role-based plans, finance control center, UX checkout
---

## DB Tables Added
- `billing_events` — append-only event stream; NEVER modified after insert; 17 event types
- `plan_changes` — upgrade/downgrade requests + applied status + proration + ledger_entry_id
- `payment_recoveries` — max 3 attempts, 48h window, 8h between retries, status flow: retry_scheduled→recovered|permanently_failed
- `pricing_experiments` — variants jsonb, traffic_split jsonb (must sum to 100)
- `experiment_assignments` — UNIQUE(experiment_id, user_id) — sticky variant; deterministic hash of user_id
- `subscription_metrics_snapshots` — UNIQUE(snapshot_date) — daily snapshots via POST /api/sub-analytics/snapshot
- `subscription_plans` — added scope/teacher_id/course_id columns

## Routes Mounted
All under `/api/`:
- `/sub-analytics` — analytics (admin only); all metrics from ledger_entries, never from pending
- `/plan-change` — upgrade/downgrade; admin applies with ledger proration
- `/billing-events` — recent events, SSE stream at /stream, counts
- `/payment-recovery` — schedule, run-scheduled (bulk), admin/resolve/:id
- `/pricing-experiments` — create, assign (deterministic), status toggle, record-conversion
- `/role-plans` — teacher plans (scope=teacher_course, teacher_id set), admin sees all

## Frontend Pages
- `/admin/finance-control-center` — unified entry point with alert bar, all 7 FSM state counts, recent events, quick nav
- `/admin/subscription-analytics` — MRR/ARR/churn/retention/funnel charts (all from ledger)
- `/admin/billing-events` — SSE live strip + event type filter badges + event list
- `/admin/payment-recovery` — recovery rules strip, bulk run, manual resolve per record
- `/admin/pricing-experiments` — create modal with split slider, per-variant CVR bars, status toggles
- `/subscribe` — 5-step UX: select→checkout→payment→pending→active with StatusBanner; NEVER shows "active" until ledger confirms

## Critical Rules
- `billing-event-bus.ts`: emitBillingEvent() is fire-and-forget (catches silently) — never await in request path if non-critical
- Plan change proration only applies to upgrades; downgrades take effect next billing cycle (no immediate change to plan_id)
- experiment_assignments variant determinism: `(userId * 2654435761) % 100` bucketed by cumulative traffic_split %
- `/api/sub-analytics/*` always query ledger_entries with `entry_type='credit'`, never subscriptions.status for revenue
- SSE stream at `/api/billing-events/stream` polls DB every 10s — no persistent EventEmitter; safe for multi-process

**Why:** Analytics must be auditable — using ledger as source of truth means revenue numbers match actual confirmed payments, not admin-pending approvals. The event stream is append-only for the same reason (immutable audit trail).
