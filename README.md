# Aperti — Intelligent Educational Operating System

> A full-stack educational platform for teachers, students, and parents. Phases 1–10 complete.

---

## Overview

Aperti is a multi-tenant educational OS built as a pnpm monorepo with:

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite + Tailwind CSS + shadcn/ui |
| Backend | Node.js + Express + TypeScript (esbuild) |
| Database | PostgreSQL via Drizzle ORM |
| Cache | In-memory (Redis-compatible, upgradeable) |
| Auth | JWT + Session (express-session + PostgreSQL) |
| AI | OpenAI GPT-4o via Replit integration |
| Queue | In-memory job queue (BullMQ-compatible) |
| Monitoring | Prometheus metrics + prom-client |

### Key Modules

| Phase | Module |
|---|---|
| 1–2 | Teacher OS: lessons, attendance, gradebook, live class |
| 3–4 | Student OS: study stream, flashcards, InkSpace, gamification |
| 5 | AI engine: CoreMind mentor, homework feedback, exam analysis |
| 6 | Assessment ecosystem: exams, rubrics, past papers |
| 7 | Communication: announcements, discussions, parent notifications |
| 8 | Learning experience: adaptive paths, micro-assessments, mastery |
| 9 | Admin OS: multi-tenant management, audit logs, subscriptions |
| 10 | Infrastructure: security, caching, queues, metrics, MFA, PWA |

---

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 15+
- (Optional) Redis for distributed caching

### 1. Clone & Install

```bash
git clone <repo-url> aperti
cd aperti
pnpm install
```

### 2. Environment Variables

Copy `.env.example` and fill in the values (or set them in Replit Secrets):

```bash
# Required
DATABASE_URL=postgresql://user:password@localhost:5432/aperti
SESSION_SECRET=your-32-char-secret-here
JWT_SECRET=your-jwt-secret-32-chars-minimum

# AI (optional — enables AI features)
OPENAI_API_KEY=sk-...

# Redis (optional — falls back to in-memory cache)
REDIS_URL=redis://localhost:6379

# CDN (optional — files served locally otherwise)
CDN_URL=https://cdn.yourdomain.com

# MFA encryption key (optional)
MFA_ENCRYPTION_KEY=your-32-char-key-here

# LiveKit (optional — required for live video classes)
LIVEKIT_URL=wss://your-livekit-server.com
LIVEKIT_API_KEY=your-key
LIVEKIT_API_SECRET=your-secret

# Server ports
PORT=5000          # Frontend dev server
API_PORT=3001      # API server
BASE_PATH=/        # Vite base path
```

### 3. Database Setup

```bash
# Apply all migrations (idempotent — safe to re-run)
psql $DATABASE_URL < path/to/migrations.sql

# Or let the API server auto-migrate on startup (Phase 10 included)
pnpm --filter @workspace/api-server run dev
```

### 4. Start Development

```bash
# Start both servers (recommended)
# Terminal 1 — API (port 3001)
PORT=3001 pnpm --filter @workspace/api-server run dev

# Terminal 2 — Frontend (port 5000)
PORT=5000 BASE_PATH=/ API_PORT=3001 pnpm --filter @workspace/aperti run dev
```

Open [http://localhost:5000](http://localhost:5000)

**Default admin credentials:** `admin` / `admin123` (change immediately in production)

---

## Production Deployment

### Build

```bash
# Build API server
pnpm --filter @workspace/api-server run build
# Output: artifacts/api-server/dist/index.mjs

# Build frontend
PORT=5000 BASE_PATH=/ pnpm --filter @workspace/aperti run build
# Output: artifacts/aperti/dist/public/
```

### Start

```bash
# API
NODE_ENV=production node artifacts/api-server/dist/index.mjs

# Frontend (serve static files via nginx or express)
# Or use Replit Deploy which handles this automatically
```

### Health Check

```
GET /api/health
→ { "status": "ok", "db": "connected", "uptime": 120, "version": "abc1234" }
```

Set this as your load balancer / uptime monitor URL.

### PM2 (optional)

```bash
pm2 start artifacts/api-server/dist/index.mjs --name aperti-api
pm2 startup && pm2 save
```

---

## API Documentation

### Authentication

| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/login` | Login with username/password (rate limited: 10/min) |
| `POST` | `/auth/register` | Self-register as teacher/student/parent |
| `GET` | `/auth/me` | Get current user (requires Bearer token) |
| `POST` | `/auth/logout` | Logout and remove device session |
| `POST` | `/api/auth/mfa/setup` | Generate TOTP secret + QR URI |
| `POST` | `/api/auth/mfa/verify` | Verify code and enable MFA |

### System

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Public health check |
| `GET` | `/metrics` | Prometheus metrics (for scraper) |

### Admin OS (requires admin role)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/admin/users` | List all users |
| `GET` | `/api/admin/analytics` | Platform analytics |
| `GET` | `/api/admin/health` | System health metrics |
| `GET` | `/api/admin/queue/stats` | Job queue statistics |
| `GET` | `/api/admin/queue/jobs` | Recent job history |
| `GET` | `/api/admin/performance/metrics` | API latency per endpoint |
| `GET` | `/api/admin/health/backup-logs` | Backup history |
| `POST` | `/api/admin/health/run-backup` | Trigger manual backup |

> Full API: see `/admin/os/docs` in the platform for the complete module reference.

---

## Load Testing

For load testing, we recommend [Artillery](https://artillery.io):

```bash
npm install -g artillery

# Quick smoke test
artillery quick --count 20 --num 10 https://your-domain.com/api/health

# Full scenario (create artillery.yml)
artillery run artillery.yml
```

**Example `artillery.yml`:**

```yaml
config:
  target: "http://localhost:3001"
  phases:
    - duration: 60
      arrivalRate: 10
      name: Warm up
    - duration: 120
      arrivalRate: 50
      name: Sustained load

scenarios:
  - name: API health check
    flow:
      - get:
          url: /api/health
  - name: Auth flow
    flow:
      - post:
          url: /auth/login
          json:
            username: admin
            password: admin123
```

**Performance targets:**
- API responses < 500ms (p95), excluding AI calls
- AI calls < 10s (streaming preferred)
- Lighthouse score > 90 (Performance, Accessibility, Best Practices)

---

## Architecture

```
aperti/                          # Workspace root
├── artifacts/
│   ├── aperti/                  # React frontend (Vite)
│   │   ├── src/
│   │   │   ├── pages/           # Route components by role
│   │   │   │   ├── admin/       # Admin OS pages
│   │   │   │   ├── student/     # Student OS pages
│   │   │   │   └── teacher/     # Teacher OS pages
│   │   │   ├── components/      # Shared UI components
│   │   │   ├── hooks/           # Custom React hooks
│   │   │   ├── context/         # Auth, theme contexts
│   │   │   └── lib/             # API helpers, utils
│   │   └── public/              # Static assets, manifest, sw.js
│   ├── api-server/              # Express API (esbuild)
│   │   └── src/
│   │       ├── routes/          # All API route handlers
│   │       ├── lib/             # Cache, queue, metrics, MFA, etc.
│   │       ├── middleware/       # Auth, rate limiting
│   │       └── db/              # Migrations runner
│   └── db/                      # Drizzle schema + shared DB pool
└── README.md
```

---

## Security

- **Helmet.js** security headers on all responses
- **Rate limiting:** 200 req/min global, 10/min on login
- **JWT** tokens (7d expiry, configurable)
- **TOTP MFA** — Google Authenticator compatible
- **AES-256-GCM** encryption for sensitive DB fields
- **Session** stored in PostgreSQL (not cookies only)
- Login history tracked in `login_history` table

---

## Monitoring

- **Prometheus metrics** at `GET /metrics`
- **System health** at `GET /api/health`
- **Admin dashboards:** Performance, Queue, Backups at `/admin/os`
- **API metrics** stored in `api_metrics` table (auto-prunable)

---

## Backup

Automated `pg_dump` runs daily at **02:00 UTC** via node-cron. Backups stored in `/backups/`, logged in `backup_logs` table. Maximum 10 backups retained. Manual trigger available via Admin OS → Backups.

---

## PWA & Mobile

- PWA manifest at `/manifest.json`
- Service worker caches static assets (JS/CSS/fonts/images)
- Offline-friendly shell with network-first strategy for pages
- Low-bandwidth mode auto-detected via Network Information API
- All interactive elements have ≥ 44px touch targets

---

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/your-feature`)
3. Make changes, test locally
4. Open a PR with a clear description

---

*Built with ❤ on Replit. Phase 10 — Infrastructure, Security, Performance & Reliability.*
