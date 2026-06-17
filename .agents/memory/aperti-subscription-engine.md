---
name: Aperti Subscription Engine
description: Hardened FSM billing system — states, ledger dependency, guard middleware, DB schema, rate limiter rules
---

## FSM States
`inactive` → `pending_payment` → `pending_confirmation` → `active` → `grace_period` → `expired` | `suspended`

## Key Files
- `src/lib/subscription-fsm.ts` — `canTransition`, `transitionSubscription`, `activateWithLedger`, `runGraceAndExpiryCheck`, `checkFraudFlags`
- `src/routes/subscription-engine.ts` — `/api/sub-engine/*` — 10+ endpoints
- `src/middleware/subscription-guard.ts` — `requireActiveSubscription()` middleware
- `src/pages/admin/subscription-engine.tsx` — admin UI with FSM flow, pending confirmations, audit log

## Critical Rules
- Activation (`activateWithLedger`) ONLY creates ledger entry if none already exists for (account_id, subscription_id) — prevents double-activation
- Rate limiters: NEVER use custom `keyGenerator` with `req.ip` fallback — causes `ERR_ERL_KEY_GEN_IPV6` crash
- Duplicate Instapay code blocked in BOTH `subscriptions.instapay_code` and `payment_requests.reference_code`
- Admin reject → `pending_confirmation → pending_payment` (user retries); sets instapay_code + screenshot_url = null
- Grace period = 3 days; `runGraceAndExpiryCheck()` moves `active→grace_period` then `grace_period→expired`

## DB Tables / Columns Added
- `subscription_audit_log` — full transition history (subscription_id, user_id, previous_status, new_status, reason, triggered_by, actor_id, metadata)
- `subscriptions` added: `grace_period_ends_at`, `suspended_at/by/reason`, `fraud_flags jsonb`, `payment_attempt_count`, `pending_invoice_id`, `updated_at`
- `payment_requests` added: `fraud_flagged boolean`, `attempt_count integer`

**Why:** The old `subscriptions.ts` used naive Drizzle ORM updates with no state machine, no ledger check, and no audit log — any admin could activate without a confirmed ledger entry. The FSM enforces correctness at every transition and makes the billing system auditable.
