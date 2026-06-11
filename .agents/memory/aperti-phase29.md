---
name: Aperti Phase 29 features
description: All Phase 29 Intelligence, Efficiency & Educational Excellence features built — key components and patterns
---

## What was built

### Backend routes (all in `artifacts/api-server/src/routes/`)
- `teacher-focus.ts` — daily focus + weekly summary for teachers
- `student-momentum.ts` — momentum score + what-next recommendations
- `course-health.ts` — per-course health scores + student insights
- `feedback.ts` — user feedback engine (requires `user_feedback` table)
- `revision-modes.ts` — AI content generation for 3 revision modes (summary/questions/mindmap)
- `db-indexes.ts` — performance indexes run at startup; uses `CONCURRENTLY IF NOT EXISTS`

### Frontend components (all in `artifacts/aperti/src/components/`)
- `teacher-daily-focus.tsx` — teacher command center
- `momentum-score.tsx` — student momentum widget
- `what-next-card.tsx` — AI-powered next-step recommendation
- `plan-status-strip.tsx` — subscription plan status
- `feedback-widget.tsx` — floating feedback button
- `smart-empty-state.tsx` — context-aware empty states
- `revision-modes-selector.tsx` — 3-mode AI revision selector
- `course-health-badge.tsx` — per-course health indicator
- `assessment-quality-checker.tsx` — inline quality check for assessments (collapsible)
- `system-health-widget.tsx` — admin operational intelligence + service health
- `student-performance-insights.tsx` — teacher dashboard student comparison table
- `parent-snapshot.tsx` — compact mobile-first parent metrics row
- `content-quality-badge.tsx` — ring chart quality indicator for content
- `mobile-nav-bar.tsx` — role-aware mobile bottom navigation (NEW, not yet wired in — MobileBottomNav already exists)

### Pages updated
- `student-portal/dashboard.tsx` — momentum + what-next cards
- `student-portal/revisit.tsx` — AI revision modes selector with topic picker
- `student-portal/my-flashcards.tsx` — image_url, back_image_url, exam_style, hint fields
- `student-portal/my-recordings.tsx` — platform filter chips (zoom/meet/teams/other)
- `teacher/my-courses.tsx` — CourseHealthBadge
- `teacher/assessment-builder.tsx` — AssessmentQualityChecker in toolbar
- `teacher/question-studio.tsx` — per-question quality score badge
- `parent/dashboard.tsx` — ParentSnapshot on mobile, full StatCard grid on desktop
- `admin/admin-os/Dashboard.tsx` — SystemHealthWidget + operational intelligence panel
- `dashboard.tsx` (teacher) — StudentPerformanceInsights + TeacherDailyFocus + PlanStatusStrip
- `students.tsx` — duplicate name detection with amber warning banner + row badges

### Key patterns
- AssessmentQualityChecker is pure client-side (no API call), computes score from `questions` prop
- SystemHealthWidget polls `/api/admin/health` every 60s
- StudentPerformanceInsights fetches from `/api/course-health?courseId=...`
- parent-snapshot is `md:hidden` (mobile only); full StatCard grid is `hidden md:grid`
- Duplicate name detection in students.tsx uses client-side reduce over `students[]` array

**Why Phase 29 matters:** These changes make Aperti actively helpful — showing intelligence rather than just storing data. Every dashboard now surfaces actionable insights rather than raw numbers.
