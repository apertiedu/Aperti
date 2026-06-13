# Aperti Production Deployment Guide

Generated: 2026-06-13

## Architecture

```
[Client Browser]
      |
      | HTTPS (port 443)
      ↓
[Vite Frontend : port 5000]
      |
      | Proxy /api/* + /auth/* + /socket.io
      ↓
[Express API Server : port 3001]
      |
      ├── PostgreSQL (DATABASE_URL)
      ├── Redis (optional, falls back to in-memory)
      └── OpenAI API (optional, falls back to rule-based)
```

---

## Required Environment Variables

Set these in Replit Secrets (or your deployment provider's secret store):

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | **YES** | PostgreSQL connection string |
| `JWT_SECRET` | **YES** | Min 32 chars, strong random string |
| `SESSION_SECRET` | Recommended | Express session secret (falls back to JWT_SECRET) |
| `PORT` | **YES** | Frontend port (5000) |
| `API_PORT` | **YES** | Backend port (3001) |
| `BASE_PATH` | **YES** | URL base path (default: `/`) |
| `OPENAI_API_KEY` | Optional | OpenAI key; AI features degrade gracefully without it |
| `VAPID_PUBLIC_KEY` | Optional | Web Push public key |
| `VAPID_PRIVATE_KEY` | Optional | Web Push private key |
| `VAPID_SUBJECT` | Optional | Web Push subject (mailto:) |
| `APP_URL` | Optional | Full app URL for password reset emails |

---

## Build & Run

### Development
```bash
pnpm install
# Terminal 1 — Backend
cd artifacts/api-server && PORT=3001 pnpm run dev
# Terminal 2 — Frontend
cd artifacts/aperti && pnpm run dev
```

### Production Build
```bash
pnpm install
# Build everything
pnpm run build
# This builds:
#   artifacts/api-server/dist/index.mjs  (Express server)
#   artifacts/aperti/dist/public/        (Static React build)
```

### Production Start
```bash
# Start API server (serves both API and static frontend in production)
cd artifacts/api-server
PORT=3001 node --enable-source-maps ./dist/index.mjs
```

---

## Replit Deployment

1. Click **Deploy** in the Replit toolbar.
2. Set `run` command: `node artifacts/api-server/dist/index.mjs`
3. Set `build` command: `pnpm run build`
4. Ensure all required secrets are set in Replit Secrets panel.
5. Health check: `GET /api/health` — should return 200.

---

## Health Check

```bash
curl https://your-domain.repl.co/api/health
# Expected:
# { "status": "ok", "db": { "latencyMs": <n> }, "memory": {...} }
```

---

## Database Migrations

Migrations run automatically on server startup via `runMigrations()` in `index.ts`. The schema is also pushed via `lib/db/push-schema.ts` before the server starts accepting connections.

To run manually:
```bash
cd lib/db
pnpm exec tsx push-schema.ts
```

---

## PM2 (VPS deployment)

```javascript
// ecosystem.config.cjs
module.exports = {
  apps: [{
    name: "aperti-api",
    script: "artifacts/api-server/dist/index.mjs",
    env: {
      PORT: 3001,
      NODE_ENV: "production"
    },
    instances: 2,
    exec_mode: "cluster",
    max_memory_restart: "1G",
    error_file: "logs/error.log",
    out_file: "logs/out.log"
  }]
};
```

---

## Monitoring

- **Health endpoint**: `GET /api/health` — DB latency, memory usage, table count
- **AI health**: `GET /api/ai/health` — AI provider status
- **Metrics**: `GET /metrics` — Prometheus-format metrics (restrict to internal only)
- **Error logs**: Stored in `error_logs` table, visible in Admin > ShieldCore

---

## Security Checklist Before Going Live

- [ ] `JWT_SECRET` is at least 32 chars and unique
- [ ] `SESSION_SECRET` is set separately from `JWT_SECRET`
- [ ] `DATABASE_URL` uses SSL (`?sslmode=require`)
- [ ] HTTPS is enforced (Replit handles this automatically)
- [ ] `NODE_ENV=production` is set
- [ ] Admin default password (`admin123`) changed immediately after first login
- [ ] Rate limiting configured (already enabled globally)
- [ ] Error monitoring active (`/admin/shield-core`)
