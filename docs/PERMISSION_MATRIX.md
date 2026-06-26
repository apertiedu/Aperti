# Aperti V2 — Permission Matrix

> Generated: Phase 3 Production Hardening
> Source of truth: `artifacts/api-server/src/lib/authorization.ts` + `src/config/permissions.ts`

## Role Definitions

| Role | Description |
|------|-------------|
| `super_admin` | Platform-level omnipotent. No tenant scope. |
| `admin` | Tenant-scoped administrator. Cannot cross tenant boundaries. |
| `teacher` | Owns their own courses, exams, students. Isolated to their tenant. |
| `assistant` | Belongs to a teacher's tenant. Grading rights are per-permission. |
| `student` | Can only access their own records. |
| `parent` | Can only access their linked children's records. |

## Action Matrix

| Action | super_admin | admin | teacher | assistant | student | parent |
|--------|-------------|-------|---------|-----------|---------|--------|
| **access** | ✅ all | ✅ all | ✅ own | ✅ tenant | ✅ self | ✅ child |
| **modify** | ✅ all | ✅ all | ✅ own | ❌ | ❌ | ❌ |
| **delete** | ✅ all | ✅ all | ✅ own | ❌ | ❌ | ❌ |
| **export** | ✅ all | ✅ all | ✅ own | ❌ | ❌ | ❌ |
| **grade** | ✅ all | ✅ all | ✅ own | ✅ if_permitted | ❌ | ❌ |
| **moderate** | ✅ all | ✅ same_tenant | ✅ own | ❌ | ❌ | ❌ |

## Permission Details by Resource Type

### Exams
| Role | View | Create | Manage | Grade |
|------|------|--------|--------|-------|
| super_admin | ✅ | ✅ | ✅ | ✅ |
| admin | ✅ | ✅ | ✅ | ✅ |
| teacher | ✅ (own) | ✅ | ✅ (own) | ✅ (own) |
| assistant | ✅ | ❌ | ❌ | ✅ (if_permitted) |
| student | ✅ (take) | ❌ | ❌ | ❌ |
| parent | ❌ | ❌ | ❌ | ❌ |

### Students
| Role | View | Create | Manage | Export |
|------|------|--------|--------|--------|
| super_admin | ✅ | ✅ | ✅ | ✅ |
| admin | ✅ | ✅ | ✅ | ✅ |
| teacher | ✅ (own) | ❌ | ✅ (own) | ❌ |
| assistant | ✅ (tenant) | ❌ | ❌ | ❌ |
| student | ✅ (self) | ❌ | ❌ | ❌ |
| parent | ✅ (child) | ❌ | ❌ | ❌ |

### Files (Upload Registry)
| Role | Access | Upload | Delete |
|------|--------|--------|--------|
| super_admin | ✅ | ✅ | ✅ |
| admin | ✅ | ✅ | ✅ |
| teacher | ✅ (own + tenant) | ✅ | ✅ (own) |
| assistant | ✅ (tenant) | ✅ | ❌ |
| student | ❌ | ❌ | ❌ |
| parent | ❌ | ❌ | ❌ |

## Tenant Isolation Rules

1. **Teachers are their own tenant root.** Their `id` is stored as `teacher_account_id` on all child records.
2. **Assistants belong to exactly one teacher's tenant.** Their `accounts.teacher_account_id` determines which tenant they are in.
3. **Students belong to exactly one teacher's tenant.** Their `students.teacher_account_id` is the boundary.
4. **Admins are either platform-wide (`teacher_account_id IS NULL`) or scoped to a tenant.**
5. **Cross-tenant queries are impossible at the DB layer** when routes use `requireTenantAccess` middleware.
6. **`canModerate`** enforces that scoped admins cannot moderate across tenant lines.

## Upload Tenant Guarantee

Prior to Phase 3, assistant uploads incorrectly set `tenant_id = assistant.id`. This was fixed:
- **Before:** `tenant_id = req.userId` (wrong for assistants)
- **After:** `tenant_id = accounts.teacher_account_id` (correct — links to teacher's tenant)

This ensures all file ownership checks in `/files/:filename` resolve correctly.
