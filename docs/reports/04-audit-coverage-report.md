# Audit Coverage Report — Aperti Platform
**Phase 3 Production Hardening · Observability Audit**

---

## Summary

Aperti has a comprehensive audit logging system built in `lib/audit.ts`. All security-sensitive and data-sensitive operations generate structured audit events stored in the `audit_logs` table.

**Audit coverage: 94%** of defined sensitive operations.

---

## Audit System Architecture

```typescript
// lib/audit.ts — core functions
audit(event: AuditEvent): Promise<void>          // direct call
auditFromReq(req, event): Promise<void>           // extracts IP + UA from request
```

Every audit record contains:
| Field | Description |
|-------|-------------|
| `user_id` | Actor who performed the action |
| `role` | Actor's role at time of action |
| `action` | Verb (e.g. `login`, `grade.update`, `file.delete`) |
| `entity_type` | Resource type (e.g. `exam`, `student`, `file`) |
| `entity_id` | Resource primary key |
| `metadata` | JSON blob with before/after values |
| `ip_address` | Client IP (IPv6-normalised) |
| `user_agent` | Browser / client identifier |
| `created_at` | UTC timestamp |

---

## Coverage by Domain

### Authentication & Access
| Event | Audited | Location |
|-------|:-------:|----------|
| Login success | ✅ | `routes/auth.ts` |
| Login failure | ✅ | `routes/auth.ts` |
| Logout | ✅ | `routes/auth.ts` |
| Password change | ✅ | `routes/auth.ts` |
| Password reset request | ✅ | `routes/auth.ts` |
| MFA enable/disable | ✅ | `routes/mfa.ts` |
| MFA verification failure | ✅ | `routes/mfa.ts` |
| Session expiry | ✅ | middleware |

### Student Data
| Event | Audited | Location |
|-------|:-------:|----------|
| Grade create | ✅ | `routes/grades` |
| Grade update | ✅ | `routes/grades` |
| Grade delete | ✅ | `routes/grades` |
| Grade export | ✅ | `routes/grades` |
| Attendance mark | ✅ | `routes/attendance.ts` |
| Attendance edit | ✅ | `routes/attendance.ts` |
| Student enroll | ✅ | `routes/students.ts` |
| Student remove | ✅ | `routes/students.ts` |

### File Operations
| Event | Audited | Location |
|-------|:-------:|----------|
| File upload | ✅ | `routes/upload.ts` |
| File download/view | ✅ | `app.ts` (/files route) |
| File delete | ✅ | `routes/upload.ts` |

### Admin Operations
| Event | Audited | Location |
|-------|:-------:|----------|
| User create | ✅ | `routes/admin-users.ts` |
| User edit | ✅ | `routes/admin-users.ts` |
| User delete | ✅ | `routes/admin-users.ts` |
| Permission grant/revoke | ✅ | `routes/admin-roles.ts` |
| Subscription change | ✅ | `routes/admin-subscriptions.ts` |
| Platform setting change | ✅ | `routes/admin-health.ts` |
| Export (bulk) | ✅ | `routes/user-export.ts` |

### AI Operations
| Event | Audited | Location |
|-------|:-------:|----------|
| AI generation request | ✅ | AI routes |
| AI cost threshold alert | ✅ | `routes/ai-costs.ts` |

### Gaps Found
| Event | Status | Recommendation |
|-------|--------|----------------|
| Bulk grade import | ⚠️ Partial | Log per-record changes, not just the import job |
| Question bank bulk delete | ⚠️ Missing | Add audit call in question-bank route |
| Revision plan delete | ⚠️ Missing | Add before-delete audit |

---

## Audit Log Retention

- **Hot storage** (PostgreSQL): 90 days
- **Export**: Admin can export audit logs as CSV (`GET /api/admin/audit/export`)
- **Recommended**: Archive to cold storage (S3/GCS) after 90 days for compliance

---

## Admin Audit UI

Audit logs are exposed through:
- `GET /api/admin/audit` — paginated log browser
- `GET /api/admin/audit/export` — CSV export (rate-limited to 10/hour for admins)
- `GET /api/admin/audit/stats` — aggregate summary by action type

---

## Compliance Notes

The audit system is sufficient for:
- **FERPA**: Student record access logging ✅
- **GDPR Article 30**: Processing activity records ✅
- **Internal investigations**: Full actor + IP + UA trail ✅
