---
name: Aperti Features 22–25
description: Event bus, architecture overview, migration safety, deployment readiness, and load simulation — all implemented and live.
---

## Feature 22 — Full System Architecture
- `src/lib/event-bus.ts`: `ApertiBus` extends EventEmitter; `emit_event()` persists to `domain_events` table; `on_event()` for typed subscriptions. Built-in handlers for `fraud.detected` (critical → system_validation_errors) and `transaction.created` (usage tracking).
- `src/routes/architecture.ts`: GET `/api/architecture/status` (layer health + runtime stats), GET `/api/architecture/events` (domain event log), GET `/api/architecture/layers`.
- Admin page: `/admin/architecture` — 8-layer diagram with responsibilities/prohibitions, design principles, live domain event feed.

## Feature 23 — Migration Safety
- `src/routes/migration-safety.ts`: GET `/api/migration-safety/status` (schema score, critical tables, index checks), GET `/api/migration-safety/validate` (6 data-integrity checks), POST `/api/migration-safety/checkpoint` (persists snapshot as domain event).
- Admin page: `/admin/migration-safety` — schema score gauge, validation check list, immutable financial tables, index coverage.

## Feature 24 — Deployment Pipeline
- `src/routes/deployment-readiness.ts`: GET `/api/deployment/readiness` (12 checks across infra/security/ai/payments/monitoring), GET `/api/deployment/environments` (dev/staging/prod definitions).
- Admin page: `/admin/deployment-pipeline` — readiness score, blocking vs warning checks, deployment flow steps, rollback rule, environment cards.

## Feature 25 — Load & Failure Simulation
- `src/routes/load-simulation.ts`: POST `/api/load-sim/run` (scenarios: payment_stress, fraud_stress, dashboard_load, ai_stress, failure_db, failure_ai, full_suite), GET `/api/load-sim/history`, GET `/api/load-sim/metrics`.
- Admin page: `/admin/load-simulation` — scenario selector, iteration count, real-time results with p50/p95/p99, simulation history, graceful degradation rules panel.

## DB
- `domain_events` table created via `psql "$DATABASE_URL"` AND added to `migrate.ts` before Features 18–21 block.
- Indexes: `idx_domain_events_type`, `idx_domain_events_actor`, `idx_domain_events_corr`.

## Route registration pattern (critical)
- ALL imports MUST go at the TOP of `routes/index.ts` before `const router = Router()`.
- NEVER add `import` statements mid-file inline with `router.use()` calls — TypeScript/esbuild rejects it silently or orders wrong.

**Why:** The inline import pattern was the main bug from this session — it compiled but caused undefined router references at runtime.

**How to apply:** When adding new routers to `routes/index.ts`, always add the `import` near line 120–135 (the import block) and the `router.use()` near the bottom.
