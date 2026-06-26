# Operations Report — Aperti V2

> Generated: Phase 3 Production Hardening

## Observability Stack

| Layer | Tool | Coverage |
|-------|------|----------|
| Structured logging | Pino + pino-http | Every HTTP request |
| Metrics | Prometheus (`/metrics`) | HTTP duration, DB latency, AI calls, errors, cache |
| Request tracing | Correlation ID middleware | Every request (`X-Request-Id` header) |
| DB slow queries | `api_metrics` table (10% sample) | Endpoint, duration, status |
| Health checks | `/health`, `/api/health` | DB, storage, memory |
| Admin health | `/api/admin/health` | DB connections, CPU, memory, history |
| Real-time | Socket.io events | Parent notifications |

## Phase 3 Addition: Request Correlation IDs

Added `correlation-id` middleware (first in chain after trust proxy):
- Reads `X-Request-Id` or `X-Correlation-Id` from client if present (frontend-initiated traces)
- Generates `ap-{16-hex}` if not provided
- Propagates to response headers (`X-Request-Id`, `X-Correlation-Id`)
- Available on `req.correlationId` for all downstream middleware and route handlers
- Included in file download/access denied responses

## Structured Logging

Pino logger configuration:
- **Development:** pretty-printed with `pino-pretty`
- **Production:** JSON format for log aggregation (Datadog, Grafana Loki, etc.)
- All requests logged: method, URL (path only, no query params), status, duration
- Sensitive fields redacted from HTTP logs (Authorization, Cookie values)

## Health Check Detail

### `/health` (public, deployment platform)
```json
{
  "status": "healthy|degraded|critical",
  "checks": {
    "database": { "ok": true, "latencyMs": 12 },
    "storage":  { "ok": true, "registeredFiles": 847 },
    "memory":   { "ok": true, "usedMb": 245, "totalMb": 512 }
  },
  "uptime": 86400,
  "version": "ce4e76d"
}
```

### `/api/health` (public, lightweight)
```json
{ "status": "healthy", "db": true, "timestamp": "..." }
```

### `/api/admin/health` (admin-only, detailed)
- DB connection pool stats
- CPU load average
- Memory usage percentage
- Historical health log (100 entries)
- Backup log access

## Prometheus Metrics

| Metric | Type | Labels |
|--------|------|--------|
| `http_request_duration_seconds` | Histogram | method, route, status_code |
| `http_requests_total` | Counter | method, route, status_code |
| `db_query_duration_seconds` | Histogram | operation |
| `active_users_total` | Gauge | — |
| `ai_call_duration_seconds` | Histogram | provider, model |
| `cache_hit_rate_percent` | Gauge | — |
| `errors_total` | Counter | type |

## Error Tracking

- Global Express error handler catches all unhandled errors
- Frontend errors reported to `/api/errors` endpoint (public, rate-limited)
- AI API failures logged with provider, model, error type
- Brute-force login detection fires security alerts to admin accounts

## Background Jobs (node-cron)

| Job | Schedule | Purpose |
|-----|----------|---------|
| API metrics cleanup | 3:00 AM UTC | Purge `api_metrics` older than 30 days |
| System metrics cleanup | 3:00 AM UTC | Purge `system_metrics_log` older than 30 days |
| Backup scheduler | Configured | PostgreSQL backup |
| Founder alerts worker | On startup | Real-time operational alerts |

## Startup Sequence

1. `validateEnv()` — fail-fast on missing critical vars
2. `runMigrations()` — apply SQL migrations
3. `ensurePerformanceIndexes()` — verify/create DB indexes
4. Express app configured
5. Socket.io attached
6. Workers started (backup, alerts)

## Remaining Recommendations

| Item | Priority |
|------|----------|
| Attach `correlationId` to Pino log context via `pino-http` `genReqId` | High |
| Add distributed tracing (OpenTelemetry → Jaeger) for multi-service traces | Medium |
| Alert on `errors_total` threshold via Alertmanager | Medium |
| Expose `/readyz` endpoint separate from `/healthz` for K8s split probes | Low |
