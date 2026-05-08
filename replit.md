# Workspace

## Overview

**Aperti** — a full multi-tenant educational SaaS platform for managing student attendance, exams/marks, analytics, and multi-role access for tutoring centres and academies.

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

## Roles & Access

- **Admin** — full access, account management, all teacher data
- **Teacher** — STRICTLY isolated workspace (own students/sessions/exams/analytics only)
- **Assistant** — limited access, scoped to assigned teacher's data

Default admin: `admin` / `aperti2024`

## CRITICAL SECURITY: Multi-Tenant Architecture

Every backend route is protected by `requireTenantAccess` middleware (`artifacts/api-server/src/middleware/tenant.ts`):
- Derives teacher identity ONLY from `req.session` — NEVER from request body/params
- Injects `req.tenant` context: `{ accountId, teacherId, isAdmin, role }`
- Admin: `teacherId = null` (access all), Teacher: `teacherId = accountId`, Assistant: `teacherId = teacherAccountId`
- All DB queries filter by `teacherAccountId` using tenant context
- Cross-tenant access returns 403

## Features

### Core Platform
- Multi-role authentication (admin/teacher/assistant) with role-based sidebar nav
- Collapsible sidebar with role badge
- Command palette (⌘K) — keyboard navigation across all pages
- Notification bell — 30s polling, unread badge, mark read/delete
- Organizations table — future multi-org scalability (default org seeded)
- Audit logs — tracks all significant actions with account, IP, resource

### Students
- Add, edit, delete, bulk-import students
- Fields: code, name, phone, parent phone, notes, status (active/suspended)
- Assign up to 3 lesson sessions per student
- Full academic profile page per student (click chart icon in students table)
- Teacher isolation: each teacher's students are invisible to others

### Student Academic Profile (`/students/:id`)
- KPI cards: attendance rate, exam average, predicted IGCSE grade, risk level
- AI-style insight engine — generates contextual text summaries (rule-based):
  - Attendance drop/improvement alerts
  - Topic weakness/strength callouts
  - Exam trend analysis
- GitHub-style attendance heatmap (26 weeks, color-coded)
- Recent vs. prior 4-week attendance comparison
- Exam performance line chart (trend over time)
- Topic mastery horizontal bar chart
- Full exam results table with IGCSE letter grades
- Risk score (0-100) based on attendance + exam performance

### Sessions
- Weekly recurring sessions (lesson 1/2/3, day, time)
- Session type: **centre** (optional capacity) or **online** (meeting link)
- Subject assignment per session

### Subjects
- Per-teacher subject library

### Attendance
- Mark by student code (manual or QR scan)
- Auto-absence marking for the week
- Capacity enforcement for centre sessions
- CSV export per week

### Exams & Marks
- Exam lifecycle: create → question builder (topic/marks) → mark grid → results
- Results with auto-calculated percentages and IGCSE grades
- Question import from Question Bank
- **MCQ Question Builder** — toggle between Written/Structured and Multiple Choice (MCQ) per question; 4 option inputs A/B/C/D with click-to-select correct answer; MCQ questions auto-scored on online exam submit; correct answer shown in teacher view with ✓ badge
- **Online Exam Time Limit** — teachers set per-exam time limit (minutes) at creation; shown on exam card and detail view with clock icon; feeds directly into online exam session timer

### Timetable (`/timetable` for teachers, `/timetable` for students)
- Teacher view: week grid (Mon–Sun columns) + list view toggle; color-coded by day; each session card shows time, lesson number, subject, type (centre/online), student count, join link for online sessions; KPI cards (total sessions, active days, online count); "Today" badge highlights current day
- Student view: same route `/timetable`; shows only the student's own assigned sessions (lesson1/2/3); "Today" + "Next" session highlighted at top; full weekly breakdown below; online sessions show "Join" link

### Question Bank (`/question-bank`)
- Per-teacher reusable question library
- Fields: question text, topic, subtopic, difficulty, max marks, model answer, common mistakes, tags
- Filter by subject, difficulty, search
- Import questions directly into exams
- Usage counter per question
- Stats: total, easy/medium/hard counts

### AI Exam Generator (`/exam-generator`)
- Rule-based exam auto-generation from question bank
- Modes: Easy, Medium, Hard, Mixed, Predicted (most-used Qs), Topic Drill
- Topic multi-select chips (loads live from question bank)
- Question count slider (1–50)
- Creates real exam + exam_questions in DB with `times_used` tracking
- Result screen: difficulty breakdown bar chart, topics used, total marks
- Route: `POST /api/exams/generate`, `GET /api/exams/generate/topics`

### Past Paper Library (`/past-papers` for admin/teacher, `/portal/papers` for students)
- `past_papers` DB table: title, subject, year, session, variant, paper_number, file_url, mark_scheme_url, examiner_report_url
- Admin: upload/edit/delete papers with full metadata; only admin can write
- All roles: browse with filters (subject, year, session, search), subject chips
- Download links: Question Paper, Mark Scheme, Examiner Report
- Student view: grouped by subject with color-coded session badges
- Routes: `GET/POST/PATCH/DELETE /api/past-papers`, `GET /api/past-papers/subjects`

### Analytics (`/analytics`)
- KPI cards: total students, attendance rate, present/absent
- Per-session attendance bar chart
- Predicted grade distribution (70% exam + 30% attendance)
- Top performers and at-risk student panels
- Full student performance table with IGCSE predictions and risk scores
- Teacher intelligence metrics

### Parent Communication (`/parent-comms`)
- Student selector with search
- Message types: Today's Absence, Low Attendance Alert, Exam Reminder, Low Performance Alert, Weekly Summary, Custom
- Auto-generates WhatsApp-formatted messages for parent phones
- One-click copy to clipboard
- Direct WhatsApp links (`wa.me/...`) for student and parent phones
- Bulk absence message generation for all students

### Notifications
- In-app real-time notification bell (30s polling)
- Unread count badge
- Types: info, warning, success, error with distinct icons/colors
- Mark individual or all as read
- Delete individual notifications

### Reports (`/reports`)
Two-tab page:
- **AI Weekly Reports tab** — select a week, click "Generate All Reports" to produce a full formatted performance report per student using the rule-based AI engine. Each report includes: header, performance snapshot, smart metrics with emoji progress bars, academic analysis (strong/weak topics), AI insights paragraph, personalised action plan, and motivational close. Reports can be previewed in-modal, copied to clipboard individually, or exported as a single-column CSV (WhatsApp bulk-send compatible format). Status summary cards: Elite/Achievers, Good Progress, Needs Attention, At Risk.
- **Attendance Records tab** — existing week filter, auto-mark absences, CSV export.

### Admin Control Center (`/admin`, admin only)
Three tabs:
- **System Overview** — 8 KPI cards (total students, teachers, assistants, student accounts, sessions, exams, attendance records, overall attendance rate), teacher workspace table (student count per teacher), recent activity preview with link to audit log.
- **Accounts** — full account CRUD: create/edit/delete, suspend/reactivate, search. Stats cards for each role.
- **Activity Log** — searchable audit log showing all 100 most recent platform events with actor name, role badge, action color-coding, resource, and timestamp.

## Database Schema

- `organizations` — id, name, slug, status, plan (future multi-org)
- `accounts` — id, username, password_hash, display_name, role, status, teacher_account_id, organization_id
- `subjects` — id, name, teacher_account_id
- `sessions` — id, lesson_number, day_of_week, start_time, type, capacity, subject_id, teacher_account_id, online_link
- `students` — id, student_code, student_name, phone, parent_phone, notes, status, teacher_account_id, lesson1/2/3_session_id
- `attendance` — id, student_id, session_id, date, status, marked_at
- `exams` — id, name, subject_id, teacher_account_id, exam_date, total_marks
- `exam_questions` — id, exam_id, parent_id, question_text, topic, max_marks, question_order, question_type (written/mcq, default written), options (JSONB string array), correct_option (integer 0-based index)
- `exams` — also has `time_limit_minutes` (integer, nullable) for online exam timer
- `student_marks` — id, student_id, exam_id, question_id, marks_scored, mistakes, marked_at
- `notifications` — id, account_id, title, message, type, is_read, link
- `question_bank` — id, teacher_account_id, subject_id, question_text, topic, subtopic, difficulty, max_marks, model_answer, common_mistakes, tags, times_used
- `past_papers` — id, title, subject, year, session, variant, paper_number, file_url, mark_scheme_url, examiner_report_url, uploaded_by, is_public, created_at
- `practice_sessions` — id, student_id, questions JSONB, answers JSONB, score, total, time_taken_seconds, completed_at, created_at
- `student_goals` — id, student_id, goal_type (attendance/grade/streak), target_value, subject_id, deadline, notes, is_active, created_at
- `student_achievements` — id, student_id, achievement_key, achievement_name, description, xp_points, earned_at; UNIQUE(student_id, achievement_key)
- `student_xp` — student_id (PK), total_xp, level, updated_at
- `tutorial_progress` — id, account_id (UNIQUE), completed, last_step, completed_at, created_at, updated_at
- `online_exam_sessions` — id, exam_id, student_id, student_account_id, started_at, submitted_at, time_limit_minutes, answers JSONB, auto_score, max_score, status (in_progress/submitted/expired); UNIQUE(exam_id, student_id)
- `inventory_items` — id, teacher_account_id, name, item_type (book/sheet/worksheet/exam_booklet/other), description, price, stock_count, low_stock_threshold, is_active, created_at
- `inventory_sales` — id, item_id, student_id, teacher_account_id, quantity, unit_price, total_price, payment_status (paid/unpaid), notes, sold_at
- `audit_logs` — id, account_id, teacher_id, action, resource, resource_id, details, ip_address

### Performance Indexes
All tenant-filtered columns are indexed: students/sessions/exams/subjects by teacher_account_id, attendance by student_id+date and session_id+date, student_marks by student_id+exam_id, notifications by account_id+is_read

## Key Commands

- `pnpm run typecheck` — full typecheck
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks from OpenAPI spec
- `pnpm --filter @workspace/api-server run build` — build API server

## Route Security Patterns

- `attendance.ts` — uses `requireTenantAccess` on all 4 routes (mark, list, auto-absence, export); teacher filter on sessions/students joins
- `students.ts` — uses internal `getTeacherId()` helper; PATCH/DELETE/create-account/delete-account all verify `ownsStudent()` before mutating
- `sessions.ts` — same pattern with `ownsSession()` ownership guard on PATCH/DELETE
- `homework.ts`, `resources.ts`, `flashcards.ts`, `question-bank.ts`, `payments.ts`, `recordings-routes.ts` — all use `requireTenantAccess` with full tenant filtering
- `analytics.ts`, `reports.ts`, `dashboard.ts` — use `requireTenantAccess` with `teacherFilter`/`studentFilter` on all DB queries
- `student-portal.ts` — uses `requireStudentAccess` (blocks non-students); all queries scoped by `session.studentId`
- `accounts.ts` — uses `requireAdmin` (admin only)
- Attendance mark endpoint: verifies teacher owns BOTH the student AND the session before marking

## Important Notes

- Do NOT use `console.log` in server code — use `req.log` or `logger`
- Do NOT import `zod` directly in `api-server` routes — use manual validation or `@workspace/api-zod`
- Sessions are weekly recurring templates (not date-specific)
- NEVER derive teacherId from request body — always from `req.session` via tenant middleware
- Auto-absence marks one absence per lesson per student per week (scoped to teacher's students/sessions only)
- QR codes encode the `studentCode` string
- Predicted IGCSE grade: 70% exam × 0.7 + attendanceRate × 0.3 → A*–U scale
- Risk score: `min(100, max(0, 80-attendanceRate)*1.2 + max(0, 60-examPct)*0.8)`
- Attendance frontend calls `POST /api/attendance/mark` (not `/api/attendance`)
- Student portal flashcard spaced repetition uses `flashcard_progress` table (exists in DB)
- Flashcard student UI: 3D animated flip cards (AnimatePresence rotateY), Hard/OK/Easy rating buttons, mastery progress bar, deck grid with per-deck color gradients
- Past Paper Library auth: `requireAuth` middleware (any logged-in role can read; admin-only write)
- Exam Generator: `POST /api/exams/generate` inserts into `exams` + `exam_questions` tables, increments `times_used` on source questions
- `requireStudentAccess` is now exported from `middleware/tenant.ts` (previously only defined locally in student-portal.ts)
- Achievement check (`POST /api/portal/achievements/check`) is called automatically after practice sessions complete and after goal creation
- Practice Exam Simulation Mode: full-screen dark UI overlay (`fixed inset-0 z-50`), separate from normal quiz mode, saves to `practice_sessions` table
- XP levels: 1=Beginner(0-99), 2=Learner(100-299), 3=Student(300-599), 4=Scholar(600-999), 5=Academic(1000-1999), 6=Elite(2000+)
