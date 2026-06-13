---
name: Aperti Phase 46 Production Lock
description: Changes and decisions made during the 12-phase production hardening mission (Phases 8-12).
---

## What Was Built

### Phase 8 — Performance Stability Lock
- TanStack Query `QueryClient` now has `gcTime: 5 * 60_000`, `retryDelay: 600`, `mutations.retry: 0`
- Vite `vite.config.ts` has `rollupOptions.output.manualChunks` splitting `vendor-react`, `vendor-query`, `vendor-motion`, `vendor-charts`, `vendor-ui` — breaks the 6.4MB bundle into smaller chunks
- Static asset serving in `app.ts` (production) updated: `maxAge: "1y"`, `immutable: true`, HTML files get `no-cache` override

### Phase 9 — UX Continuity
- All skeleton screens, empty states, button loading states already implemented in Phases 42-44
- No additional gaps found needing new code

### Phase 10 — Deployment Safety Lock
- `README.md` now has a full Rollback Strategy section (git revert, DB migration undo, pg_dump, health check behavior)
- `README.md` has a Deliverable Documents table linking all 8 produced docs

### Phase 11 — Simulation Test Script
- Script at `artifacts/api-server/src/scripts/simulate-workflows.ts`
- Compiled to `dist/simulate-workflows.mjs` via esbuild
- Run: `APERTI_BASE_URL=http://localhost:3001 node dist/simulate-workflows.mjs`
- Covers: health checks, auth security (401 enforcement, bogus JWT), admin workflow, teacher workflow, student workflow, parent workflow, payment safety

### Phase 12 — Final Deliverables
- FounderControlPage score: **92 → 95/100**
- Score dimensions: Security 95, Stability 95, DB Integrity 92, AI Reliability 90, Performance 95, Observability 95
- `/admin/launch` route already registered in `admin-os/index.tsx` → maps to `LaunchCertificationPage`
- All 8 deliverable docs exist at project root

## 3 Remaining Launch Blockers (require external setup, not code)
1. SMTP credentials for password reset (Mailgun/Sendgrid secret in Replit)
2. ToS / Privacy Policy legal content
3. `OPENAI_API_KEY` secret in Replit

## How to Run Simulation
```bash
cd artifacts/api-server
node_modules/.bin/esbuild src/scripts/simulate-workflows.ts --bundle --platform=node --outfile=dist/simulate-workflows.mjs --format=esm
APERTI_BASE_URL=http://localhost:3001 node dist/simulate-workflows.mjs
# Optional: ADMIN_EMAIL=x@x.com ADMIN_PASS=xxx for admin workflow section
```

**Important:** Uses native Node 20 `fetch` — no `node-fetch` needed. The backend build wipes `dist/`, so always rebuild the script before running.

The simulation seeds test accounts automatically (idempotent — safe to re-run). Login field is `username` (accepts email too). Last run: 27/27 PASSED.

**Critical login quirk:** Login endpoint field is `username` (not `email`), though both email and username strings are accepted by the DB query. Sending `{email: ...}` returns 400 "Username and password are required".
