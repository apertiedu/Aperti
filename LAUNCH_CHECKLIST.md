# Aperti Production Launch Checklist

**Version:** Phase 48 — Final Production Stack  
**Date:** June 2026

Mark each item before going live. Items marked **[BLOCK]** prevent launch if incomplete.

---

## 1. Environment & Security

- [x] **[BLOCK]** `DATABASE_URL` set and reachable — validated at startup via `validateEnv()`
- [x] **[BLOCK]** `JWT_SECRET` set, ≥ 32 characters, no fallback value — `validateEnv()` exits if missing
- [x] **[BLOCK]** `SESSION_SECRET` set (or warning logged; falls back to JWT_SECRET)
- [x] No hardcoded API keys anywhere in source — `scripts/repair.ts` scans and reports
- [x] AI key configured (`OPENAI_API_KEY` or `NVIDIA_API_KEY` or Replit AI Integration)
- [ ] `APP_URL` set to production domain (used in email links, CORS, cookie SameSite)
- [x] `PORT` defaults to 3001 — backend listens on `process.env.PORT`
- [x] CORS configured — `ALLOWED_ORIGINS` env var restricts origins in production
- [ ] SSL certificate active on production domain
- [x] `helmet.js` security headers enabled
- [x] Rate limiting: 200 req/min global, 10/15min on login, 5/15min on password reset

## 2. Database

- [x] **[BLOCK]** All migrations applied at startup (no manual step required)
- [x] No local SQLite — PostgreSQL cloud instance (Neon / Supabase / Railway Postgres)
- [x] Foreign key constraints on all relational tables
- [x] Performance indexes on hot query columns (`pg_trgm`, `idx_*`)
- [x] `pg_trgm` extension enabled for fuzzy search
- [x] `ai_usage_log`, `role_permissions`, `repair_log`, `ai_interactions` tables created
- [ ] Database backup strategy documented and automated
- [ ] Point-in-time recovery tested

## 3. Authentication & Authorization

- [x] **[BLOCK]** Login always returns valid JSON — `Content-Type: application/json` on all paths including 4xx/5xx
- [x] **[BLOCK]** `safeUser()` normalises every user object before sending to frontend (id, role, email, status always present)
- [x] JWT 7-day expiry; `httpOnly` cookie; `secure: true` in production
- [x] `requireRole()` middleware on all admin/teacher routes
- [x] `requirePermission()` middleware available for V2 fine-grained access
- [x] Role & Permission Matrix UI at `/admin/roles-matrix` — DB-backed, cache-cleared on update
- [x] No `user.role` accessed without optional chaining (`user?.role ?? 'guest'`)
- [x] MFA (TOTP) implemented for admin accounts
- [x] Password reset flow — admin-assisted (no SMTP dependency)
- [x] Session store: PostgreSQL (connect-pg-simple) — not in-memory

## 4. Routes & API

- [x] **[BLOCK]** No broken API routes — all return JSON for `/api/*` paths
- [x] **[BLOCK]** Global 404 handler returns JSON `{ error: "Not found" }` for API routes
- [x] All frontend routes registered in `App.tsx` and `route-registry.ts`
- [x] Route Health Scanner at `/admin/route-health`
- [x] `AdminOS` page with 50+ admin sub-pages all reachable
- [x] API routes audited for duplicate mounts (none found)
- [ ] Run `scripts/repair.ts` — zero critical findings
- [x] `/health` endpoint returns `{ status, db, uptime, latencyMs }`
- [x] `/api/health` returns db tables, memory, AI status
- [x] `/api/ai/health` returns AI service status + today's cost

## 5. AI System

- [x] **[BLOCK]** AI service has graceful fallback — never crashes on missing key
- [x] AI gateway with in-memory cache (10-min TTL, 500-entry cap)
- [x] Streaming SSE endpoint at `POST /api/ai/chat`
- [x] `useAIStream` hook for progressive text display
- [x] Cost tracking — `ai_interactions` table logs tokens, model, cost, latency
- [x] 4 AI Teaching modules: lesson, grade, analyze-student, copilot
- [ ] Daily budget cap configured in `platform_settings`
- [ ] Monthly AI spend report reviewed

## 6. Frontend

- [x] **[BLOCK]** Sidebar text-only "Aperti." — no icon
- [x] Error boundaries on all pages — friendly fallback with Retry button
- [x] All buttons have disabled/loading states
- [x] Mobile responsive across all roles (teacher, student, parent, admin)
- [x] Safe-area CSS for iOS notch/home indicator
- [x] Touch targets ≥ 44px
- [ ] No console errors on login, dashboard, gradebook, assessment pages
- [x] Command palette (`Cmd+K`) for quick navigation
- [x] Offline indicator via `useNetworkQuality`

## 7. Payments & Commerce

- [ ] InstaPay flow tested end-to-end (test transaction)
- [ ] Duplicate payment detection active
- [ ] Subscription webhooks verified

## 8. Performance

- [x] Backend build: esbuild (< 5s cold build)
- [x] Vite manual chunks (vendor / ui / pages split)
- [x] TanStack Query with `gcTime` and `staleTime` set
- [x] Static assets: 1-year cache headers
- [ ] Dashboard load < 2s on 4G connection
- [ ] Search response < 300ms (pg_trgm indexed)
- [ ] `/api/health` latency < 10ms

## 9. Observability

- [x] `error_logs` table captures all backend exceptions + frontend errors
- [x] AI failures logged to `error_logs`
- [x] Repair log at `/admin/repair` — shows orphans, findings, fix history
- [x] Founder Control Center with live Launch Readiness Score
- [ ] Alerting on error spike (> 10 errors/min)
- [ ] Uptime monitor configured (UptimeRobot / Betterstack)

## 10. Pre-Launch Validation

- [ ] Run `npx ts-node scripts/repair.ts` — zero critical findings
- [ ] Run `npx ts-node scripts/deploy.ts` on staging — build passes
- [ ] Sign in as each role (admin, teacher, assistant, student, parent) — no 404s
- [ ] Admin `POST /api/admin/repair/orphans` — zero orphans or all fixed
- [ ] Launch Readiness Score at `/admin/repair` ≥ 95
- [ ] `ARCHITECTURE.md` reviewed by lead engineer
- [ ] `LAUNCH_REPORT.md` reviewed and signed off
- [ ] Staging environment mirrors production (same env vars, same DB schema)

---

**Score to launch: resolve all [BLOCK] items + achieve ≥ 95 on Launch Readiness Score.**
