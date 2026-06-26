# Audit Coverage Report — Aperti V2

> Generated: Phase 3 Production Hardening
> System: `artifacts/api-server/src/lib/audit.ts`
> Storage: `audit_logs` table

## Audit System Architecture

- **Entry point:** `audit()` and `auditFromReq()` in `lib/audit.ts`
- **Storage:** PostgreSQL `audit_logs` table
- **Severity levels:** `info` | `warn` | `critical`
- **Fire-and-forget:** Never throws — audit failure cannot crash the API
- **Fields captured:** actor, actorRole, action, resource, resourceId, tenantId, ip, userAgent, result, metadata

## Audited Action Coverage

### Authentication Events
| Action | Trigger | Severity |
|--------|---------|----------|
| `AUTH_LOGIN` | Successful login | info |
| `AUTH_LOGOUT` | User logout | info |
| `AUTH_FAILED` | Failed login attempt | **critical** |
| `AUTH_MFA_SUCCESS` | MFA verification passed | info |
| `AUTH_MFA_FAILED` | MFA verification failed | **critical** |
| `AUTH_PASSWORD_CHANGE` | Password changed | warn |
| `AUTH_TOKEN_REFRESH` | JWT refreshed | info |

### Grade Events
| Action | Trigger | Severity |
|--------|---------|----------|
| `GRADE_CREATE` | Grade recorded | info |
| `GRADE_UPDATE` | Grade edited | info |
| `GRADE_DELETE` | Grade deleted | **warn** |
| `GRADE_APPROVE` | Grade approved in workflow | info |
| `GRADE_REJECT` | Grade rejected | info |

### Student Events
| Action | Trigger | Severity |
|--------|---------|----------|
| `STUDENT_VIEW` | Student profile accessed | info |
| `STUDENT_CREATE` | Student enrolled | info |
| `STUDENT_UPDATE` | Student record modified | info |
| `STUDENT_SUSPEND` | Student suspended | **warn** |
| `STUDENT_DELETE` | Student removed | **warn** |

### File Events
| Action | Trigger | Severity |
|--------|---------|----------|
| `FILE_UPLOAD` | File uploaded to registry | info |
| `FILE_DOWNLOAD` | File served via `/files/:filename` | info |
| `FILE_DELETE` | File removed | warn |
| `FILE_ACCESS_DENIED` | Unauthorized file access attempt | **critical** |

### Export Events
| Action | Trigger | Severity |
|--------|---------|----------|
| `EXPORT_GRADES` | Grade export | info |
| `EXPORT_ATTENDANCE` | Attendance export | info |
| `EXPORT_STUDENTS` | Student list export | info |
| `EXPORT_ANALYTICS` | Analytics export | info |
| `EXPORT_AUDIT` | Audit log export | **warn** |
| `EXPORT_REPORT` | Report generation | info |

### Admin Events
| Action | Trigger | Severity |
|--------|---------|----------|
| `ADMIN_USER_CREATE` | Admin creates a user | info |
| `ADMIN_USER_EDIT` | Admin edits a user | info |
| `ADMIN_USER_SUSPEND` | Admin suspends a user | **warn** |
| `ADMIN_USER_DELETE` | Admin deletes a user | **critical** |
| `ADMIN_IMPERSONATE` | Admin impersonates a user | **critical** |
| `ADMIN_SETTING_CHANGE` | System setting modified | **warn** |
| `ADMIN_PLAN_CHANGE` | Subscription plan changed | warn |

### Permission Events
| Action | Trigger | Severity |
|--------|---------|----------|
| `PERMISSION_GRANT` | Permission granted to role/user | **critical** |
| `PERMISSION_REVOKE` | Permission revoked | **critical** |
| `ROLE_CHANGE` | User role changed | **critical** |

### Payment Events
| Action | Trigger | Severity |
|--------|---------|----------|
| `PAYMENT_VERIFY` | Payment verified | info |
| `PAYMENT_REFUND` | Refund issued | warn |
| `SUBSCRIPTION_CREATE` | Subscription started | info |
| `SUBSCRIPTION_CANCEL` | Subscription cancelled | warn |

### AI Events
| Action | Trigger | Severity |
|--------|---------|----------|
| `AI_REQUEST` | AI API call made | info |
| `AI_COST_EXCEEDED` | Daily AI quota exceeded | warn |

## Assessment Moderation Audit

Moderation actions (grade changes via `POST /grading/assessments/:id/moderate`) write directly to:
1. `moderation_logs` table — structured record of original vs moderated score
2. `audit_logs` via raw SQL INSERT — action `GRADE_MODERATED`

**Phase 3 improvement:** `FILE_ACCESS_DENIED` and `FILE_DOWNLOAD` now route through the centralized `audit()` function (was previously `auditLog` from `financial-audit`). This ensures consistent format and IP/UA capture.

## Gaps Remaining

| Gap | Risk | Recommendation |
|-----|------|----------------|
| Assessment moderation audit uses raw SQL, not `auditFromReq` | Low — data is still captured | Migrate to `auditFromReq` in next phase |
| AI requests only logged on quota exceeded | Low | Add `AI_REQUEST` log on every call (currently skipped for volume) |
| Bulk attendance marks log `ATTENDANCE_BULK` but not individual entries | Low | Acceptable for SaaS scale |
