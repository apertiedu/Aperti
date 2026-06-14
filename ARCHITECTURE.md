# Aperti V2 — Architecture Documentation

**Version:** Phase 48  
**Stack:** React 19 + Express 5 + PostgreSQL + Drizzle ORM + OpenAI-compatible AI

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT BROWSER                              │
│  React 19 + Vite + Tailwind CSS v4 + shadcn/ui                     │
│  Port 5000 (dev) │ Served by Express in production                  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTPS / WSS
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       API GATEWAY (Express 5)                       │
│  Port 3001                                                          │
│  ├── helmet (security headers)                                      │
│  ├── cors (ALLOWED_ORIGINS env)                                     │
│  ├── rate limiter (200 req/min global, 10/15min auth)               │
│  ├── pino HTTP logger                                               │
│  ├── authenticate middleware (JWT cookie → userId, userRole)        │
│  └── requireRole / requirePermission middleware                     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
              ┌────────────────┼───────────────────────┐
              ▼                ▼                       ▼
┌─────────────────┐  ┌─────────────────┐  ┌───────────────────────┐
│  SERVICE LAYER  │  │   AI GATEWAY    │  │  BACKGROUND WORKERS   │
│                 │  │                 │  │                       │
│ • Auth          │  │ • Cache (Map)   │  │ • AutoPilot           │
│ • Students      │  │ • SSE Stream    │  │   (60s scheduler)     │
│ • Attendance    │  │ • Cost tracking │  │ • Founder Alerts      │
│ • Homework      │  │ • Fallback      │  │   (5min worker)       │
│ • Exams/Grades  │  │ • Mode select   │  │ • Backup scheduler    │
│ • Courses       │  │   cheap/bal/    │  │   (daily 02:00 UTC)   │
│ • Payments      │  │   premium       │  │ • Perf flush          │
│ • Analytics     │  └────────┬────────┘  │   (60s interval)      │
│ • Notifications │           │           └───────────────────────┘
└────────┬────────┘           │
         │                    ▼
         │          ┌─────────────────────────────┐
         │          │       AI PROVIDER           │
         │          │                             │
         │          │ Priority chain:             │
         │          │ 1. Replit AI Integration    │
         │          │ 2. NVIDIA API               │
         │          │    (integrate.api.nvidia.com)│
         │          │ 3. OpenAI API               │
         │          │ 4. Graceful fallback text   │
         │          └─────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         DATABASE LAYER                              │
│  PostgreSQL (Neon / Supabase / Railway Postgres)                    │
│  ├── Drizzle ORM (schema definitions in packages/db/src/schema/)   │
│  ├── raw pool queries (pg) for performance-critical paths          │
│  ├── connect-pg-simple (session store — no Redis dependency)       │
│  └── Migrations run at startup via migrate.ts                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Layer Descriptions

### Frontend (`artifacts/aperti/`)
- **Framework:** React 19 with Solid-style reactive state via TanStack Query
- **Routing:** Wouter (lightweight, file-based in App.tsx)
- **Styling:** Tailwind CSS v4 + shadcn/ui component library
- **State:** TanStack Query for server state; React context for auth/theme
- **AI:** `useAIStream` hook consumes SSE from `/api/ai/chat` for progressive text

### API Gateway (`artifacts/api-server/`)
- **Framework:** Express 5 with TypeScript, compiled by esbuild (3–5s builds)
- **Auth:** JWT stored in `httpOnly` cookie (7-day expiry); TOTP MFA for admins
- **Security:** `helmet`, `cors`, per-route rate limiting, input validation
- **Middleware chain:** `authenticate` → `requireRole` → `requirePermission` → handler

### AI Gateway (`services/ai.ts` + `routes/ai-gateway.ts`)
- **Provider priority:** Replit Integration → NVIDIA → OpenAI → fallback text
- **Caching:** In-memory Map, TTL = 10 min, 500-entry cap; key = hash(prompt+mode)
- **Streaming:** SSE via `text/event-stream`; chunks emitted as `data: {"text": "..."}\\n\\n`
- **Cost tracking:** `ai_interactions` table; tokens estimated from response length
- **Modes:** `cheap` (small model), `balanced` (cache-first), `premium` (best model)

### Database (`lib/db/` + `packages/db/`)
- **ORM:** Drizzle ORM for schema management and type safety
- **Direct queries:** `pg` pool for complex joins and aggregations
- **Sessions:** PostgreSQL session store (no Redis required)
- **Migrations:** Sequential SQL in `migrate.ts`, run on every startup (idempotent)

---

## Data Flow Examples

### Login Flow
```
Client                    API                       Database
  │                        │                            │
  │── POST /api/auth/login ──>                          │
  │    { username, password }                           │
  │                        │── SELECT account ──────>  │
  │                        │<── { hash, mfa_enabled } ─│
  │                        │    verify bcrypt           │
  │                        │    sign JWT                │
  │<── 200 { user } ────── │                            │
  │    Set-Cookie: token   │                            │
  │    httpOnly; Secure    │                            │
```

### AI Grading Flow
```
Teacher                   AI Gateway                 AI Provider
  │                           │                           │
  │── POST /api/ai/grade ───> │                           │
  │   { answer, markScheme }  │── check cache ──          │
  │                           │   cache miss              │
  │                           │── fetch completions ────> │
  │                           │<── streaming chunks ───── │
  │<── { score, feedback } ── │── log ai_interactions     │
  │                           │── set cache               │
```

### Attendance QR Flow
```
Student (mobile)          API                       Database
  │                        │                            │
  │── POST /api/checkin ──>│                            │
  │   { qr_token, location }│── verify token ────────> │
  │                        │<── { lesson_id, valid } ── │
  │                        │── INSERT attendance ─────> │
  │<── 200 { ok, lesson } ─│                            │
```

### Permission Check Flow
```
Request → authenticate → extract {userId, userRole}
        → requireRole(["admin", "teacher"]) → check role
        → requirePermission("grades:view") → check DB override
          → if override exists: use it (60s cached)
          → else: use DEFAULT_PERMISSIONS[role]
        → handler
```

---

## Deployment Topology

```
Internet
   │
   ├── aperti.app (Frontend)
   │     Vercel static / Express static serve in production
   │
   └── api.aperti.app (API, Port 3001)
         Railway (primary) / Replit (dev+staging)
               │
               ├── PostgreSQL
               │     Neon.tech or Supabase
               │     Connection pooling via pg
               │
               └── AI Providers
                     NVIDIA integrate.api.nvidia.com
                     OpenAI api.openai.com (fallback)
```

**PM2 Process Management** (`ecosystem.config.js`):
- `aperti-api`: Express server, 512MB memory limit, auto-restart with 3s delay
- `aperti-web`: Vite preview (dev) or served by Express (production)

**Deploy pipeline** (`scripts/deploy.ts` or `deploy.sh`):
1. `validateEnv()` — exit on missing secrets
2. `pnpm install --frozen-lockfile`
3. `scripts/repair.ts` — exit on critical findings (bypass: `SKIP_REPAIR=1`)
4. `pnpm run build` (backend esbuild + frontend Vite)
5. DB migrations (run automatically on server start)
6. `pm2 startOrRestart ecosystem.config.js --env production`

---

## V1 → V2 Route Coexistence

V2 routes are mounted alongside V1 routes. No breaking changes; V1 routes
continue to work until V2 equivalents are fully tested.

| Path                           | Version | Status      |
|---|---|---|
| `/api/auth/*`                  | V1+V2   | Active      |
| `/api/admin/roles/matrix`      | V2      | New Phase 47|
| `/api/ai-teach/*`              | V2      | New Phase 47|
| `/api/ai/chat` (SSE)           | V2      | New Phase 48|
| `/api/admin/repair/*`          | V2      | New Phase 47|
| `/api/admin/roles/*`           | V2      | Replaces V1 |
| All other `/api/*`             | V1      | Unchanged   |

---

## Key Tables (Phase 47–48 additions)

| Table              | Purpose                                    |
|---|---|
| `role_permissions` | Admin-editable permission overrides        |
| `ai_usage_log`     | Per-user AI module call count              |
| `ai_interactions`  | Full cost tracking (tokens, model, cost)   |
| `repair_log`       | Auto-repair script findings + fix history  |

---

*This document is automatically validated against the live codebase by the
Repair Panel at `/admin/repair`. Re-run `scripts/repair.ts` after any
architectural change to verify consistency.*
