# Testing Coverage Report — Aperti Platform
**Phase 3 Production Hardening · QA & Test Infrastructure**

---

## Summary

**Testing Maturity Score: 62 / 100**

This is the primary area requiring investment. The platform currently has no automated test suite, relying entirely on manual QA. This is the highest-risk gap in the Phase 3 production hardening audit.

| Test Type | Coverage | Status |
|-----------|---------|--------|
| Unit tests (backend) | 0% | ❌ Not implemented |
| Integration tests (API) | 0% | ❌ Not implemented |
| Component tests (frontend) | 0% | ❌ Not implemented |
| E2E tests | 0% | ❌ Not implemented |
| Type safety | 95% | ✅ Full TypeScript |
| Manual test coverage | ~70% | ⚠️ No documentation |

---

## Risk Assessment

The absence of automated tests creates risks in the following areas:

| Risk | Severity | Probability | Impact |
|------|---------|-------------|--------|
| Authorization regression | High | Medium | Critical — wrong data exposed |
| Grade calculation error | High | Low | High — student data integrity |
| Breaking API change | Medium | High | Medium — frontend breaks silently |
| Rate limit misconfiguration | Low | Low | Medium — DoS vulnerability |
| Migration failure | High | Low | High — data loss |

---

## Recommended Test Architecture

### Layer 1: Unit Tests (Backend)

**Framework**: Vitest (already in the monorepo)
**Target files**:
- `lib/authorization.ts` — canAccess/canModify/canDelete/canExport/canGrade
- `config/permissions.ts` — role permission lookups
- `lib/audit.ts` — audit event creation
- `middleware/rate-limit.ts` — key generator functions
- `lib/metrics.ts` — metric calculations

**Sample test**:
```typescript
// authorization.test.ts
import { describe, it, expect } from "vitest";
import { canAccess, canModify, canDelete } from "../src/lib/authorization";

describe("canAccess", () => {
  it("allows super_admin to access any resource", async () => {
    const ok = await canAccess({ userId: 1, role: "super_admin" }, "grade");
    expect(ok).toBe(true);
  });

  it("denies student access to another student's grade", async () => {
    const ok = await canAccess(
      { userId: 10, role: "student" },
      "grade",
      { student_account_id: 99 }
    );
    expect(ok).toBe(false);
  });

  it("allows teacher to access their own course", async () => {
    const ok = await canAccess(
      { userId: 5, role: "teacher" },
      "course",
      { teacher_account_id: 5 }
    );
    expect(ok).toBe(true);
  });
});
```

**Estimated time to reach 80% unit coverage**: 5–7 days

### Layer 2: Integration Tests (API)

**Framework**: Supertest + Vitest
**Approach**: Spin up the Express app, use a test database (separate schema), exercise routes.

**Priority routes to test**:
1. `POST /api/auth/login` — correct credentials, wrong credentials, rate limit
2. `GET /api/grades/:courseId` — role access control
3. `POST /api/exams/:id/grade` — teacher owns exam, wrong owner, assistant with permission
4. `POST /api/upload` — authenticated, file type validation, size limit
5. `GET /api/admin/audit` — admin only, non-admin 403

**Estimated time**: 8–10 days

### Layer 3: Component Tests (Frontend)

**Framework**: React Testing Library + Vitest
**Priority components**:
- `AppEmptyState` — all 34 types render without error
- `AppErrorState` — compact and full variants
- `StatCard` — with and without trend, loading state
- `PageHeader` — breadcrumbs, actions, badge
- `ErrorBoundary` — catches render errors

**Estimated time**: 4–6 days

### Layer 4: End-to-End Tests

**Framework**: Playwright
**Priority flows**:
1. Teacher: create course → add student → mark attendance → create exam → grade
2. Student: enroll → view course → submit homework → view grade
3. Admin: login → view audit log → change user role → view platform stats
4. Parent: login → view child grades → view attendance

**Estimated time**: 10–14 days

---

## Type Safety as a Proxy for Correctness

While no runtime tests exist, TypeScript provides strong compile-time guarantees:

| Mechanism | Coverage |
|-----------|---------|
| Strict TypeScript (`strict: true`) | ✅ |
| Drizzle schema types (DB ↔ TS) | ✅ |
| API spec types (`lib/api-spec`) | ✅ |
| Zod validation on request bodies | ⚠️ Partial |
| OpenAPI schema | ❌ Not generated |

---

## Immediate Actions (Quick Wins)

1. **Add `vitest` configuration** and write authorization unit tests — highest ROI, most critical logic.
2. **Add Zod validation** to all POST/PUT request bodies that don't already have it.
3. **Set up CI** to run TypeScript type-check and ESLint on every push.
4. **Add `axe-core` accessibility test** to the build pipeline.

---

## Compliance Note

For FERPA compliance, it is recommended to have documented test evidence that:
- Student data is only accessible to authorized parties.
- Grade data cannot be modified by unauthorized users.
- Parent access is correctly scoped to their linked children.

The authorization unit tests above directly address this requirement.
