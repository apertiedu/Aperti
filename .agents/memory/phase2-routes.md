---
name: Phase 2 Teacher OS routes
description: All Phase 2 API routes registered; key architectural decisions
---

All Phase 2 routes are mounted in `artifacts/api-server/src/routes/index.ts`:
- `teacherCoursesRouter` → `router.use(teacherCoursesRouter)` (no prefix, routes self-prefix /teacher-courses)
- `rubricsRouter` → `router.use(rubricsRouter)`
- `messagesRouter` → `router.use(messagesRouter)`
- `tutorcraftRouter` → `router.use(tutorcraftRouter)`
- `classforgeRouter` → `router.use(classforgeRouter)`

Frontend routes added to TEACHER_ROUTES in App.tsx: /tutorcraft, /messages, /teacher-courses.

**Why:** All Phase 2 teacher modules needed real DB-backed APIs; migration in migrate.ts adds tables at startup.
**How to apply:** New teacher modules → add router to routes/index.ts + route to TEACHER_ROUTES in App.tsx.
