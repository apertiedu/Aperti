---
name: Aperti production hardening
description: Summary of production hardening decisions made during the security/stability mission
---

## JWT Secret Handling
- Removed all `|| "aperti-dev-secret-change-in-prod"` fallbacks from middleware/auth.ts, routes/auth.ts, routes/search.ts, routes/founder.ts
- Removed `|| "aperti-fallback-secret"` from app.ts session config
- Server now exits at startup if JWT_SECRET is missing, shorter than 32 chars, or equals the known default
- SESSION_SECRET falls back to JWT_SECRET (not a hardcoded string) if not set
- JWT_SECRET is stored as a shared env var (setEnvVars), not in .env — use `setEnvVars` to read/set it

**Why:** Hardcoded fallbacks are the #1 credential leak vector in Express apps deployed to shared hosts.

## Duplicate Route Elimination
- `artifacts/api-server/src/routes/class-forge.ts` was dead code (77 lines); deleted
- `artifacts/api-server/src/routes/classforge.ts` is the live version, imported in routes/index.ts
- Frontend page `artifacts/aperti/src/pages/class-forge.tsx` uses `/class-forge/heatmap/` which maps to classforge.ts — this is correct

**Why:** Duplicate route files with slightly different names cause silent divergence over time.

## AI Health Endpoint
- Added public `GET /api/ai/health` to ai-status.ts (no auth required)
- Returns provider, model, feature availability map, and fallbackMode
- Existing authenticated endpoint `GET /api/settings/ai-status` unchanged

## Env Var Pattern
- Use `setEnvVars({ values: {...}, environment: "shared" })` in code_execution sandbox to set env vars
- All required vars: DATABASE_URL, JWT_SECRET, PORT; optional: SESSION_SECRET, OPENAI_API_KEY, VAPID_*

## Deliverable Documents Generated (all at repo root)
- SECURITY_REPORT.md — all critical/high/medium issues with fix status
- ROLE_MATRIX.md — backend + frontend route permission matrix
- PERFORMANCE_OPTIMIZATIONS.md — current state + recommendations
- DEPLOYMENT.md — full production deployment guide
- LAUNCH_RISKS.md — risk register with severity + launch readiness score (77/100)
- ROADMAP.md — immediate pre-launch blockers + short/medium/long-term
- DB_INTEGRITY.md — FK enforcement, indexes, data quality, schema overview
