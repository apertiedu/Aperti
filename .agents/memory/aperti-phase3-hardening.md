---
name: Aperti Phase 3 Production Hardening
description: Security, permissions, audit, DB, health changes made during Phase 3 SaaS readiness pass.
---

# Phase 3 — Production Hardening Summary

**Why:** Platform needed to move from "secure" to "production-grade" before private beta launch with real schools.

## Key Changes Made

### Upload Security (Part 1)
- `upload_registry` table created (lib/db/src/schema/upload-registry.ts + SQL migration)
- `express.static("/uploads")` removed from app.ts; replaced with `filesRouter` (authenticated /files/:filename)
- `/uploads/*` now returns 403 with explanation
- Bug fixed in files.ts: `isSameTenant` was comparing `tenant_id` to `req.userId` (always false) — now queries `accounts.teacher_account_id` and `students.teacher_account_id`
- `uploadLimiter` (30/hr) applied to upload route
- Uploads now return `/files/:filename` URL (not `/uploads/`)

### Authorization Framework (Part 2)
- `artifacts/api-server/src/lib/authorization.ts` — unified `canAccess()`, `canModify()`, `canDelete()`, `canExport()`, `canGrade()`
- Role-aware, tenant-aware, ownership-aware for all resource types
- `PERMISSION_MATRIX` exported for admin reporting

### Audit Logging (Part 3)
- `artifacts/api-server/src/lib/audit.ts` — centralized with 40+ typed `AuditAction` values
- `auditFromReq()` helper for Express routes
- Severity auto-classification (info/warn/critical) per action type

### Rate Limiting (Part 4)
- `perUserKeyGenerator` fixed to use `ipKeyGenerator` from express-rate-limit (IPv6 safe)
- All 5 limiters: export/report/search/upload/fileDownload use per-user keys

### Health Check (Part 5)
- `/health` enhanced: DB latency + storage writability probe + memory usage + registered file count
- Returns structured `checks` object with per-service status

### Database Indexes (Part 6)
- `db-indexes.ts` expanded to 26 indexes (was 17)
- Key additions: `idx_students_teacher_status`, `idx_accounts_email_lower`, `idx_audit_logs_action_severity`, `idx_upload_registry_*`, `idx_subscriptions_expires`, `idx_notifications_recipient_read`

## Reports
Full Phase 3 report at `docs/phase3-security-report.md`

## Production Verdict
**READY FOR PRIVATE BETA** — resolve Redis, accessibility, and automated tests before public launch.
