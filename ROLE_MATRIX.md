# Aperti Role Permission Matrix

Generated: 2026-06-13

## Roles

| Role | Description |
|------|-------------|
| `admin` | Full platform access, user management, billing, system settings |
| `super_admin` | Same as admin (used for founder-level emergency tools) |
| `teacher` | Course management, students, assessments, grading |
| `assistant` | Limited teaching tools (grading, attendance, view-only) |
| `student` | Their own academic data, courses, homework, exams |
| `parent` | Read-only access to their linked child's data |
| `guest` | Public landing page, login, registration only |

---

## Backend API Route Matrix

### Public Routes (No Auth)
| Route | Method | Description |
|-------|--------|-------------|
| `/auth/login` | POST | Login |
| `/auth/register` | POST | Register (teacher/student/parent) |
| `/auth/forgot-password` | POST | Password reset request |
| `/auth/reset-password` | POST | Password reset confirm |
| `/auth/stats` | GET | Platform statistics |
| `/auth/public-teachers` | GET | Teacher list for student reg |
| `/api/health` | GET | Health check |
| `/api/plans/public` | GET | Public pricing plans |
| `/api/landing` | GET | Landing page CMS content |

### Auth Required (Any Role)
| Route | Auth | Description |
|-------|------|-------------|
| `/auth/me` | Any | Get current user |
| `/auth/logout` | Any | Sign out |
| `/auth/devices` | Any | List active devices |
| `/auth/devices/:id` | Any | Revoke device |
| `/auth/audit-event` | Any | Report client-side event |
| `/api/notifications/*` | Any | Notifications |
| `/api/settings/*` | Any | User settings |
| `/api/profile/*` | Any | User profile |
| `/api/change-password` | Any | Change password |

### Admin Only
| Route | Roles | Description |
|-------|-------|-------------|
| `/api/admin/users` | admin | User management |
| `/api/admin/analytics` | admin | Platform analytics |
| `/api/admin/payments` | admin | Payment management |
| `/api/admin/subscriptions` | admin | Subscription management |
| `/api/admin/features` | admin | Feature flags |
| `/api/admin/organizations` | admin | Organization management |
| `/api/admin/roles` | admin | Role management |
| `/api/admin/health` | admin | System health |
| `/api/admin/audit` | admin | Audit logs |
| `/api/admin/security` | admin | Security settings |
| `/api/admin/db-health` | admin | Database health |
| `/api/admin/route-health` | admin | Route health report |
| `/api/admin/data-quality` | admin | Data quality |
| `/api/admin/launch-audit` | admin | Launch readiness |
| `/api/founder/*` | admin | Founder control center |

### Teacher + Admin
| Route | Roles | Description |
|-------|-------|-------------|
| `/api/attendance/*` | admin, teacher, assistant | Attendance management |
| `/api/lessons/*` | admin, teacher | Lesson management |
| `/api/homework/*` | admin, teacher, assistant | Homework management |
| `/api/question-bank/*` | admin, teacher | Question bank |
| `/api/subjects/*` | admin, teacher | Subjects |
| `/api/students/*` | admin, teacher, assistant | Student management |
| `/api/exams/*` | admin, teacher, assistant | Exam management |
| `/api/grading/*` | admin, teacher, assistant | Grading |
| `/api/gradebook/*` | admin, teacher, assistant | Gradebook |
| `/api/tutorcraft/*` | admin, teacher | TutorCraft AI |
| `/api/courses/*` | admin, teacher | Course management |
| `/api/certifications/*` | admin, teacher | Certifications |

### Student Only
| Route | Roles | Description |
|-------|-------|-------------|
| `/api/flashcards/*` | student | Flashcard system |
| `/api/mentor/*` | student | AI mentor |
| `/api/revisit/*` | student | Spaced revision |
| `/api/ascend/*` | student | Gamification |
| `/api/goals/*` | student | Learning goals |
| `/api/peak-rankings/*` | student | Leaderboards |
| `/api/echo-profile/*` | student | Echo AI profile |
| `/api/trial-vault/*` | student | Mock exams |
| `/api/snap-grade/*` | student | OCR grading |
| `/api/student-portal/*` | student | Student portal |

### Parent Only
| Route | Roles | Description |
|-------|-------|-------------|
| `/api/parent/*` | parent | All parent features |
| `/api/parent-ai/*` | parent | Parent AI assistant |

---

## Frontend Route Access Matrix

| Path | Admin | Teacher | Assistant | Student | Parent |
|------|-------|---------|-----------|---------|--------|
| `/` (CoreHub/Command) | ✅ | ✅ | ✅ | ✅ (StudyStream) | ✅ (Dashboard) |
| `/checkin` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `/plan-grid` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/teacher/assessments` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `/grade-flow` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `/admin/*` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `/mentor` | ❌ | ❌ | ❌ | ✅ | ❌ |
| `/flashcards` | ❌ | ❌ | ❌ | ✅ | ❌ |
| `/parent/*` | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Enforcement Mechanism

1. **Backend**: `authenticate` middleware verifies JWT on every protected route. `requireRole(...roles)` middleware checks role matches.
2. **Frontend**: `App.tsx` checks `user.role` and uses `pathBlocked()` to redirect unauthorized users to `/access-denied`.
3. **API calls**: All `apiFetch()` calls include `Authorization: Bearer <token>` header.

## Known Gaps & Recommendations

1. **Assistant role access**: Some teacher routes allow `assistant` but the frontend nav does not always reflect this. Audit `roles: ["admin","teacher","assistant"]` in layout.tsx.
2. **Student accessing teacher routes**: Backend correctly returns 403 for unauthorized role, but some frontend components don't check role before making API calls — relying on the backend 403.
3. **Recommendation**: Add a middleware `assertRoleOnFrontend(requiredRoles)` hook for critical pages.
