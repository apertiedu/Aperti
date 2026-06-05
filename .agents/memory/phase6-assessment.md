---
name: Phase 6 Assessment Ecosystem
description: 13 new DB tables, 4 route files, 4 frontend pages for the full assessment lifecycle
---

## DB Tables Created (Phase 6)

All created with `CREATE TABLE IF NOT EXISTS` via executeSql. Key constraints:

- `assessments` — unique constraint: none; indexes on teacher_id + status
- `assessment_submissions` — **UNIQUE INDEX on (assessment_id, student_id)** — only one submission per student per assessment
- `coursework_projects` — **UNIQUE INDEX on (assessment_id, student_id)** — added in a second migration
- `oral_recordings` — **UNIQUE INDEX on (assessment_id, student_id)** — added in a second migration
- `certificates` — **UNIQUE on unique_code** — generated as `APT-{hex8}-{base36timestamp}` 
- `exam_sessions` — **UNIQUE on session_token** — generated with `crypto.randomUUID()`
- `gradebook_settings` — **UNIQUE on teacher_id** — upserted via ON CONFLICT

`question_bank` updated: added `version` (int default 1), `version_history` (jsonb), `usage_stats` (jsonb), `command_word`, `paper_type`, `year_first_seen`, `subject_name`.

`rubrics` table created if not exists (separate from old schema that only had a `rubric` jsonb column on lessons).

## Route Files

All 4 files in `artifacts/api-server/src/routes/`:

| File | Prefix | Key responsibility |
|------|--------|--------------------|
| `assessment-hub.ts` | (root) | Assessment CRUD, sections, questions, publish/start/submit, QB advanced search & versioning |
| `exam-session.ts` | `/exam-session` | Start session (returns token), heartbeat (tab tracking), end, status |
| `assessment-grading.ts` | (root) | Auto-grade (MCQ + AI written), manual grade, moderate, coursework, practicals, oral, gradebook, reports, appeals |
| `certifications.ts` | (root) | Issue/get/revoke certificates, verify by code (public), transcripts generate/list |

All registered in `routes/index.ts` at the bottom, after `parentAiRouter`.

## Frontend Pages

| Page | Path | Role | Location |
|------|------|------|----------|
| `assessment-hub.tsx` | `/assessment-hub` | teacher/admin | `pages/assessment-hub.tsx` |
| `gradebook-plus.tsx` | `/gradebook-plus` | teacher/admin | `pages/gradebook-plus.tsx` |
| `certifications.tsx` | `/certifications` | teacher/admin | `pages/certifications.tsx` |
| `exam-room.tsx` | `/exam-room` | student | `pages/student/exam-room.tsx` |

## Layout Wiring

`layout.tsx` additions:
- **Teaching** group: `Assessment Hub` → `/assessment-hub` (GraduationCap icon)
- **Insights** group: `Gradebook+` → `/gradebook-plus` (TableProperties icon) — at top of group
- **Manage** group: `Certifications` → `/certifications` (Medal icon) — at top of group

`student-layout.tsx` additions:
- `allNav`: `Exam Room` → `/exam-room` (GraduationCap icon)

New lucide icons added to layout.tsx imports: `GraduationCap`, `TableProperties`, `Medal`

## Key Patterns & Decisions

**Auto-grading**: MCQ → exact match; short_answer → substring match; written → AI via `openaiChat()` returning JSON `{marks, feedback, strength, improvement}`. Falls back gracefully if AI unavailable.

**Exam security**: `exam_sessions` table tracks `tab_switches` + `focus_losses` via heartbeat every 15s. Frontend uses `visibilitychange` + `blur` events. Flags bubble into `assessment_submissions.security_flags`.

**Student lookup**: All student routes get studentId via `SELECT id FROM students WHERE account_id=$1`. Teachers pass teacher_id = req.userId directly.

**ON CONFLICT for upserts**: coursework_projects and oral_recordings use ON CONFLICT (assessment_id, student_id) — requires the unique indexes created in the second migration.

**IGCSE grading**: A*≥90, A≥80, B≥70, C≥60, D≥50, E≥40, F≥30, G≥20, U otherwise. Helper `igcseGrade()` defined locally in assessment-grading.ts.

**Why separate route files**: assessment-hub (builder), exam-session (security/delivery), assessment-grading (grading/reporting), certifications (credentials) — each has a clearly bounded responsibility. All registered flat in routes/index.ts.
