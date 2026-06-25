const STATIC_ROUTES = new Set([
  "/", "/login", "/register", "/register/student",
  "/forgot-password", "/reset-password", "/onboarding",
  "/settings", "/profile", "/access-denied", "/coming-soon",
  "/plan-grid", "/checkin", "/submit-flow", "/grade-flow",
  "/scheme-craft", "/query-vault", "/cardstack", "/syllabuilder",
  "/kudos-engine", "/pulse", "/content-craft", "/lab-builder",
  "/marker-mind", "/insight-stream", "/analytics", "/risk-report",
  "/timetable", "/attendance", "/helpdesk", "/insight-exams",
  "/scan-scribe", "/error-trace", "/tutorcraft", "/messages",
  "/teacher-courses", "/automation", "/assessment-hub",
  "/gradebook-plus", "/certifications", "/student-approvals",
  "/subjects", "/courses", "/my-courses", "/papers", "/exams",
  "/team-forge", "/privacy-vault", "/inbox", "/announcements",
  "/rooms", "/support", "/notifications", "/pricing",
  "/account/subscription", "/account/sessions", "/revision-notes",
  "/resources/library",
  "/my-homework", "/assignments", "/course-hub", "/my-timetable",
  "/my-attendance", "/mentor", "/flashcards", "/ascend",
  "/skill-badge", "/learn-path", "/discover", "/revisit",
  "/focus-coach", "/focus-zone", "/trial-vault", "/peak-rankings",
  "/peer-review", "/snap-grade", "/echo", "/study-groups",
  "/exam-vault", "/exam-room", "/student/transcript",
  "/student/appeals", "/student/exam-readiness", "/success",
  "/learning-path", "/recommendations", "/goals", "/challenges",
  "/learning-analytics", "/micro-assessment", "/attendance-audit",
  "/enrollment-timeline", "/practice", "/revision-plan",
  "/link-parent", "/my-qr", "/flashcards/swipe",
  "/teacher/assessments", "/teacher/moderation",
  "/teacher/archives", "/teacher/contentcraft", "/teacher/schedule",
  "/teacher/question-studio", "/teacher/questions/import",
  "/teacher/questions/extract", "/teacher/analytics/content",
  "/guardian-link", "/parent/link-student",
  "/admin/os", "/admin/command", "/admin/certificates",
  "/admin/world-pilot", "/admin/paper-vault", "/admin/helpdesk",
  "/admin/shield-core", "/admin/quick-switch", "/admin/budget-sense",
  "/admin/auto-scale", "/admin/spend-wise", "/admin/subpilot",
  "/admin/landing-editor", "/admin/assistant-permissions",
  "/admin/teacher-verification", "/admin/moderation",
  "/admin/communication-analytics", "/admin/commerce", "/admin/plans",
  "/admin/executive", "/admin/push", "/admin/ai-analytics",
  "/admin/ai-safety", "/admin/guardian-pulse", "/admin/route-health",
  "/admin/feature-status", "/admin/data-quality",
  "/admin/session-slots", "/admin/debug", "/admin/test-runner", "/admin/feature-registry",
  "/admin/roles-matrix", "/admin/health", "/admin/repair",
  "/features", "/roadmap", "/release-notes", "/status",
  "/terms", "/privacy", "/contact", "/trust", "/sitemap",
  "/paper-vault", "/checkout", "/mobile/home",
]);

const DYNAMIC_PREFIXES = [
  "/courses/", "/profile/", "/channels/", "/collaborate/",
  "/exams/", "/subscribe/", "/teacher/assessments/",
  "/teacher/contentcraft/", "/admin/os/",
  "/student/exams/", "/courses/", "/resources/",
];

export function isRouteValid(path: string): boolean {
  const clean = path.split("?")[0].split("#")[0];
  if (!clean || clean === "") return false;
  if (STATIC_ROUTES.has(clean)) return true;
  return DYNAMIC_PREFIXES.some((prefix) => clean.startsWith(prefix));
}

export function assertRouteValid(path: string, label?: string): void {
  if (!isRouteValid(path)) {
    console.warn(`[route-registry] Unknown route${label ? ` (${label})` : ""}: ${path}`);
  }
}
