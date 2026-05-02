# Workspace

## Overview

**Aperti** — a full-stack educational SaaS platform for managing student attendance, exams/marks, analytics, and multi-role access for tutoring centres.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS (`artifacts/aperti`)
- **API framework**: Express 5 (`artifacts/api-server`)
- **Database**: PostgreSQL + Drizzle ORM (`lib/db`)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec in `lib/api-spec`)
- **Charts**: Recharts
- **Build**: esbuild (CJS bundle)

## Roles

- **Admin** — full access, account management, all data
- **Teacher** — own data only (students, sessions, subjects, exams, analytics)
- **Assistant** — limited access (attendance, students, exams mark entry only)

Default admin credentials: `admin` / `aperti2024`

## Features

### Core
- Multi-role authentication (admin/teacher/assistant) with role-based sidebar nav
- Session-based auth with PostgreSQL session store
- Collapsible sidebar with role badge

### Students
- Add, edit, delete, bulk-import students
- Fields: code, name, phone, parent phone, notes, status (active/suspended)
- Assign up to 3 lesson sessions per student
- Teacher isolation (each teacher sees only their students)

### Sessions
- Weekly recurring sessions (lesson 1/2/3, day, time)
- Session type: **centre** (with optional seat capacity) or **online** (with meeting link)
- Subject assignment per session
- Capacity tracking (present vs capacity)

### Subjects
- Create/edit/delete subjects per teacher
- Linked to sessions and exams

### Attendance
- Mark attendance by student code (manual or QR scan)
- Auto-absence marking for the week
- Capacity enforcement for centre sessions
- CSV export per week

### Exams & Marks
- Create exams with optional subject/date/total marks
- Question builder (topic, max marks, ordering)
- Mark entry grid (per student × per question, with mistake notes)
- Results view with auto-calculated percentages and IGCSE letter grades
- Drill-down UX (exam list → detail → mark grid → results)

### Analytics
- KPI cards: total students, attendance rate, present/absent counts
- Per-session attendance bar chart
- Predicted IGCSE grade distribution chart
- Top performers and at-risk student panels
- Most absent students list
- Full student performance table with predicted grades (70% exam + 30% attendance weighting)
- Session type breakdown (online vs centre)

### Admin Panel (admin only)
- Create/edit/delete all accounts
- Set role (admin/teacher/assistant) and status (active/suspended)
- Assign assistants to teachers
- Stats summary (admins, teachers, assistants, suspended)

## Database Schema

- `accounts` — id, username, password_hash, display_name, role, status, teacher_account_id, created_at
- `subjects` — id, name, teacher_account_id, created_at
- `sessions` — id, lesson_number, day_of_week, start_time, type, capacity, subject_id, teacher_account_id, online_link, created_at
- `students` — id, student_code, student_name, phone, parent_phone, notes, status, teacher_account_id, lesson1/2/3_session_id, created_at
- `attendance` — id, student_id, session_id, date, status, marked_at
- `exams` — id, name, subject_id, teacher_account_id, exam_date, total_marks, created_at
- `exam_questions` — id, exam_id, parent_id, question_text, topic, max_marks, question_order
- `student_marks` — id, student_id, exam_id, question_id, marks_scored, mistakes, marked_at

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks from OpenAPI spec
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Important Notes

- Do NOT use `console.log` in server code — use `req.log` or `logger`
- Do NOT import `zod` directly in `api-server` routes — use `@workspace/api-zod` exports or manual validation
- Sessions are weekly recurring templates (not date-specific)
- Teacher isolation: admin sees all, teacher sees own data, assistant sees teacher's data
- Auto-absence marks one absence per lesson per student per week based on assigned sessions
- QR codes encode the `studentCode` string
- Analytics predicted grade: 70% exam score + 30% attendance rate → A*–U scale

See the `pnpm-workspace` skill for workspace structure and TypeScript setup.
