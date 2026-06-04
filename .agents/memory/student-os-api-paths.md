---
name: Student OS API paths
description: Correct backend API paths and response field names for student-facing pages; gotchas encountered during Phase 3 build
---

## Key API paths (all require Bearer token)

| Feature | Correct path | Common mistake |
|---|---|---|
| InkSpace notebooks list | GET `/api/inkspace/notebooks` | NOT `/api/inkspace` |
| InkSpace notebook pages | GET `/api/inkspace/notebooks/:id/pages` | NOT `/api/inkspace/:id/pages` |
| InkSpace save | POST `/api/inkspace/save` with `{ notebookId, pageId, content }` | Needs both notebookId AND pageId |
| Messages thread messages | GET `/api/messages/threads/:id` → returns `{ thread, messages }` | NOT `/api/messages/threads/:id/messages` |
| Messages send | POST `/api/messages/threads/:id/send` | NOT `/api/messages/threads/:id/messages` |
| Exam list for students | GET `/api/exams` | No `/api/exam-vault/list` endpoint exists |
| Focus coach goals complete | POST `/api/focus-coach/complete-goal` with `{ goalId }` | |

## Response field names

### `/api/focus-coach/analytics`
Returns: `{ totalHours, totalSessions, completionRate, streak, completedGoals, totalGoals, studyByDay, avgSessionMinutes }`
- `studyByDay` is an object keyed by ISO date string → minutes value (NOT an array)
- No `dailyFocusMinutes` array field

### `/api/student/analytics`
Returns: `{ currentGrade, predictedGrade, targetGrade, readinessScore, attendancePct, hwCompletionRate, recentQuizAvg, gradeHistory, topicMap, timeAnalytics }`
- `topicMap: { mastered[], developing[], weak[], critical[] }` — topic strings by mastery category
- `timeAnalytics: { studyHours, studyByDay, focusSessions, avgSessionMinutes }`
- `gradeHistory: [{ examId, examDate, percentage }]`

### `/api/echo/profile`
Returns: `{ weakTopics[], strongTopics[], retentionScores, learningPace, preferredStyle, burnoutRisk, confidenceScore, gradeHistory, avgGrade, attendancePct, hwCompletionRate, behavior, ascend, subjectXp, flashcardRetention }`
- `behavior: { lateNightSessions, inactivityStreaks, preExamPanic, consistencyScore }`

**Why:** These field names differ from what seems intuitive and caused mismatches during initial build. Always verify response shape from the route file before writing frontend code.

**How to apply:** Before building any new student page, grep the route file for `res.json` to see exact fields returned.
