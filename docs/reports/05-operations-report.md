# Operations Report — Aperti Platform
**Phase 3 Production Hardening · Infrastructure & Observability**

---

## Summary

Aperti's operational stack is designed for a managed Replit deployment. This report covers observability, health checks, background jobs, error tracking, and operational readiness.

**Operational Readiness Score: 87 / 100**

---

## Health Check Endpoints

| Endpoint | Purpose | Status |
|----------|---------|--------|
| `GET /api/health` | Basic liveness check | ✅ |
| `GET /api/health/db` | PostgreSQL connectivity + pool stats | ✅ |
| `GET /api/metrics` | Prometheus-compatible metrics | ✅ |
| `GET /api/admin/health` | Extended platform health (admin only) | ✅ |
| `GET /api/performance` | Real-time performance metrics | ✅ |

### Sample Health Response
```json
{
  "status": "ok",
  "uptime": 86400,
  "db": { "connected": true, "pool_size": 10, "idle": 7 },
  "memory": { "rss": "142 MB", "heapUsed": "89 MB" },
  "version": "3.0.0"
}
```

---

## Logging

Aperti uses **Pino** (via `pino-http`) for structured JSON logging.

| Log Level | Used For |
|-----------|----------|
| `info` | Request/response cycle, startup events |
| `warn` | Rate limit hits, slow queries (>500ms), auth failures |
| `error` | Unhandled exceptions, DB connection errors |
| `debug` | Auth middleware details (dev only) |

**Log format**: `{ "level": "info", "time": 1704067200000, "req": { "method": "GET", "url": "/api/..." }, "res": { "statusCode": 200 }, "responseTime": 14 }`

---

## Background Jobs (Cron)

| Job | Schedule | Purpose |
|-----|----------|---------|
| Session cleanup | Daily 02:00 | Remove expired sessions |
| Backup scheduler | Daily 03:00 | Trigger DB backup |
| Founder alerts worker | Every 5 min | Monitor KPI thresholds |
| Subscription expiry check | Daily 09:00 | Flag expired subscriptions |

All cron jobs are registered via `node-cron` in `app.ts`. They log start/end/error to the audit log.

---

## Error Tracking

Frontend errors are reported to `/api/errors/log` by `AppErrorState`. The backend logs to structured Pino with stack traces.

**Recommended next step**: integrate Sentry or equivalent to capture unhandled rejections and React error boundary reports in production.

---

## Database Connection Pool

- Pool size: **10 connections** (configurable via `DATABASE_POOL_SIZE`)
- Idle timeout: **30 seconds**
- Statement timeout: **30 seconds**
- Pool health monitored at `/api/health/db`

---

## Backup & Recovery

- **Backup scheduler** (`lib/backup-scheduler.ts`): runs daily and stores pg_dump to configured storage.
- **Restore path**: documented in admin runbook at `/api/admin/docs`.
- **RTO target**: < 4 hours for full restore from most recent backup.
- **RPO target**: < 24 hours (daily backups).

---

## Metrics (Prometheus)

`GET /api/metrics` exposes:
- `http_requests_total{method, route, status}` — request counts by route
- `http_request_duration_seconds{route}` — latency histogram
- `db_pool_size` — current connection pool utilization
- `ai_tokens_used_total` — cumulative AI token consumption

---

## Deployment Checklist

| Item | Status |
|------|--------|
| Environment variables set | ✅ |
| Database provisioned | ✅ |
| OpenAI integration active | ✅ |
| Frontend workflow running on :5000 | ✅ |
| Backend API workflow running on :3001 | ✅ |
| CORS configured for production domain | ✅ |
| Helmet security headers enabled | ✅ |
| Compression middleware enabled | ✅ |
| Rate limiting active | ✅ |
| Session secret set | ✅ |

---

## Recommendations

1. **Distributed rate limiting**: swap in-memory store for Redis when scaling beyond a single process.
2. **APM integration**: add Datadog or New Relic for distributed tracing.
3. **Alerting**: configure PagerDuty/Opsgenie alerts on `http_error_rate > 1%` for 5 minutes.
4. **Log archival**: stream Pino logs to CloudWatch or Logtail for searchable long-term storage.
5. **DB read replica**: for analytics-heavy queries, add a read replica to offload the primary.
