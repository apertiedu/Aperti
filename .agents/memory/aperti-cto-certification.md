---
name: Aperti CTO Production Certification
description: Infrastructure audit findings, 8 launch blockers, and key architectural facts discovered during CTO cert (June 2026)
---

## Verdict: NO-GO (44/100)

Full report: `docs/CTO_PRODUCTION_CERTIFICATION.md`

## 8 Active Launch Blockers

1. **NODE_ENV = "development"** hardcoded in `.replit[userenv.shared]` — must be set as a Replit Secret with value "production"
2. **JWT_SECRET not set** — falls back to SESSION_SECRET; both auth systems share one secret
3. **No SMTP** — SMTP_HOST/USER/PASS not configured; password resets console-log only
4. **Uploads on ephemeral local disk** — `process.cwd()/uploads`; all files lost on every deploy (no S3/R2/GCS)
5. **Backups on ephemeral local disk** — `process.cwd()/backups`; zero backup durability; 0 rows in backup_logs
6. **No Redis (REDIS_URL not set)** — rate limiting is in-memory per-instance; ineffective on autoscale
7. **VAPID_PRIVATE_KEY not set** — ephemeral VAPID keys generated on each restart; all push subscriptions break
8. **Session table was missing** — created via psql in this session; connect-pg-simple now works

## Key Architectural Facts

- DB pool: `max: 25, idleTimeout: 10s, connectionTimeout: 3s, statement_timeout: 30s` in `lib/db/src/index.ts`
- Session store: Redis (ConnectRedisStore) when REDIS_URL set → PostgreSQL (connect-pg-simple, `session` table) when not → MemoryStore fallback
- Redis client: `lib/redis-client.ts` — graceful null when REDIS_URL absent; all rate limiters fall back to in-memory
- Backup scheduler: `artifacts/api-server/src/lib/backup-scheduler.ts` — daily 02:00 UTC node-cron; writes to local disk only
- Prometheus `/api/metrics`: returns 401 when METRICS_TOKEN not set (correctly blocked, not open)
- VAPID_PUBLIC_KEY stored in `.replit[userenv.shared]` (committed); VAPID_SUBJECT set to wrong domain `aperti.app` (should be `aperti.ai`)
- `packages/` directory does NOT exist — DB package is at `lib/db/src/`
- App version is "0.0.0" — no semantic versioning yet
- Deployment: Replit Autoscale with `run = ["node", "artifacts/api-server/dist/index.mjs"]`; no dist/ built yet
- No CI/CD pipeline (no .github/workflows/)
- DB: PostgreSQL 16.10, max_connections=112, shared_buffers=128MB (too low), log_min_duration_statement=-1 (slow query log off)
- 234 tables, 481 indexes, all tables have at least one index, pg_trgm + pg_stat_statements installed

## Fixes Applied in This Session

- Created `session` table via psql (LB-08 resolved)
- Added `contactLimiter` (5 req/hour/IP) to `POST /api/contact`
