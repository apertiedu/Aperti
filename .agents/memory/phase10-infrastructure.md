---
name: Phase 10 Infrastructure
description: Security, performance, caching, queues, MFA, PWA, commit hash injection — key patterns and decisions
---

## Commit Hash Injection
- **Backend (build.mjs):** `execSync("git rev-parse --short HEAD")` injected into esbuild `define` as `process.env.COMMIT_HASH`. Falls back to env var or "dev".
- **Frontend (vite.config.ts):** Same execSync approach, exposed via `define: { "import.meta.env.VITE_COMMIT_HASH": JSON.stringify(hash) }`.
- **Display:** Admin sidebar footer shows `v10.0 · <commit-hash>` as a teal badge.
- **Why:** Baked at build time so no runtime fetch needed; consistent across api/frontend.

## prom-client + @opentelemetry/api
- prom-client@15 requires `@opentelemetry/api` as a peer dep even if you don't use OpenTelemetry.
- Must install `@opentelemetry/api` at workspace root (`pnpm add -w @opentelemetry/api`).
- Also add `"@opentelemetry/*"` to esbuild `external` array (already present in build.mjs).

## nodemailer must be external in esbuild
- `nodemailer` must be in esbuild `external` array (already present). If it's bundled, runtime crashes.

## TOTP MFA (no external lib)
- Custom TOTP implementation in `lib/mfa.ts` using Node.js `crypto` only.
- Compatible with Google Authenticator / Authy.
- MFA secrets encrypted at rest with AES-256-GCM (`encryptField`/`decryptField`).
- DB columns: `mfa_enabled boolean DEFAULT false`, `mfa_secret text`.

## In-memory job queue
- `lib/queue.ts` provides `enqueue(name, data)` with automatic retry (once, after 5s).
- Handlers registered via `registerHandler(name, fn)`.
- No Redis required — BullMQ can be wired in later by swapping `lib/queue.ts`.

## PWA service worker
- `public/sw.js` registered only in `PROD` mode (import.meta.env.PROD).
- Cache-first for static assets, network-first for HTML pages.
- Never caches `/api/`, `/auth/`, `/socket.io` routes.

## Lite mode (low bandwidth)
- `useNetworkQuality` hook detects `navigator.connection.effectiveType`.
- Sets `html.lite-mode` CSS class → disables all animations/transitions globally via `animation-duration: 0.01ms`.
- State persisted in `localStorage` as `aperti_lite_mode`.

## Phase 10 DB tables
- `login_history` — tracks all login attempts (success/failure, IP, user-agent)
- `api_metrics` — every HTTP request logged (method, endpoint, status_code, duration_ms)
- `entity_versions` — change history for any entity
- `migrations_log` — migration run log
- `backup_logs` — pg_dump backup history
