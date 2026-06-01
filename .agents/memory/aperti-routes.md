---
name: Aperti route map
description: All frontend routes and their component mappings for teacher/student/parent/admin
---

## Teacher/Admin/Assistant (TeacherRouter, uses Layout)
- `/` → CoreHub
- `/checkin` → CheckIn, `/plan-grid` → PlanGrid, `/submit-flow` → SubmitFlow
- `/grade-flow` → GradeFlow, `/scheme-craft` → SchemeCraft, `/live-class` → LiveClass
- `/class-forge` → ClassForge, `/twin-control` → TwinControl, `/inkspace` → InkSpace
- `/query-vault` → QueryVault, `/cardstack` → CardStack, `/syllabuilder` → Syllabuilder
- `/content-craft` → ContentCraft, `/lab-builder` → LabBuilder, `/marker-mind` → MarkerMind
- `/scan-scribe` → ScanScribe, `/error-trace` → ErrorTrace
- `/pulse` → Pulse, `/insight-stream` → InsightStream, `/insight-exams` → InsightExams
- `/kudos-engine` → KudosEngine, `/subpilot` → SubPilot, `/helpdesk` → HelpDesk
- Admin only: `/admin/command`, `/admin/world-pilot`, `/admin/paper-vault`, `/admin/shield-core`
- Admin only: `/admin/budget-sense`, `/admin/auto-scale`, `/admin/spend-wise`
- Admin only: `/admin/quick-switch`, `/admin/subpilot-settings`, `/admin/helpdesk`, `/admin/guardian-pulse`

## Student (StudentRouter, uses StudentLayout)
- `/` → StudyStream, `/my-homework`, `/my-timetable`, `/my-attendance`
- `/mentor` → TheMentor, `/flashcards` → MyCardStack, `/ascend` → Ascend
- `/simverse` → SimVerse (re-exports student-portal/simverse)
- `/exams/:examId/take` → TakeExam
- `/revisit`, `/focus-coach`, `/focus-zone`, `/trial-vault`
- `/peak-rankings`, `/peer-review`, `/snap-grade`
- `/labs/forge-field`, `/labs/react-sphere`, `/labs/geometrix`, `/labs/biosphere`
- `/skill-badge`, `/learn-path`, `/discover`, `/team-forge`, `/privacy-vault`

## Parent (ParentRouter, uses Layout)
- `/` → GuardianHub, `/parent/guardian-hub` → GuardianHub
- `/parent/guardian-link` → GuardianLink

## Public (PublicRouter, no layout)
- `/login`, `/terms`, `/privacy`, `/contact`, `/sitemap`, `/paper-vault`
- All other paths → Landing

## Role routing (AppContent)
- student → StudentRouter
- parent → ParentRouter
- admin/teacher/assistant → TeacherRouter
