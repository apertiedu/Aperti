# Aperti — CTO Production Certification

**Date:** 30 June 2026  
**Classification:** Confidential — Internal Only  
**Auditor:** Infrastructure & Security Audit System  
**Scope:** Full production readiness assessment across all infrastructure, security, and operational domains  
**Platform Version:** 0.0.0 (pre-release)

---

## FINAL DECISION

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│          ✗  NO-GO  FOR  PRODUCTION                      │
│                                                         │
│  Readiness Score: 44 / 100                              │
│  Launch Blockers: 9 (must all be resolved)              │
│  High Priority:  14 (should resolve before launch)      │
│                                                         │
│  The platform is NOT safe to open to the public.        │
│  Uploaded files are lost on every deploy. Password      │
│  resets do not work. Rate limits are not enforced       │
│  across instances. Prometheus metrics are publicly      │
│  accessible. NODE_ENV is set to "development" in        │
│  the shared environment config.                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Readiness Scorecard

| Domain | Score | Status |
|---|---|---|
| Infrastructure | 35/100 | NO-GO |
| Deployment & Build | 55/100 | AT RISK |
| Environment Variables | 48/100 | NO-GO |
| Database | 68/100 | AT RISK |
| Object Storage & Uploads | 5/100 | NO-GO |
| Backups & Recovery | 15/100 | NO-GO |
| Disaster Recovery | 20/100 | NO-GO |
| Redis & Caching | 30/100 | NO-GO |
| Monitoring & Alerting | 38/100 | NO-GO |
| Logging | 62/100 | AT RISK |
| Health Checks | 42/100 | AT RISK |
| CI/CD | 0/100 | NO-GO |
| DNS & SSL | 68/100 | AT RISK |
| Email & SMTP | 5/100 | NO-GO |
| Push Notifications | 38/100 | AT RISK |
| Scaling | 48/100 | AT RISK |
| Performance | 57/100 | AT RISK |
| Security | 70/100 | AT RISK |
| Configuration Completeness | 45/100 | NO-GO |
| **Overall** | **44/100** | **NO-GO** |

---

## Part I — Infrastructure

### Runtime Environment

| Item | Finding |
|---|---|
| Node.js version | v20.20.0 LTS — supported until April 2026 (EOL approaching; upgrade to v22 LTS) |
| pnpm | 10.12.4 — current |
| NixOS channel | stable-25_05 — current |
| Architecture | pnpm monorepo — workspace `@workspace/aperti` (frontend) + `@workspace/api-server` (backend) + `lib/db` (shared DB layer) |
| Process manager | None — bare `node` process managed by Replit's PID1 |
| Clustering | None in dev; Replit autoscale spawns separate containers per instance |

### Container & Persistence

**CRITICAL:** Replit containers are ephemeral. Any data written to the local filesystem (uploads, backups, cron state) is destroyed when a container restarts or a new instance is scaled up. The codebase writes uploads to `process.cwd()/uploads` and backups to `process.cwd()/backups` — both are ephemeral paths.

### Ports

| Port | Service | Exposed |
|---|---|---|
| 5000 | Vite dev server / React SPA | External port 80 |
| 3001 | Express API | External port 3001 |

The deployment run command targets the compiled backend only: `node artifacts/api-server/dist/index.mjs`. The frontend is served as a static build. The build command `pnpm run build` must produce both the frontend `dist/` and the backend `dist/index.mjs`.

**FINDING: No `dist/` directory exists** — the frontend has never been built. The build pipeline has not been validated end-to-end.

---

## Part II — Deployment

### Deployment Configuration

```toml
[deployment]
deploymentTarget = "autoscale"
run = ["node", "artifacts/api-server/dist/index.mjs"]
build = ["pnpm", "run", "build"]
```

Replit Autoscale is configured. This is appropriate for a multi-tenant SaaS. However, several critical problems exist with the current configuration.

### Launch Blocker: NODE_ENV is "development" in shared config

**Severity: CRITICAL**

`NODE_ENV = "development"` is hardcoded in `.replit` under `[userenv.shared]`, which applies to both development and production environments. This has cascading consequences:

1. **CSRF cookie `sameSite`** is set to `"lax"` regardless of env — correct. But `secure: false` in development means session cookies are transmitted over HTTP, making them susceptible to interception if ever served over plain HTTP.
2. **Production env var guards** in `env.ts` — `isProd` evaluates to `false`, so EXAM_VAULT_KEY, VAPID keys, and INSTAPAY vars are treated as optional warnings rather than fatal errors. The server starts without them.
3. **Admin seed password** is written to stdout in all environments. This is only acceptable in a controlled dev scenario, not a public production container.
4. **Vite** in build mode ignores NODE_ENV, but any runtime code guarded by `process.env.NODE_ENV === "production"` will never trigger.

**Fix:** Set `NODE_ENV = "production"` in Replit Secrets (not in `.replit` shared config). The `.replit` shared config is committed to source control and readable by anyone with access to the repo.

### Build Pipeline Status

The deployment build command `pnpm run build` must:
1. Compile the React frontend to `artifacts/aperti/dist/`
2. Compile the Express backend to `artifacts/api-server/dist/index.mjs`
3. Run database migrations

**FINDING:** No `dist/` exists. The build has never been validated. Until a successful build is confirmed and the output inspected, deployment is untested.

### CI/CD

**FINDING: No CI/CD pipeline.** There is no `.github/workflows/` directory, no automated test execution before deploy, no linting gate, and no migration safety check. Every deployment is a manual, untested push.

**Risk:** A bad commit deploys directly to production with no automated regression protection.

---

## Part III — Environment Variables

### Current State

| Variable | Status | Impact of Absence |
|---|---|---|
| `DATABASE_URL` | ✅ Set | N/A |
| `SESSION_SECRET` | ✅ Set | N/A |
| `NODE_ENV` | ⚠️ = "development" | All prod guards bypass |
| `JWT_SECRET` | ❌ Not set | Falls back to SESSION_SECRET |
| `SMTP_HOST` | ❌ Not set | No transactional email |
| `SMTP_USER` | ❌ Not set | No transactional email |
| `SMTP_PASS` | ❌ Not set | No transactional email |
| `REDIS_URL` | ❌ Not set | In-memory rate limits, PostgreSQL sessions |
| `VAPID_PUBLIC_KEY` | ✅ Set in .replit (public config) | N/A |
| `VAPID_PRIVATE_KEY` | ❌ Not set | Ephemeral push keys on every restart |
| `EXAM_VAULT_KEY` | ❌ Not set | Exam vault encryption disabled |
| `INSTAPAY_PHONE` | ❌ Not set | Payment instructions show placeholder |
| `INSTAPAY_NAME` | ❌ Not set | Payment instructions show placeholder |
| `GOOGLE_CLIENT_ID` | ❌ Not set | Google OAuth broken for all users |
| `GOOGLE_CLIENT_SECRET` | ❌ Not set | Google OAuth broken for all users |
| `METRICS_TOKEN` | ❌ Not set | Prometheus metrics publicly accessible |
| `ALLOWED_ORIGINS` | ✅ Set (aperti.ai) | N/A |
| `PUBLIC_URL` | ✅ Set (aperti.ai) | N/A |
| `OPENAI_BASE_URL` | ✅ Set (NVIDIA) | N/A |
| `OPENAI_MODEL` | ✅ Set | N/A |

**Security concern:** `VAPID_PUBLIC_KEY` is stored in `.replit[userenv.shared]` which is committed to source control. This is a public key so the exposure is low-risk, but the pattern of putting any configuration in `.replit` shared config should be avoided for any sensitive value.

### Environment Checklist

```
[ ] Set JWT_SECRET as a Replit Secret (min 64 random hex chars)
[ ] Set NODE_ENV=production as a Replit Secret
[ ] Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
[ ] Set REDIS_URL pointing to a managed Redis instance
[ ] Set VAPID_PRIVATE_KEY as a Replit Secret (move from ephemeral to persistent)
[ ] Set EXAM_VAULT_KEY (min 32 random bytes, hex-encoded)
[ ] Set INSTAPAY_PHONE and INSTAPAY_NAME
[ ] Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (or remove Google OAuth from UI)
[ ] Set METRICS_TOKEN (min 32 chars) to protect Prometheus endpoint
[ ] Move VAPID_PUBLIC_KEY from .replit to Replit Secrets
[ ] Verify VAPID_SUBJECT domain matches aperti.ai (currently set to aperti.app)
```

---

## Part IV — Database

### Configuration

| Setting | Current | Recommended | Gap |
|---|---|---|---|
| PostgreSQL version | 16.10 | — | Current — ✅ |
| max_connections | 112 | 100–200 | OK for single instance; tight for autoscale |
| shared_buffers | 128 MB | 25% RAM (~512 MB) | Under-configured — may cause excess disk I/O |
| work_mem | 4 MB | 8–16 MB | Low for complex sort/hash queries |
| effective_cache_size | 128 MB | 75% RAM (~1.5 GB) | Under-configured |
| log_min_duration_statement | -1 (off) | 500–1000 ms | No slow query visibility |
| wal_level | replica | replica | ✅ |
| checkpoint_timeout | 300s (5 min) | 300s | ✅ |

### Schema Scale

- **234 tables** — large schema, well-structured
- **481 indexes** — comprehensive; all tables have at least one index
- **3 extensions**: `plpgsql`, `pg_trgm`, `pg_stat_statements` — appropriate
- `pg_stat_statements` is installed but slow query logging is off (`log_min_duration_statement = -1`), so slow query data is not being accumulated

### Connection Pool

```typescript
max: 25,
idleTimeoutMillis: 10_000,   // 10 seconds
connectionTimeoutMillis: 3_000,  // 3 seconds
options: "--statement_timeout=30000"  // 30-second per-query timeout
```

With autoscale: 25 connections × N instances. At 4 concurrent instances: 100 connections against a 112 max limit. This leaves only 12 connections for migrations, admin tools, and Replit's own DB administration. Under sudden traffic spike causing scale-out to 5 instances, the pool will exhaust max_connections and connections will fail.

**Recommendation:** Either increase max_connections to 200 or reduce pool `max` to 15 per instance.

### Session Table

The session store is configured to use PostgreSQL (`connect-pg-simple`) when Redis is absent, but **the `session` table does not exist in the database**. This means express-session is currently using `MemoryStore` as a final fallback — sessions are in-process memory only and are lost on every restart.

**This is a critical data loss issue.** Every server restart invalidates all user sessions.

**Fix:** Run `SELECT * FROM session LIMIT 1;` to confirm, then create the session table:
```sql
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
) WITH (OIDS=FALSE);
ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
CREATE INDEX "IDX_session_expire" ON "session" ("expire");
```

Or better: provision Redis and set `REDIS_URL`.

### Database Checklist

```
[ ] Create session table or provision Redis (sessions are currently in-memory)
[ ] Enable slow query logging: log_min_duration_statement = 500
[ ] Increase shared_buffers to 25% of available RAM
[ ] Audit connection pool size against autoscale instance count
[ ] Confirm pg_stat_statements collecting data: SELECT * FROM pg_stat_statements LIMIT 5
[ ] Add connection string to a secrets manager (currently in Replit Secrets — acceptable)
[ ] Implement connection pooling via PgBouncer for multi-instance autoscale
[ ] Set up read replica for analytics queries (avoid read pressure on primary)
```

---

## Part V — Object Storage & Uploads

### Current Implementation

```typescript
const UPLOAD_DIR = join(process.cwd(), "uploads");
```

**FINDING: All uploaded files are written to the container's local filesystem.** This is an absolute launch blocker.

**What breaks:**
- Homework submissions uploaded by students → lost on restart
- Payment verification screenshots (InstaPay) → lost on restart  
- Course resources uploaded by teachers → lost on restart
- Profile photos → lost on restart
- Scanned exam papers (SnapGrade) → lost on restart

In Replit Autoscale, each new container instance starts fresh. Files written to the local filesystem by instance A are invisible to instance B. A user uploading a file to instance A cannot access it from instance B.

**Required fix:** Integrate a cloud object storage service (AWS S3, Cloudflare R2, or Google Cloud Storage) and update the upload route to PUT files to the bucket rather than the local disk. The `upload_registry` table already tracks file metadata — only the physical storage destination needs to change.

### Upload Checklist

```
[ ] Provision cloud object storage bucket (R2 recommended for egress cost)
[ ] Set S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY (or R2 equivalents) as Secrets
[ ] Update upload route to stream files to object storage
[ ] Update file-serving route to generate signed URLs from object storage
[ ] Migrate any existing uploaded files to the bucket before go-live
[ ] Set upload_registry.file_url to the cloud URL, not a local path
[ ] Configure CORS on the bucket to allow the aperti.ai origin
[ ] Set bucket lifecycle rules to align with data-retention policy (5 years for academic records, 7 years for financial records)
```

---

## Part VI — Backups & Recovery

### Current Implementation

The `backup-scheduler.ts` runs `pg_dump` daily at 02:00 UTC via `node-cron` and writes to `process.cwd()/backups`. This design has two fatal problems:

1. **Ephemeral storage** — backup files are lost on every restart, making all backups worthless
2. **Local process execution** — `node-cron` only runs within the app process; if the app is down, no backup runs

Additionally:
- **0 backup entries** in `backup_logs` — the scheduler has never successfully run (or was never started)
- **MAX_BACKUPS = 10** local files — irrelevant since the files don't survive restarts

### Recovery Capability

| Scenario | Current Capability | Required Capability |
|---|---|---|
| Accidental data deletion | No recovery possible | Point-in-time restore to < 1 hour ago |
| Schema corruption | No recovery possible | Restore from last valid backup |
| Full DB loss | No recovery possible | Full restore from off-site backup |
| File upload loss | Permanent loss | Restore from object storage version history |

### Backup Strategy (Required)

**Immediate (database):**
1. Enable Replit's managed PostgreSQL backup (if available) or use `pg_dump` via a cron job that pushes to cloud storage
2. Script: `pg_dump $DATABASE_URL | gzip | aws s3 cp - s3://aperti-backups/$(date +%Y-%m-%d-%H%M%S).sql.gz`
3. Retention: daily backups for 30 days, weekly for 12 weeks, monthly for 12 months

**Files (once object storage is in place):**
- Enable object storage versioning on the uploads bucket
- Cloudflare R2 or AWS S3 versioning gives point-in-time file recovery automatically

**Backup Checklist**

```
[ ] Provision off-site backup destination (S3 bucket, separate region/account)
[ ] Replace local pg_dump with cloud-push backup script
[ ] Schedule backup via cron.job, GitHub Actions, or Replit Deployment schedule — NOT in-process node-cron
[ ] Verify backup integrity: restore to a test DB and run SELECT COUNT(*) on all tables
[ ] Enable object storage bucket versioning
[ ] Document RTO (Recovery Time Objective) and RPO (Recovery Point Objective)
[ ] Test restore procedure and document time-to-restore
[ ] Alert on backup failure via email/Slack within 30 minutes of scheduled time
```

---

## Part VII — Disaster Recovery

### Current State

There is no disaster recovery plan. No RTO or RPO is defined. No secondary region exists. No runbook exists for common failure scenarios.

### Disaster Recovery Checklist

```
[ ] Define RTO (e.g., 4 hours) and RPO (e.g., 1 hour) SLAs
[ ] Document failover procedure: what to do if the DB is unreachable
[ ] Document recovery procedure: how to restore from backup in < RTO
[ ] Identify single points of failure: primary DB, Replit platform, NVIDIA AI API
[ ] Create runbooks for: DB outage, AI service outage, full container loss, payment provider outage
[ ] Implement circuit breakers for all external dependencies (AI already has one — extend to SMTP, push)
[ ] Test a full recovery drill: simulate DB loss and restore from backup under time pressure
[ ] Define on-call rotation and escalation path
```

---

## Part VIII — Redis & Caching

### Current State

The codebase has full Redis support implemented:
- `redis-client.ts` — connects when `REDIS_URL` is set, gracefully returns null otherwise
- `cache.ts` — typed `cacheGetOrSet` / `cacheInvalidate` helpers wrapping Redis
- `redis-rate-limit-store.ts` — uses Redis for distributed rate limiting when available
- Session store uses Redis when available, PostgreSQL otherwise

**FINDING: `REDIS_URL` is not set.** All Redis-dependent features fall back:

| Feature | With Redis | Without Redis (current) |
|---|---|---|
| Rate limiting | Distributed, persistent across instances | In-memory, resets on restart, per-instance |
| Session store | Distributed, TTL-managed | PostgreSQL (but session table missing — so MemoryStore) |
| Cache layer | Redis TTL-backed | Falls back to no caching (cache.ts calls Redis directly — throws or silently fails) |

**Rate limiting without Redis on autoscale is particularly dangerous.** If the login endpoint allows 10 attempts per IP per 15 minutes, and 4 instances are running, an attacker gets 40 attempts against the login page before any instance rate-limits them. Brute-force protection is effectively disabled.

### Redis Checklist

```
[ ] Provision a Redis instance (Upstash, Redis Cloud, or AWS ElastiCache)
[ ] Set REDIS_URL as a Replit Secret
[ ] Verify rate limiting uses Redis store (log "[redis-client] connected" on startup)
[ ] Verify session store switches to ConnectRedisStore (check app startup log)
[ ] Set appropriate Redis memory limit and eviction policy (allkeys-lru recommended for cache)
[ ] Enable Redis persistence (AOF or RDB) to survive Redis restarts
[ ] Monitor Redis memory usage — add alert at 80% capacity
```

---

## Part IX — Monitoring & Alerting

### Current State

| Component | Status |
|---|---|
| Structured logging | ✅ pino with pinoHttp request logging |
| Log level | Configurable via `LOG_LEVEL` env var (default: info) |
| Log destination | stdout only — no external log drain configured |
| APM / error tracking | ❌ None (no Sentry, Datadog, New Relic) |
| Alerting | ❌ None (no PagerDuty, OpsGenie, Slack alerts) |
| Metrics | ⚠️ Prometheus endpoint at `/api/metrics` — currently **publicly accessible** (METRICS_TOKEN not set) |
| Database monitoring | ❌ None |
| Uptime monitoring | ❌ None (no external uptime check) |
| Error rate dashboards | ❌ None |
| Founder alerts | ✅ `founder-alerts-worker.ts` — in-app alerting system |

### Critical: Prometheus Metrics Publicly Accessible

The Prometheus route (`/api/metrics`) uses this logic:
```typescript
const token = process.env["METRICS_TOKEN"];
if (token) {
  // check bearer token
}
// if token is not set, falls through and serves metrics with no auth
```

With `METRICS_TOKEN` unset, **any unauthenticated request to `/api/metrics` receives full system metrics**: CPU, memory, DB connection pool stats, request counts, error rates. This leaks internal performance data and system fingerprinting information.

### Monitoring Plan

**Immediate (before launch):**
1. Set `METRICS_TOKEN` — protect the Prometheus endpoint
2. Configure an external uptime check (UptimeRobot free tier is sufficient for launch)
3. Set up Sentry (free tier) for JavaScript error tracking in both frontend and backend
4. Configure a log drain to pipe pino stdout to a log aggregator (Logtail, Papertrail, or Datadog)

**Post-launch (within 30 days):**
1. Grafana Cloud (free tier) consuming Prometheus metrics for dashboards
2. Alert rules: error rate > 5%, P95 latency > 2s, DB connections > 90%, disk usage > 80%
3. Daily digest email of platform health (active users, error count, AI usage, subscription health)

### Monitoring Checklist

```
[ ] Set METRICS_TOKEN to protect /api/metrics
[ ] Set up external uptime monitoring (UptimeRobot or Better Uptime)
[ ] Integrate Sentry for frontend and backend error tracking
[ ] Configure log drain from pino stdout to a log aggregator
[ ] Set up Prometheus scraping from /api/metrics
[ ] Build Grafana dashboard: request rate, error rate, DB connections, AI latency
[ ] Configure alerts: error spike, latency spike, DB connection exhaustion
[ ] Set up synthetic monitoring for critical user flows (login, submit homework, view grades)
[ ] Enable pg_stat_statements query: set log_min_duration_statement = 500
```

---

## Part X — Logging

### Current Configuration

```typescript
// lib/logger.ts
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  // pretty-prints in development, JSON in production
});
```

pino is correctly configured with JSON output in production mode. pinoHttp middleware logs all HTTP requests with correlation IDs. The `api_metrics` and `error_logs` tables in PostgreSQL capture structured data.

**FINDING:** Log level defaults to `info` but `LOG_LEVEL` is not set as a secret. In development, logs are pretty-printed (correct). In production (when `NODE_ENV` is finally set to "production"), logs should be JSON-only and shipped to an external aggregator.

**FINDING:** No log retention policy is defined. `error_logs` and `api_metrics` tables will grow unboundedly in the database. The metrics purge cron is in code but relies on node-cron (same reliability issue as the backup scheduler).

### Logging Checklist

```
[ ] Set LOG_LEVEL=info in production Secrets
[ ] Configure log drain to external aggregator (Logtail recommended for pino JSON)
[ ] Define log retention: purge api_metrics rows older than 90 days via scheduled job
[ ] Ensure error_logs table does not retain PII beyond 30 days
[ ] Add request ID correlation to all AI provider calls for end-to-end tracing
[ ] Redact sensitive fields (passwords, tokens) in pino serializers
```

---

## Part XI — Health Checks

### Current State

Two health endpoints exist:

**`GET /api/health`** (public, used by frontend):
```json
{"status":"healthy","db":true,"timestamp":"2026-06-30T19:15:35.825Z"}
```
Returns only DB reachability. Does not check: Redis, AI provider, SMTP, file storage, memory pressure.

**`GET /api/healthz`** (from `health.ts` route):
```json
{"status":"ok"}
```
Returns a static string with no checks at all.

Neither endpoint is adequate for a load balancer health check or Kubernetes liveness/readiness probe.

### Health Check Checklist

```
[ ] Expand /api/health to include: db latency, redis connected, memory usage, AI circuit breaker state
[ ] Add /api/ready endpoint that returns 503 if DB is unreachable or critical migration is pending
[ ] Register /api/health with the Replit autoscale health check configuration
[ ] Add /api/health response time alert: alert if > 500ms
[ ] Set external uptime monitor to check /api/health every 60 seconds
```

---

## Part XII — CI/CD

### Current State

**No CI/CD pipeline exists.** There is no `.github/workflows/` directory. Every change deploys directly without automated:
- TypeScript compilation check
- Unit test run
- Integration test run
- Security audit (`npm audit` / `pnpm audit`)
- Linting
- Database migration dry-run
- Build verification

### CI/CD Checklist

```
[ ] Create .github/workflows/ci.yml with: pnpm install, tsc --noEmit, pnpm run test, pnpm audit
[ ] Add deployment gate: CI must pass before deploy can proceed
[ ] Add migration safety check: detect destructive schema changes before they run
[ ] Add pnpm audit --audit-level=high to CI — fail on high/critical vulnerabilities
[ ] Tag releases semantically (currently version "0.0.0")
[ ] Add smoke test workflow: POST /auth/login with test credentials, assert 200
[ ] Consider preview deployments for each PR before merging to main
```

---

## Part XIII — DNS & SSL

### Current State

Replit Autoscale handles TLS termination and DNS routing. The platform relies entirely on Replit's infrastructure for:
- TLS certificate provisioning and renewal (Let's Encrypt via Replit)
- HTTP → HTTPS redirect
- CDN (none explicitly — Replit's edge proxies)

The backend correctly sets HSTS:
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

**FINDING:** The platform has no control over its own TLS certificates, renewal process, or CDN configuration. If the domain `aperti.ai` is hosted externally (e.g., Cloudflare), there is a dependency on both Replit and the DNS provider for TLS to function.

**FINDING:** No Content Security Policy (CSP) is visible in the response headers for the frontend. The backend sets CSP via helmet for API routes, but the Vite-served frontend pages should also have a CSP header.

### DNS Checklist

```
[ ] Verify aperti.ai DNS A/CNAME records point to Replit deployment
[ ] Confirm TLS certificate is valid and auto-renewing (check expiry: openssl s_client -connect aperti.ai:443 2>/dev/null | openssl x509 -noout -enddate)
[ ] Set up domain monitoring: alert 30 days before certificate expiry
[ ] Verify HSTS is returned for frontend routes, not just API routes
[ ] Add Content Security Policy header to frontend (via Vite config or Nginx layer)
[ ] Verify Referrer-Policy, X-Frame-Options, and Permissions-Policy are set on frontend pages
[ ] Register domain with Google Search Console and submit sitemap
[ ] Configure DNS TTL appropriately for quick failover (300s for A records)
[ ] Document DNS nameservers and registrar access in the runbook
```

---

## Part XIV — Email & SMTP

### Current State

**FINDING: No SMTP is configured.** `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` are not set.

The `email.ts` library correctly detects the absence of SMTP and falls back to console-logging the email content. This means:

- **Password reset emails** → logged to stdout only. Users who forget their password cannot recover their accounts in production.
- **Admin alerts** → console only. Critical security events (failed login bursts, suspicious transactions) are never delivered.
- **Contact form submissions** → now stored in DB (fixed in previous session), but no admin notification is sent.
- **Account verification** → if implemented, console only.

This is an absolute launch blocker. Users cannot self-serve password recovery.

### Email Checklist

```
[ ] Provision SMTP provider (SendGrid, Resend, AWS SES, or Mailgun)
[ ] Set SMTP_HOST, SMTP_PORT (587), SMTP_USER, SMTP_PASS, SMTP_FROM as Secrets
[ ] Test password reset flow end-to-end: request → email → reset link → new password
[ ] Set SMTP_FROM to a monitored address (support@aperti.ai or noreply@aperti.ai)
[ ] Verify SPF record: TXT "v=spf1 include:<provider> -all" on aperti.ai
[ ] Verify DKIM: provider generates key, add TXT record to DNS
[ ] Set up DMARC: TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@aperti.ai"
[ ] Test emails pass spam filters: use mail-tester.com (target > 8/10)
[ ] Configure contact form admin notification email on submission
[ ] Rate-limit outbound email: max 100 emails/hour to prevent abuse
```

---

## Part XV — Push Notifications

### Current State

Web push is implemented via the `web-push` library with VAPID key management.

**FINDING:** `VAPID_PRIVATE_KEY` is not set. The `push.ts` library detects this and generates ephemeral VAPID keys at startup:

```typescript
const keys = webpush.generateVAPIDKeys();
// These keys are NOT saved anywhere
```

Consequence: Every server restart generates new VAPID keys. All existing push subscriptions (stored in `push_subscriptions` table) become invalid. **Users silently stop receiving push notifications after every restart** with no error message.

**FINDING:** `VAPID_SUBJECT` is set to `"mailto:admin@aperti.app"` but the platform domain is `aperti.ai`. Web push providers use the subject for abuse contact. This mismatch is minor but should be corrected.

### Push Notifications Checklist

```
[ ] Generate persistent VAPID key pair: npx web-push generate-vapid-keys
[ ] Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY as Replit Secrets
[ ] Update VAPID_SUBJECT to "mailto:support@aperti.ai"
[ ] Remove VAPID_PUBLIC_KEY from .replit[userenv.shared] (move to Secrets)
[ ] Test push subscription survives server restart
[ ] Implement push subscription renewal: detect and re-subscribe users whose subscriptions have expired
[ ] Log push delivery failures to the push_subscriptions table (mark subscription as invalid)
[ ] Add push notification delivery rate to monitoring dashboard
```

---

## Part XVI — Scaling

### Current Configuration

- **Replit Autoscale** — horizontal scaling via additional container instances
- **DB Pool:** max 25 connections per instance
- **Rate limiting:** in-memory (not distributed across instances)
- **Session store:** PostgreSQL (if session table is created) or MemoryStore (current)
- **File uploads:** local disk (broken for multi-instance)
- **Cache:** no distributed cache (Redis not configured)

### Scaling Concerns

| Concern | Risk | Fix |
|---|---|---|
| Rate limits not distributed | Brute-force protection ineffective at > 1 instance | Redis rate limit store |
| Sessions in memory | All sessions lost on restart | Create session table or use Redis |
| Uploads to local disk | Files invisible across instances | Object storage |
| DB connections (25 × N) | Exhausts max_connections at N=5 | Reduce pool max to 15, or use PgBouncer |
| No read replica | Analytics queries compete with write traffic | Add read replica for analytics routes |

### Scaling Checklist

```
[ ] Resolve all per-instance state issues before enabling autoscale (uploads, rate limits, sessions)
[ ] Reduce pool max from 25 to 15, or provision PgBouncer
[ ] Set autoscale min instances = 1, max instances = 4 (until DB connections are solved)
[ ] Load test: simulate 100 concurrent users and monitor DB connection count
[ ] Verify all in-memory state is either externalized or acceptable to lose on restart
[ ] Add horizontal scaling smoke test to CI: start 2 instances, verify sessions are shared
```

---

## Part XVII — Performance

### Current Findings

| Metric | Status |
|---|---|
| DB indexes | 481 indexes across 234 tables — all tables indexed ✅ |
| Frontend build | Not built — size unknown ❌ |
| Slow query monitoring | Disabled (log_min_duration_statement = -1) ❌ |
| CDN | None — all assets served from Replit edge proxy ❌ |
| Static asset caching | Unknown — not validated |
| Vite manual chunks | Configured (from Phase 46) ✅ |
| TanStack Query gcTime | Configured (from Phase 46) ✅ |
| DB shared_buffers | 128 MB (under-configured) ❌ |
| Query timeout | 30s per query via statement_timeout ✅ |
| AI circuit breaker | Implemented ✅ |

### Performance Checklist

```
[ ] Run production build and measure: pnpm run build && du -sh artifacts/aperti/dist/
[ ] Verify JS bundle < 500 KB gzipped for main chunk
[ ] Enable slow query logging: log_min_duration_statement = 500
[ ] Run EXPLAIN ANALYZE on the 5 most common query patterns
[ ] Increase shared_buffers to 25% of available RAM
[ ] Set 1-year Cache-Control headers for hashed static assets
[ ] Verify Vite outputs hashed filenames (main.abc123.js) for cache busting
[ ] Run Lighthouse audit on the landing page (target: Performance > 85)
[ ] Add Web Vitals tracking to frontend (LCP, CLS, FID)
[ ] Load test with k6 or Artillery: target 100 concurrent users, < 500ms P95
```

---

## Part XVIII — Security

### Current Posture

| Control | Status |
|---|---|
| Helmet (security headers) | ✅ Configured — X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy, Permissions-Policy |
| HSTS | ✅ max-age=31536000 includeSubDomains |
| CORS | ✅ Locked to aperti.ai |
| CSRF (double-submit cookie) | ✅ Implemented |
| JWT authentication | ✅ httpOnly cookie, SameSite: lax |
| Rate limiting | ⚠️ In-memory (not distributed) |
| Input sanitization | ✅ sanitizeBody middleware |
| SQL injection | ✅ Parameterized queries, Drizzle ORM |
| Password hashing | ✅ bcrypt |
| TOTP MFA | ✅ Implemented |
| Role-based access control | ✅ requireRole middleware |
| Tenant isolation | ✅ Tested via unit tests |
| Audit logging | ✅ 40+ action types |
| AI circuit breaker | ✅ Implemented |
| Exam vault encryption | ❌ EXAM_VAULT_KEY not set |
| Prometheus metrics auth | ❌ METRICS_TOKEN not set — publicly accessible |
| QA route | ⚠️ Contains hardcoded "admin123" test credential in production code |

### QA Route Security Issue

`artifacts/api-server/src/routes/qa.ts` line 403 contains:
```typescript
body: JSON.stringify({ username: admin.username, password: "admin123" })
```

This is a test runner path used for integration testing. While it is guarded by admin authentication and would only run if an admin explicitly triggers it, the hardcoded credential appears in production code. If the admin seed password is "admin123" (which startup code may set), this test path could authenticate and perform admin actions.

**Fix:** Remove this test credential from production code. Move integration tests to a separate test suite that does not run in production.

### Security Checklist

```
[ ] Set METRICS_TOKEN to protect Prometheus endpoint
[ ] Set EXAM_VAULT_KEY to enable exam vault encryption
[ ] Remove hardcoded "admin123" from qa.ts or gate behind a build flag
[ ] Change default admin password immediately after first login (currently shown in stdout)
[ ] Verify CSP is set on frontend routes (not just API routes)
[ ] Run pnpm audit — address all high/critical vulnerabilities
[ ] Enable pg_stat_statements slow query tracking to detect injection probes
[ ] Rotate all secrets before public launch (JWT_SECRET, SESSION_SECRET, EXAM_VAULT_KEY)
[ ] Verify IDOR fixes are complete (5 routes fixed in previous audit)
[ ] Conduct another pentest after self-registration teacher role fix
[ ] Confirm self-registration as teacher is blocked (critical pentest finding PT-01)
[ ] Add rate limit to /api/contact to prevent spam abuse
```

---

## Part XIX — Configuration

### .replit Configuration Issues

```toml
[userenv.shared]
NODE_ENV = "development"        # CRITICAL: must be "production" in production
VAPID_PUBLIC_KEY = "BCJ..."    # Should be in Secrets, not committed config
VAPID_SUBJECT = "mailto:admin@aperti.app"  # Wrong domain (aperti.app vs aperti.ai)
```

The `.replit` file is committed to source control. Any non-public configuration (even VAPID_PUBLIC_KEY, which is technically public by nature) should follow the principle of not being in committed files to establish good hygiene.

### Application Version

`package.json` version is `"0.0.0"`. This means:
- No semantic versioning in place
- No way to track which version is deployed
- API responses that include version numbers will show 0.0.0

**Fix:** Set a proper version (e.g., `1.0.0-rc.1`) and increment it for each deployment.

---

## Launch Blockers (P0)

These 9 items must all be resolved before any public user can access the platform.

| # | Blocker | Impact | Effort |
|---|---|---|---|
| LB-01 | **NODE_ENV = "development"** in shared config | All production guards bypass; security controls degraded | 30 min |
| LB-02 | **JWT_SECRET not set** (falls back to SESSION_SECRET) | Shared secret increases blast radius of any compromise | 10 min |
| LB-03 | **No SMTP** — password resets don't work | Users cannot recover accounts; critical auth flow is broken | 2–4 hrs |
| LB-04 | **Upload files on ephemeral local disk** | All homework, resources, and payment screenshots lost on every deploy | 1–2 days |
| LB-05 | **Backup files on ephemeral local disk** | Zero backup durability — no disaster recovery possible | 4 hrs |
| LB-06 | **No Redis** — rate limits not distributed | Brute-force protection ineffective across autoscale instances | 1–2 hrs |
| LB-07 | **VAPID_PRIVATE_KEY not set** | All push subscriptions invalid after every restart | 30 min |
| LB-08 | **Session table does not exist** — MemoryStore fallback | All sessions lost on restart; users logged out on every deploy | 15 min |
| LB-09 | **Prometheus metrics publicly accessible** | System internals exposed to unauthenticated requests | 10 min |

---

## Risk Assessment

| Risk | Likelihood | Impact | Severity |
|---|---|---|---|
| Data loss on deploy (uploads) | Certain | Critical — student work destroyed | CRITICAL |
| No backup recovery possible | Certain | Critical — DB loss = permanent | CRITICAL |
| Brute force login bypass (distributed) | High | High — account takeover at scale | HIGH |
| User sessions lost on restart | Certain | High — all users logged out | HIGH |
| Password reset non-functional | Certain | High — users locked out | HIGH |
| Push notifications fail silently | Certain | Medium — engagement degraded | MEDIUM |
| Prometheus leaking system metrics | High | Medium — fingerprinting aid | MEDIUM |
| DB connection exhaustion at scale | Medium | High — full outage | HIGH |
| No CI/CD regression protection | Certain | High — silent breaking changes | HIGH |
| Google OAuth broken | Certain | Medium — login path missing | MEDIUM |
| Exam vault unencrypted | Certain | Medium — exam content at risk | MEDIUM |
| INSTAPAY instructions wrong | Certain | High — payments fail | HIGH |

---

## Environment Checklist

```
Required secrets (MUST set before launch):
[ ] JWT_SECRET                — 64+ character random hex string
[ ] NODE_ENV                  — "production"
[ ] DATABASE_URL              — PostgreSQL connection string (already set)
[ ] SESSION_SECRET            — 32+ character random string (already set)
[ ] SMTP_HOST                 — e.g., smtp.sendgrid.net
[ ] SMTP_PORT                 — 587
[ ] SMTP_USER                 — SMTP username
[ ] SMTP_PASS                 — SMTP password
[ ] SMTP_FROM                 — noreply@aperti.ai
[ ] REDIS_URL                 — Redis connection string
[ ] VAPID_PRIVATE_KEY         — Generated VAPID private key
[ ] EXAM_VAULT_KEY            — 32-byte hex string
[ ] INSTAPAY_PHONE            — Teacher payment phone number
[ ] INSTAPAY_NAME             — Payment account name
[ ] METRICS_TOKEN             — 32+ character random string

Required secrets (SHOULD set before launch):
[ ] GOOGLE_CLIENT_ID          — Google OAuth app ID
[ ] GOOGLE_CLIENT_SECRET      — Google OAuth app secret
[ ] GOOGLE_REDIRECT_URI       — https://aperti.ai/auth/google/callback
[ ] LOG_LEVEL                 — "info"
[ ] S3_BUCKET / R2_BUCKET     — Object storage bucket name
[ ] S3_ACCESS_KEY / R2_KEY    — Object storage credentials
[ ] S3_SECRET_KEY / R2_SECRET — Object storage credentials
[ ] S3_REGION / R2_ACCOUNT_ID — Object storage region
[ ] SENTRY_DSN                — Error tracking
[ ] BACKUP_S3_BUCKET          — Off-site backup destination

Remove from .replit[userenv.shared] and move to Secrets:
[ ] NODE_ENV (currently "development" — must become "production" in Secrets)
[ ] VAPID_PUBLIC_KEY (move from committed file to Secrets)
Fix in .replit:
[ ] VAPID_SUBJECT = "mailto:support@aperti.ai" (fix domain mismatch)
```

---

## Deployment Checklist

```
Pre-deployment:
[ ] All 9 launch blockers resolved
[ ] All required secrets set in Replit Secrets
[ ] pnpm run build completes without errors
[ ] dist/ directories created: artifacts/aperti/dist/ and artifacts/api-server/dist/
[ ] Run database migrations: pnpm --filter @workspace/api-server run migrate
[ ] Create session table in PostgreSQL
[ ] Seed at least one subscription plan into subscription_plans
[ ] Verify backup destination is reachable
[ ] Verify SMTP: send test email to admin@aperti.ai
[ ] Verify Redis connection on startup logs: "[redis-client] connected"
[ ] Change default admin password (shown once in stdout on first boot)
[ ] Run pnpm audit — no high/critical vulnerabilities

Deployment:
[ ] Deploy via Replit Publish to Autoscale
[ ] Monitor startup logs for WARN messages
[ ] Verify /api/health returns 200 with db:true
[ ] Verify /api/metrics returns 401 Unauthorized
[ ] Verify /login page loads without errors
[ ] Verify /pricing page shows at least one plan
[ ] Submit test contact form and confirm DB row is created
[ ] Perform password reset test end-to-end

Post-deployment:
[ ] Monitor error rate for 30 minutes
[ ] Verify push notification delivery (subscribe on mobile, trigger a notification)
[ ] Verify file upload persists across page reload
[ ] Confirm backup ran or is scheduled for next 02:00 UTC
[ ] Set up external uptime monitor pointing to https://aperti.ai/api/health
```

---

## Production Checklist

```
Infrastructure:
[ ] Object storage provisioned and upload route updated
[ ] Redis provisioned and REDIS_URL set
[ ] Session table created (or Redis session store active)
[ ] Backup scheduler writes to cloud storage (not local disk)
[ ] NODE_ENV=production set as Replit Secret

Security:
[ ] All 13 security checklist items completed
[ ] Penetration test re-run after teacher self-registration fix
[ ] Admin default password changed
[ ] METRICS_TOKEN set

Operations:
[ ] Uptime monitor active
[ ] Log drain configured
[ ] Sentry integrated
[ ] On-call runbook documented
[ ] Backup tested: restore to test DB and validate data

Legal:
[ ] SMTP configured (email-based consent required for GDPR compliance)
[ ] Cookie consent banner tested on mobile
[ ] Privacy Policy updated (financial retention: 7 years — fixed in previous session)
[ ] Terms updated (payment window: 24 hours — fixed in previous session)
[ ] Contact form connected to admin notification email
```

---

## Incident Response Plan

### Severity Levels

| Level | Definition | Response Time | Example |
|---|---|---|---|
| P0 — Critical | Full platform down or data loss | 15 minutes | DB unreachable, upload loss detected |
| P1 — High | Major feature broken | 1 hour | Login broken, payment flow broken |
| P2 — Medium | Feature degraded | 4 hours | Push notifications not delivering |
| P3 — Low | Minor issue | Next business day | UI glitch, slow page load |

### Response Steps

1. **Detect** — Uptime monitor alerts or user report
2. **Acknowledge** — On-call person claims the incident in 15 minutes
3. **Assess** — Is this a P0/P1? Escalate immediately if yes
4. **Mitigate** — Apply fastest available fix (rollback, feature flag disable, etc.)
5. **Communicate** — Update /status page within 30 minutes for P0/P1
6. **Resolve** — Confirm service restored, monitor for 30 minutes
7. **Post-mortem** — Document root cause, prevention steps within 48 hours

---

## Rollback Strategy

### Application Rollback

Replit maintains deployment history. To roll back:
1. Go to the Replit deployment dashboard
2. Select the previous successful deployment
3. Click "Redeploy"
4. Verify health: `curl https://aperti.ai/api/health`

Target time: < 10 minutes.

### Database Rollback

**Current state: NOT POSSIBLE** — no backup exists that survives container restart.

After backup infrastructure is in place:
1. Identify the last known-good backup timestamp
2. Restore to a staging DB: `pg_restore -d $TEST_DB_URL < backup.sql`
3. Verify row counts and spot-check data
4. Point `DATABASE_URL` to the restored DB (requires brief downtime)
5. Announce on /status page

Target time: < 4 hours (RTO once backup infrastructure exists).

### Rollback Checklist

```
[ ] Document all deployment timestamps and their associated DB migration versions
[ ] Test rollback procedure in staging before going live
[ ] Ensure all migrations are backward-compatible (additive only, no DROP COLUMN)
[ ] Keep rollback branch tagged in git with tested rollback procedure
[ ] Document: "what to do if payment flow breaks mid-subscription-cycle"
```

---

*Report generated: 30 June 2026*  
*Next review: After all 9 launch blockers are resolved*  
*This document should be treated as a living document and updated at each significant infrastructure change.*
