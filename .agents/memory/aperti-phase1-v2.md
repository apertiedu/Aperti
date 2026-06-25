---
name: Aperti Phase 1 V2 mission
description: Tenant isolation fix, Labs/SimVerse removal, human grading authority — decisions and conventions to maintain.
---

## Tenant isolation fix (T001)
`requireTenantAccess` in `artifacts/api-server/src/middleware/tenant.ts` was broken for assistants because JWT only carries `{id, role}`, not `_account`. Fixed by querying `accountsTable` for `teacherAccountId` when role=assistant. The function is now `async`.

**Why:** Assistants could previously access any tenant's data — critical security hole.

## Labs / SimVerse removal (T002 + T003)
Completely removed. Do not re-add:
- **Deleted files:** `student-portal/labs/*.tsx`, `student/labs/*.tsx` (7 page files)
- **Schema removed:** `labConfigurationsTable`, `geometrixSessionsTable` from `phase15-content.ts`
- **Type exports removed:** `LabConfiguration`, `GeometrixSession`
- **Frontend refs cleared:** route-registry.ts, study-stream.tsx, learning-path.tsx, checkout.tsx, sitemap.tsx, PlatformConfigPage.tsx, kudos-engine.tsx, content-craft.tsx, DocsPage.tsx
- **ContentCraft `SectionType`:** "simulation" removed from the type union, icon/color maps, and SelectItem.

**Why:** SimVerse/Labs was a planned feature that was never completed. Dead code with unresolvable DB tables.

## Human grading authority (T004 + T005 + T006)
AI is advisory only — never sets the official grade.

### Status lifecycle
```
pending  → AI has suggested / teacher has not reviewed
graded   → Teacher has confirmed the mark (saved but not released)
approved → Officially released; student can now see the grade
```

### Schema changes
| Table | New columns |
|---|---|
| `student_marks` | `grading_status` (default 'pending'), `gradedAt`, `approvedAt`, `approvedBy`, `aiSuggestedMarks`, `aiConfidence` |
| `snapgrade_submissions` | `grading_status` (default 'pending'), `aiSuggestedGrade`, `aiConfidence`, `gradedAt`, `approvedAt`, `approvedBy`, `requiresReview` |
| `homework_submissions` | `grading_status` (default 'pending'), `approvedAt`, `approvedBy` |
| `assistant_permissions` | `autoApproveGrades` boolean (default false) |
| **new** `grade_approval_logs` | immutable audit trail of every grading action |

### Route contracts
- `POST /api/snapgrade/scan` → stores AI result in `aiSuggestedGrade`; `grade = null`; `gradingStatus = 'pending'`
- `PUT /api/snapgrade/submissions/:id/review` → teacher approve/modify/reject → sets `grade` + `gradingStatus = 'approved'` (or 'pending' on reject)
- `POST /api/grading/submission/:id/grade` → stores AI result in `aiSuggestedMarks` only; `gradingStatus = 'pending'`
- `POST /api/grading/submission/:id/approve` → teacher sets official `marksScored` → `gradingStatus = 'graded'` or `'approved'`

### Student visibility
- `GET /api/exams/:id` → marks filtered to `gradingStatus = 'approved'` when caller is a student
- `GET /api/homework/:id/my-submission` → `marksAwarded` + `teacherFeedback` masked (`null`) unless `gradingStatus = 'approved'`; response includes `gradeReleased: boolean`

### Teacher-entered marks
`POST /api/exams/:id/marks` (direct teacher entry, no AI) sets `gradingStatus = 'graded'` immediately — teacher has already reviewed, but still needs an explicit approve to release.
