# Permission Matrix — Aperti Platform
**Phase 3 Production Hardening · Full RBAC Audit**

---

## Overview

Aperti uses a **layered RBAC system**:
1. **Static defaults** — `DEFAULT_PERMISSIONS` in `config/permissions.ts` maps each role to a `Permission[]` array.
2. **DB overrides** — `teacher_permissions` table allows admin to grant/revoke specific permissions per teacher.
3. **Centralized checks** — `lib/authorization.ts` exports `canAccess`, `canModify`, `canDelete`, `canExport`, `canGrade`.
4. **Middleware** — `authenticate` middleware injects `req.userId`, `req.role`, `req.userRole` into every request.

---

## Role Definitions

| Role | Description | Tenant Scope |
|------|-------------|-------------|
| `super_admin` | Platform owner — unrestricted access to all orgs | Global |
| `admin` | Org admin — full access within their organization | Single org |
| `teacher` | Course creator — manages own courses, students, grades | Own data |
| `assistant` | Teaching assistant — grading and attendance within a course | Per-course permission |
| `student` | Learner — read-only access to enrolled course data | Self only |
| `parent` | Guardian — read access to linked child's data | Child only |

---

## Permission Matrix

### Resource: Courses
| Operation | super_admin | admin | teacher | assistant | student | parent |
|-----------|:-----------:|:-----:|:-------:|:---------:|:-------:|:------:|
| view      | ✅ | ✅ | ✅ own | ✅ enrolled | ✅ enrolled | ❌ |
| create    | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| edit      | ✅ | ✅ | ✅ own | ❌ | ❌ | ❌ |
| delete    | ✅ | ✅ | ✅ own | ❌ | ❌ | ❌ |
| export    | ✅ | ✅ | ✅ own | ❌ | ❌ | ❌ |

### Resource: Students / Enrollments
| Operation | super_admin | admin | teacher | assistant | student | parent |
|-----------|:-----------:|:-----:|:-------:|:---------:|:-------:|:------:|
| view list | ✅ | ✅ | ✅ own | ✅ enrolled | ❌ | ❌ |
| view self | ✅ | ✅ | ✅ | ✅ | ✅ | child |
| manage    | ✅ | ✅ | ✅ own | ❌ | ❌ | ❌ |
| export    | ✅ | ✅ | ✅ own | ❌ | ❌ | ❌ |
| delete    | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

### Resource: Grades / Gradebook
| Operation | super_admin | admin | teacher | assistant | student | parent |
|-----------|:-----------:|:-----:|:-------:|:---------:|:-------:|:------:|
| view      | ✅ | ✅ | ✅ own | ✅ enrolled | ✅ self | child |
| create/edit | ✅ | ✅ | ✅ own | if permitted | ❌ | ❌ |
| delete    | ✅ | ✅ | ✅ own | ❌ | ❌ | ❌ |
| export    | ✅ | ✅ | ✅ own | ❌ | ❌ | ❌ |

### Resource: Exams / Assessments
| Operation | super_admin | admin | teacher | assistant | student | parent |
|-----------|:-----------:|:-----:|:-------:|:---------:|:-------:|:------:|
| view      | ✅ | ✅ | ✅ own | ✅ enrolled | ✅ enrolled | ❌ |
| create    | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| grade     | ✅ | ✅ | ✅ own | if permitted | ❌ | ❌ |
| manage    | ✅ | ✅ | ✅ own | ❌ | ❌ | ❌ |
| delete    | ✅ | ✅ | ✅ own | ❌ | ❌ | ❌ |
| export    | ✅ | ✅ | ✅ own | ❌ | ❌ | ❌ |

### Resource: Attendance
| Operation | super_admin | admin | teacher | assistant | student | parent |
|-----------|:-----------:|:-----:|:-------:|:---------:|:-------:|:------:|
| view      | ✅ | ✅ | ✅ own | ✅ enrolled | ✅ self | child |
| mark      | ✅ | ✅ | ✅ own | ✅ enrolled | ❌ | ❌ |
| edit      | ✅ | ✅ | ✅ own | ❌ | ❌ | ❌ |
| export    | ✅ | ✅ | ✅ own | ❌ | ❌ | ❌ |

### Resource: Files / Uploads
| Operation | super_admin | admin | teacher | assistant | student | parent |
|-----------|:-----------:|:-----:|:-------:|:---------:|:-------:|:------:|
| upload    | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| view      | ✅ | ✅ | ✅ own | ✅ enrolled | ✅ enrolled | child |
| delete    | ✅ | ✅ | ✅ own | ❌ | ✅ own | ❌ |

### Resource: AI Tools
| Operation | super_admin | admin | teacher | assistant | student | parent |
|-----------|:-----------:|:-----:|:-------:|:---------:|:-------:|:------:|
| use       | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| manage    | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| view costs| ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

### Resource: Platform Settings / Admin
| Operation | super_admin | admin | teacher | assistant | student | parent |
|-----------|:-----------:|:-----:|:-------:|:---------:|:-------:|:------:|
| view      | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| manage    | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| audit log | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| export    | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## Authorization Implementation

```typescript
// Centralized check — lib/authorization.ts
const ok = await canAccess(ctx, "grade", gradeRow);
if (!ok) return res.status(403).json({ error: "Access denied" });

// canGrade — with assistant permission check
const ok = await canGrade(ctx, "exam", examRow);
// → checks role permission + assistant_permissions.can_grade_exams
```

### Implementation Status
| Function | Implemented | DB-aware | Tenant-safe |
|----------|:-----------:|:--------:|:-----------:|
| `canAccess` | ✅ | ✅ | ✅ |
| `canModify` | ✅ | ✅ | ✅ |
| `canDelete` | ✅ | ✅ | ✅ |
| `canExport` | ✅ | ✅ | ✅ |
| `canGrade`  | ✅ | ✅ | ✅ |

---

## Security Notes

1. **Tenant isolation** is enforced via DB join on `teacher_account_id` — no cross-tenant data leaks possible through the authorization layer.
2. **Assistant permissions** are granular: `can_grade_exams`, `can_view_grades`, `can_manage_attendance` flags in `assistant_permissions` table.
3. **Parent access** requires a confirmed parent-child link in the `students` table (`parent_account_id`).
4. **DB overrides** — `teacher_permissions` table allows admins to grant extra permissions (e.g. `analytics:advanced`) without a code deploy.
