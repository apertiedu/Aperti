# Aperti — Intelligent Educational Operating System

> Multi-tenant EdTech platform for teachers, students, parents, and admins. Phases 1–33 complete.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite + Tailwind CSS + shadcn/ui |
| Backend | Node.js + Express 5 + TypeScript (esbuild) |
| Database | PostgreSQL 15 via Drizzle ORM |
| Auth | JWT (7d) + Session (PostgreSQL store) + TOTP MFA |
| AI | OpenAI GPT-4o (Replit integration) |
| Queue | In-memory job queue (BullMQ-compatible) |
| Monitoring | Prometheus metrics + api_metrics table + error_logs table |

---

## Quick Start (Replit)

Both workflows start automatically:

- **Backend API**: `cd artifacts/api-server && PORT=3001 pnpm run dev`
- **Start application**: `cd artifacts/aperti && pnpm run dev`

Set these secrets in Replit Secrets before starting:

```
JWT_SECRET       — 64-char hex string
OPENAI_API_KEY   — OpenAI or compatible key
SESSION_SECRET   — 32-char string (any value)
```

Database is auto-provisioned by Replit PostgreSQL. Schema is pushed on first startup.

**Default admin login:** `admin` / `admin123` — change immediately.

---

## Development Setup (local)

### Prerequisites
- Node.js 20+, pnpm 9+, PostgreSQL 15+

### Install & Run

```bash
git clone <repo> aperti && cd aperti
pnpm install

# Copy and fill environment variables
cp .env.example .env

# Terminal 1 — API (port 3001)
cd artifacts/api-server && PORT=3001 pnpm run dev

# Terminal 2 — Frontend (port 5000)
cd artifacts/aperti && pnpm run dev
```

---

## Environment Variables

See `.env.example` for the full list. Required variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | JWT signing secret (≥ 32 chars) |
| `SESSION_SECRET` | Session signing secret |
| `OPENAI_API_KEY` | AI features (GPT-4o) |
| `VAPID_PRIVATE_KEY` | Push notifications (optional) |

---

## Architecture

```
aperti/
├── artifacts/
│   ├── aperti/               # React frontend (Vite, port 5000)
│   │   └── src/
│   │       ├── pages/        # Route components by role
│   │       │   ├── admin/    # Admin OS (100+ pages)
│   │       │   ├── student/  # Student OS
│   │       │   └── teacher/  # Teacher OS (CoreHub)
│   │       ├── components/   # Shared UI components
│   │       └── lib/          # API helpers, utils
│   ├── api-server/           # Express API (esbuild, port 3001)
│   │   └── src/
│   │       ├── routes/       # 100+ route handlers
│   │       ├── lib/          # Cache, queue, metrics, MFA, email
│   │       └── middleware/   # Auth, rate limiting, logging
│   └── db/                   # Drizzle schema + shared DB pool
├── lib/db/                   # Shared DB types
├── docs/                     # Role guides (admin, teacher, student, parent, founder)
└── .env.example              # All required environment variables
```

---

## Platform Modules

| Phases | Module |
|---|---|
| 1–2 | Teacher OS: lessons, attendance, gradebook, live class |
| 3–4 | Student OS: study stream, flashcards, InkSpace, gamification |
| 5 | AI engine: CoreMind mentor, homework feedback, exam analysis |
| 6 | Assessment Hub: exams, rubrics, past papers, question bank |
| 7 | Communication: announcements, discussions, parent notifications |
| 8 | Learning experience: adaptive paths, micro-assessments |
| 9 | Admin OS: multi-tenant management, audit logs, subscriptions |
| 10 | Infrastructure: security, caching, queues, metrics, MFA, PWA |
| 11–13 | Growth, QA, launch readiness, content governance |
| 14–18 | Enterprise features, AI usage governance, launch audit |
| 19–20 | Founder Control Center: revenue, growth, alerts, launch command |
| 21–22 | UX system: design tokens, skeletons, empty states, auto-save |
| 23–25 | Production hardening: session, error logs, launch certification |
| 26–27 | Stability: QA script, problem reports, UX polish |
| 28–29 | Intelligence: educational excellence, self-marking, AI content validation |
| 30–31 | Error intelligence, content validation, resource mapping |
| 32 | Zero-defect: 100% route health, sign-in hardening |
| 33 | Platform perfection: DB health, analytics deep dive, error capture, docs |

---

## Key API Endpoints

### Public
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check (DB, uptime, version) |
| `POST` | `/auth/login` | Login (rate limited: 10/min) |
| `POST` | `/auth/forgot-password` | Password reset (generic safe response) |
| `POST` | `/auth/reset-password` | Consume reset token (1-time use, 1h TTL) |

### Admin (requires `admin` / `super_admin`)
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/admin/db-health` | DB size, table stats, slow queries, connections |
| `POST` | `/api/admin/db-health/vacuum` | Run VACUUM ANALYZE |
| `GET` | `/api/admin/analytics/extended/active-users` | DAU / WAU / MAU |
| `GET` | `/api/admin/analytics/extended/revenue-growth` | Weekly & monthly revenue |
| `GET` | `/api/admin/analytics/extended/retention` | 7d & 30d retention cohorts |
| `GET` | `/api/admin/analytics/extended/error-trends` | Error count by day/source |
| `GET` | `/api/admin/route-health` | 100% route health check |
| `GET` | `/api/founder/launch-certification` | 12-check launch gate |

> Full API: see **Admin OS → API Docs** in the platform.

---

## Security

- **Helmet.js** — security headers on all responses
- **Rate limiting** — 200 req/min global; 10/min on login; 5/min on password reset
- **JWT** — 7-day expiry, role in payload
- **TOTP MFA** — Google Authenticator compatible
- **Password resets** — 1-hour token TTL, one-time use enforced, generic email response
- **Global error handler** — never leaks stack traces in production
- **AES-256-GCM** — encryption for sensitive DB fields
- **Audit logging** — all admin actions logged to `audit_logs`

---

## Monitoring & Observability

- **Prometheus** at `GET /metrics`
- **API latency** in `api_metrics` table (auto-pruned)
- **Frontend errors** captured in `frontend_error_logs` (React ErrorBoundary + window.onerror + unhandledrejection)
- **DB health** at `/api/admin/db-health` — size, table stats, slow queries, connections
- **Admin dashboards**: Admin OS → DB Health, Slow Queries, Stability Score, Error Intelligence

---

## Backup

Automated `pg_dump` at 02:00 UTC daily. Max 10 backups in `/backups/`. Manual trigger: Admin OS → Backups.

---

## PWA & Mobile

- Service worker with network-first caching strategy
- `manifest.json` with icons, theme-color, display: `standalone`
- Offline shell + graceful degradation
- All touch targets ≥ 44px

---

## Docs

See `docs/` for role guides:
- `docs/admin.md` — Admin workflows
- `docs/teacher.md` — Teacher (CoreHub) workflows
- `docs/student.md` — Student workflows
- `docs/parent.md` — Parent workflows
- `docs/founder.md` — Founder daily command dashboard

---

*Built on Replit. Phase 33 — Platform Perfection, Scalability & Real-World Readiness.*
