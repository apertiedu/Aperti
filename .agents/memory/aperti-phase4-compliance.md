---
name: Aperti Phase 4 Compliance Layer
description: Compliance & Trust Layer — JWT fallback pattern, consent router mount fix, legal policy versioning, deletion workflow security, admin route auth pattern.
---

# Aperti Phase 4 — Compliance & Trust Layer

## JWT_SECRET Fallback
**Rule:** `index.ts` checks JWT_SECRET BEFORE env.ts validateEnv() runs. Both must have the fallback.  
**Why:** SESSION_SECRET is the only secret configured in dev Replit environment. JWT_SECRET was missing, causing startup failure.  
**How to apply:** In both `src/index.ts` (before requiredEnv check) and `src/config/env.ts` (before validation): `if (!process.env["JWT_SECRET"] && process.env["SESSION_SECRET"]) process.env["JWT_SECRET"] = process.env["SESSION_SECRET"]`

## complianceConsentRouter Was Unmounted
**Rule:** Always verify new routers are imported AND mounted in routes/index.ts.  
**Why:** compliance-consent.ts existed with full endpoints but was never mounted — all consent API calls returned 404.  
**Fix:** Added import + `router.use(complianceConsentRouter)` in index.ts.

## Legal Policy Version Immutability
**Rule:** Active policy versions must be immutable. `PUT /admin/legal/policies/:id` must check `is_active = false` before allowing edits.  
**Why:** Legal audit trail integrity — editing published policies would corrupt compliance records.  
**How:** Query `SELECT is_active WHERE id = $1`, reject with 409 if active. Only draft (is_active=false) versions are editable.

## Account Deletion Server-Side Confirmation
**Rule:** `POST /api/user/deletion-request` must validate `confirmation === "delete my account"` server-side.  
**Why:** Client-only enforcement is trivially bypassable. Destructive account actions need server-side gate.  
**How:** Check `req.body.confirmation?.trim().toLowerCase() !== "delete my account"`, return 400 if mismatch.

## Admin Route Auth Pattern
**Rule:** All admin routes need `authenticate` middleware BEFORE `requireRole`. Use spread: `...adminAuth("admin", "super_admin")`.  
**Why:** `requireRole` reads `req.role` which is set by `authenticate`. Without authenticate first, role is undefined → 403 or worse.  
**How:** Define `function adminAuth(...roles) { return [authenticate, requireRole(...roles)] }` at top of route file.

## legal_policy_versions Table
Created in migrate.ts. Columns: id, policy_type (varchar 64), version (varchar 32), content (text), summary (text), effective_date (date), created_by (FK accounts), created_at, is_active (bool), requires_reconsent (bool).  
Seeded with 4 active policy types: privacy_policy, terms_of_service, data_retention, cookie_policy at v2026.06.

## New Routes and Pages (Phase 4)
- `/privacy-vault` — full 3-step deletion workflow + data export (rebuilt from stub)
- `/consent-settings` — granular consent management page (new)
- `/admin/legal-editor` — policy CMS with draft/activate flow (new)
- `GET /api/legal/policies` — public active policies list
- `GET /api/user/deletion-request-status` — filters by account_deletion type only

## Deletion Status Endpoint
Must filter by `request_type = 'account_deletion' OR type = 'account_deletion'` — both column naming conventions exist in DB. Without filter, any compliance request type could trigger hasPending=true incorrectly.
