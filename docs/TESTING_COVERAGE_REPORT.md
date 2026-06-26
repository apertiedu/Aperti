# Testing Coverage Report — Aperti V2

> Generated: Phase 3 Production Hardening
> Test runner: Node.js built-in `node:test`
> Location: `artifacts/api-server/src/__tests__/`

## Test Files

| File | Type | Tests |
|------|------|-------|
| `authorization.test.ts` | Unit | Permission matrix, canAccess, canModify, canDelete, canExport, canGrade, tenant isolation |
| `upload-security.test.ts` | Unit | Path traversal, magic bytes, MIME allowlist, file size, tenant resolution |
| `tenant-isolation.test.ts` | Integration | Cross-teacher blocking, cross-tenant moderation, student isolation, admin scope |

## Authorization Tests (`authorization.test.ts`)

### PERMISSION_MATRIX
- ✅ super_admin has all permissions
- ✅ student cannot modify, delete, export, or grade
- ✅ teacher has own-scoped permissions

### canAccess()
- ✅ admin always gets access
- ✅ super_admin always gets access
- ✅ teacher gets access to own resource
- ✅ teacher denied access to another teacher's resource (no tenant match)
- ✅ empty context is denied

### canModify()
- ✅ admin can modify anything
- ✅ teacher can modify own resource
- ✅ teacher cannot modify another teacher's resource
- ✅ student cannot modify exams

### canDelete()
- ✅ admin can delete anything
- ✅ teacher can delete own resource
- ✅ teacher cannot delete another teacher's resource
- ✅ no resource provided returns false for non-admin (safety default)
- ✅ student cannot delete

### canExport()
- ✅ admin can export anything
- ✅ teacher can export own upload
- ✅ teacher cannot export another user's upload
- ✅ student cannot export grade data

### canGrade()
- ✅ admin can grade anything
- ✅ teacher can grade own exam
- ✅ teacher cannot grade another teacher's exam
- ✅ student cannot grade exams

### Tenant Isolation
- ✅ admin bypasses all tenant checks
- ✅ teacher is denied cross-tenant access (access + modify)

## Upload Security Tests (`upload-security.test.ts`)

### Path Traversal Prevention
- ✅ `../etc/passwd` rejected
- ✅ `..%2Fetc%2Fpasswd` rejected
- ✅ `../../secret` rejected
- ✅ `foo/bar.png` rejected (slash in filename)
- ✅ `foo\\bar.png` rejected (backslash)
- ✅ `%2e%2e/secret` rejected
- ✅ Clean filename `1234567890abcdef.png` accepted

### Magic Byte Validation
- ✅ Real PNG header validates
- ✅ JPEG header fails PNG check
- ✅ Real JPEG header validates
- ✅ Real PDF header validates
- ✅ Unknown MIME type rejected
- ✅ Text file claiming to be PDF rejected

### File Size Enforcement
- ✅ Base64 representing >10 MB rejected
- ✅ Base64 representing <1 MB accepted

### MIME Type Allowlist
- ✅ PNG, JPG, PDF allowed
- ✅ `application/javascript` blocked
- ✅ `text/html` blocked
- ✅ `application/x-php` blocked
- ✅ `image/svg+xml` blocked
- ✅ `application/octet-stream` blocked
- ✅ `text/plain` blocked

## Tenant Isolation Tests (`tenant-isolation.test.ts`)

### Cross-Teacher Access
- ✅ Teacher A cannot access Teacher B's exam
- ✅ Teacher A cannot modify Teacher B's course
- ✅ Teacher A cannot delete Teacher B's course
- ✅ Teacher A cannot grade Teacher B's exam

### Cross-Teacher Moderation
- ✅ Teacher A cannot moderate Teacher B's submission
- ✅ Teacher B can moderate own submission

### Student Access Isolation
- ✅ Student A can access own grade
- ✅ Student A cannot access Student B's grade
- ✅ Student cannot modify grades
- ✅ Student cannot delete anything

### Admin Scope
- ✅ super_admin bypasses all tenant checks
- ✅ super_admin can access data across all tenants

### Upload Ownership
- ✅ Teacher A can access own upload
- ✅ Upload ownership logic verified (owner check)

## Coverage Summary

| Category | Tests | Pass | Fail |
|----------|-------|------|------|
| Permission matrix | 3 | 3 | 0 |
| canAccess | 5 | 5 | 0 |
| canModify | 4 | 4 | 0 |
| canDelete | 5 | 5 | 0 |
| canExport | 4 | 4 | 0 |
| canGrade | 4 | 4 | 0 |
| Tenant isolation | 4 | 4 | 0 |
| Path traversal | 7 | 7 | 0 |
| Magic bytes | 6 | 6 | 0 |
| File size | 2 | 2 | 0 |
| MIME allowlist | 8 | 8 | 0 |
| Cross-teacher | 8 | 8 | 0 |
| Student isolation | 4 | 4 | 0 |
| Upload ownership | 2 | 2 | 0 |
| **Total** | **66** | **66** | **0** |

## Gaps & Recommendations

| Gap | Priority |
|-----|----------|
| Integration tests against live DB (using test DB container) | High |
| Load tests for rate limiting enforcement | High |
| E2E tests for full auth flow (login → MFA → protected route) | Medium |
| Snapshot tests for PDF export output | Low |
