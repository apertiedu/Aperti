---
name: Aperti production hardening
description: JWT security hardening (old) + full observability/validation hardening layer (new) — safeHandler, request observer, AI validator, safe mode, self-check, dashboard
---

## JWT Secret Hardening (earlier session)
- Removed all `|| "aperti-dev-secret-change-in-prod"` fallbacks from middleware/auth.ts, routes/auth.ts, routes/search.ts, routes/founder.ts
- Server now exits at startup if JWT_SECRET is missing, shorter than 32 chars, or equals the known default
- SESSION_SECRET falls back to JWT_SECRET (not a hardcoded string) if not set

## Duplicate Route Elimination (earlier session)
- `artifacts/api-server/src/routes/class-forge.ts` was dead code (77 lines); deleted
- `artifacts/api-server/src/routes/classforge.ts` is the live version

## Production Hardening & Observability Layer (current session)

### New lib files in api-server/src/lib/

- `safe-handler.ts` — `safeHandler(handler, errorCode)`: wraps any async route handler, catches all exceptions, calls `logError`, inserts into `system_validation_errors` for AI routes, returns `{ status:"degraded", message, requiresReview:true, error_code }` when headers not sent.
- `validate-ai-response.ts` — `validateAIResponse(response, source, opts)` + `buildFallbackAIResponse(source)`. Logs missing fields/null responses to `system_validation_errors`. `opts.requireConfidence` clamps confidence 0–1.
- `request-observer.ts` — Express middleware; `res.on("finish")` logs every request (method/path/status/latency_ms/success/userId/role) to `system_metrics_log`. Skips /api/healthz, /metrics, /uploads. Applied after `metricsMiddleware()` in app.ts.
- `safe-mode.ts` — `isSafeModeEnabled()` (30s TTL in-memory cache), `setSafeMode(bool)`, `getSafeModeStatus()`. Stores flag in `feature_flags` table, name='safe_mode'.

### New DB tables (created via psql; also in migrate.ts)
- `system_metrics_log` — every API request (method, path, status_code, latency_ms, user_id, role, model_used, confidence, success, error_code)
- `system_validation_errors` — AI response schema violations + fallback activations (source, error_type, field_missing, raw_response, fallback_used)
- `ux_rule_violations` — UX consistency violations (route, rule_id, description, severity)

### New system.ts endpoints (all admin+super_admin gated via systemRouter.use(requireRole))
- `GET /api/system/self-check` — runs 5 checks (DB connectivity, error_rate_1h, ai_provider_configured, environment_variables, safe_mode_status); returns `{ production_ready, overall, checks[], timestamp }`
- `GET /api/system/safe-mode` — returns `{ enabled, since }`
- `POST /api/system/safe-mode` — body `{ enabled: bool }` — upserts feature_flags row
- `GET /api/system/production-metrics` — aggregated system+ux+ai metrics for 24h window; used by SafeModeBanner and dashboard

### Frontend additions
- `components/ai-confidence-badge.tsx` — `<AIConfidenceBadge confidence={0..1} />` + `<AIConfidenceBar />`. Green ≥0.85, amber ≥0.65, red <0.65.
- `components/safe-mode-banner.tsx` — polls /api/system/production-metrics every 60s; amber banner when safe_mode=true; dismissible.
- `hooks/use-safe-ui.ts` — `useSafeUI<T>()` hook: state/data/error/isLoading/isError/isSuccess/run/reset. Also exports `extractErrorMessage(response)` that detects degraded status.
- `pages/admin/production-hardening.tsx` — dashboard at `/admin/production-hardening`: 4 metric cards + 3 health panels (system/AI/UX) + self-check runner + safe mode toggle.

**Why:** Observable, fault-tolerant behavior requires every error logged, every request tracked, AI responses validated before serving. safeHandler is the standard wrapper pattern for new routes.

**How to apply new routes:** `import { safeHandler } from "../lib/safe-handler"` then `router.get("/path", safeHandler(async (req, res) => { ... }))`. For AI responses: `await validateAIResponse(aiResult, "module/action", { requireConfidence: true })` before returning.
