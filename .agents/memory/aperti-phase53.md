---
name: Aperti Phase 53 Financial Core
description: Double-entry ledger engine, real-time fraud alert center, teacher payout system — all 3 built and live.
---

## Double-Entry Ledger System

### Core library: `src/lib/ledger-engine.ts`
- `recordPaymentLedger()` — 3 entries per payment (student_wallet DEBIT + teacher_revenue CREDIT + platform_revenue CREDIT) in a single DB transaction; throws on imbalance before inserting
- `recordRefundLedger()` — reversal entries (never modifies originals); proportional refunds use ratio = refundAmount / totalOriginalDebit
- `getAccountBalance(accountType)` — SUM credits minus debits
- `verifyTransactionBalance(txId)` — per-transaction balance check
- `findImbalances()` — finds all txIds where |debits - credits| > 0.01
- `findMissingEntries()` — payment_transactions with status verified/approved but no ledger entries
- `createFraudAlert()` — inserts into fraud_alerts table (silently ignores errors via .catch)
- `getPlatformCutPercent()` / `setPlatformCutPercent()` — reads/writes platform_settings key='platform_cut_percent' JSON {percent: N}

### Routes: `/api/ledger`
All admin-only. GET /entries, GET /balances, POST /record-payment, POST /record-refund, GET /reconcile, GET /transaction/:id, PATCH /settings

### DB table: `ledger_entries`
Immutable (no UPDATE/DELETE). Reversal entries have is_reversal=TRUE + reversal_of FK. account_type CHECK constraint: student_wallet/teacher_revenue/platform_revenue/refund_pool.

## Fraud Alert Center

### Routes: `/api/fraud-alerts`
- GET / — with severity/status/type filters + stats summary
- GET /live — latest 30 open alerts (for polling)
- POST /:id/resolve, /:id/ignore, /:id/review — admin actions
- POST /generate-from-log — backfill alerts from fraud_audit_log for medium/high risk entries not yet alerted

### DB table: `fraud_alerts`
severity CHECK (low/medium/high), status CHECK (open/reviewed/resolved/ignored), resolved_by FK accounts.

### No streaming/SSE
Frontend polls `GET /api/fraud-alerts?status=open` every 15 seconds via `refetchInterval: 15_000` in TanStack Query.

## Teacher Payout System

### Routes: `/api/payouts`
- GET /my — teacher's own payouts + pending_earnings
- GET /pending — admin: all pending/processing payouts
- GET /overview — admin summary stats
- GET /teacher/:id — admin: specific teacher history
- POST /calculate/:teacherId — creates a single payout record from eligible ledger entries
- POST /batch-calculate — creates payouts for ALL teachers with eligible earnings
- POST /:id/process — marks a payout as paid (requires reference string for InstaPay)
- POST /:id/cancel — cancels a pending payout
- POST /ledger-record — admin can manually record a transaction to the ledger

### Eligibility rules for payout calculation
- Ledger entries: `account_type = 'teacher_revenue'`, `entry_type = 'credit'`, `is_reversal = FALSE`
- Transaction must be verified/approved
- Created more than `refund_window_days` (default 7) ago
- No active refund_request (status pending/approved/partial)
- Entry IDs must not already be in an existing payout's ledger_snapshot.entry_ids

### Anti-double-payout protection
Subquery checks `ledger_snapshot->'entry_ids'` of existing payouts (pending/processing/paid) before including entries in a new calculation.

## Platform Settings
- key='platform_cut_percent', value={"percent": 15} — seeded in Phase 53 migrations
- key='refund_window_days', value={"days": 7} — seeded in Phase 53 migrations
- Adjustable via `PATCH /api/ledger/settings`

## Frontend pages (admin-os)
- `/admin/os/ledger` — LedgerPage: balance cards (4 accounts), entry table with filters, reconcile tab, settings tab
- `/admin/os/fraud-alert-center` — FraudAlertCenterPage: auto-polls 15s, severity+status filters, resolve/ignore/review actions, backfill button
- `/admin/os/teacher-payouts` — TeacherPayoutsPage: overview stats, batch calc, individual calc by ID, pending table with process modal

**Why:** Ledger must be the single source of truth — payout calculation always derives from ledger_entries (not payment_transactions.amount directly) to prevent double-counting and to honor partial reversals.
