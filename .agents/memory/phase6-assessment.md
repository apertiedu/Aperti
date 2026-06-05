---
name: Phase 6 Assessment Ecosystem
description: 13 new DB tables, 8 route files/additions, 16 frontend pages for the complete assessment lifecycle
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

`question_bank` updated: added `version`, `version_history`, `usage_stats`, `command_word`, `paper_type`, `year_first_seen`, `subject_name`.

## Route Files (Phase 6)

| File | Key responsibility |
|------|--------------------|
| `assessment-hub.ts` | Assessment CRUD, sections, questions, QB search + versioning |
| `exam-session.ts` | Secure exam delivery: start/heartbeat/end/status |
| `assessment-grading.ts` | Auto-grade, manual, moderate, gradebook, reports, appeals |
| `certifications.ts` | Certificates issue/verify/revoke, transcripts |
| `assessment-extras.ts` | Archives, monitoring, AI readiness analytics, AI question generation, submission results |

All registered in `routes/index.ts` at the bottom.

## Frontend Pages — Complete List

### Teacher/Admin pages
| Page | Route | File |
|------|--------|------|
| Assessment Hub (original) | `/assessment-hub` | `pages/assessment-hub.tsx` |
| Assessments (wizard) | `/teacher/assessments` | `pages/teacher/assessments.tsx` |
| Assessment Builder | `/teacher/assessments/:id/builder` | `pages/teacher/assessment-builder.tsx` |
| Assessment Monitor | `/teacher/assessments/:id/monitor` | `pages/teacher/assessment-monitor.tsx` |
| Gradebook+ (original) | `/gradebook-plus` | `pages/gradebook-plus.tsx` |
| Gradebook (spreadsheet) | `/teacher/gradebook` | `pages/teacher/gradebook.tsx` |
| Standardization Centre | `/teacher/moderation` | `pages/teacher/moderation.tsx` |
| Exam Archives | `/teacher/archives` | `pages/teacher/archives.tsx` |
| Certifications (original) | `/certifications` | `pages/certifications.tsx` |
| Cert Admin | `/admin/certificates` | `pages/admin/certificates.tsx` |

### Student pages
| Page | Route | File |
|------|--------|------|
| Exam Room (lobby) | `/exam-room` | `pages/student/exam-room.tsx` |
| Exam Session (take exam) | `/student/exams/:id` | `pages/student/exam-session.tsx` |
| Exam Results | `/student/exams/:id/results` | `pages/student/exam-results.tsx` |
| Transcript | `/student/transcript` | `pages/student/transcript.tsx` |
| Appeals | `/student/appeals` | `pages/student/appeals.tsx` |
| Exam Readiness | `/student/exam-readiness` | `pages/student/exam-readiness.tsx` |

## Layout Wiring

`layout.tsx` additions:
- Teaching: `Assessments` → `/teacher/assessments` (GraduationCap)
- Insights: `Gradebook` → `/teacher/gradebook` (TableProperties), `Moderation` → `/teacher/moderation` (Scale)
- Manage: `Cert Admin` → `/admin/certificates` (Award, admin-only), `Archives` → `/teacher/archives` (Archive)
- Lucide imports needed: `Scale, Archive` (added to existing import line)

`student-layout.tsx` additions (allNav):
- Exam Readiness → `/student/exam-readiness` (Target)
- Transcript → `/student/transcript` (FileText)
- Appeals → `/student/appeals` (MessageSquare)

## Key Patterns & Decisions

**Multi-step wizard** (TeacherAssessments): 4 steps — Type → Details → Security → Review. Security levels: low/medium/high (controls tab monitoring, back navigation, shuffle).

**Assessment Builder** (`/teacher/assessments/:id/builder`): Sections panel (left) + questions panel (right) + collapsible bank drawer. AI generation via `POST /assessments/:id/generate-questions` using openaiChat().

**Exam Monitor** (`/teacher/assessments/:id/monitor`): auto-refreshes every 15s via `refetchInterval`. Shows tab_switches, focus_losses. Teacher can extend time (patches device_info JSON) or end exam.

**Student Exam Session** (`/student/exams/:id`): 3 phases — lobby → exam → submitted. Anti-cheat: heartbeat every 20s, visibilitychange+blur events, copy/cut/contextmenu blocked. No `window.location` redirects — local state machine.

**Exam Readiness**: Calls `GET /api/analytics/exam-readiness/:studentId`. Computes readiness = mockAvg * 0.5 + quizAvg * 0.3 + (100 - weakTopics * 5) * 0.2. Then calls AI for predicted grade, confidence, summary, recommendations.

**Gradebook spreadsheet**: pivots `GradebookEntry[]` into `StudentRow[]` with per-assessment columns. Client-side pivot (max 8 assessment columns shown).

**Auto-grading**: MCQ → exact match; short_answer → substring; written → AI via openaiChat() returning `{marks, feedback, strength, improvement}`. Falls back if AI unavailable.

**IGCSE grading**: A*≥90, A≥80, B≥70, C≥60, D≥50, E≥40, F≥30, G≥20, U. Helper defined in assessment-grading.ts AND copied to client-side pages (igcseGrade function).

**ON CONFLICT for upserts**: coursework_projects and oral_recordings use ON CONFLICT (assessment_id, student_id) — requires the unique indexes.

**Why separate route files**: assessment-hub (builder), exam-session (security/delivery), assessment-grading (grading/reporting), certifications (credentials), assessment-extras (monitoring/analytics/archives) — each bounded responsibility.

**student-layout icons**: Target, FileText, MessageSquare were already imported. GraduationCap was already imported. No new imports needed for student-layout.

**layout.tsx icons**: needed to add `Scale` (moderation) and `Archive` (exam archives) to the lucide-react import.
