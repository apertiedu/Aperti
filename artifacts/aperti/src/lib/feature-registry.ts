export type FeatureStatus = "stable" | "beta" | "coming-soon" | "disabled";

export interface FeatureEntry {
  id: string;
  name: string;
  description: string;
  route: string;
  status: FeatureStatus;
  roles: string[];
  category: string;
}

export const FEATURE_REGISTRY: FeatureEntry[] = [
  { id: "corehub", name: "CoreHub", description: "Teacher live class overview and controls", route: "/", status: "stable", roles: ["teacher", "assistant"], category: "Core" },
  { id: "command-center", name: "Command Center", description: "Admin system overview and quick actions", route: "/admin/command", status: "stable", roles: ["admin"], category: "Core" },
  { id: "checkin", name: "CheckIn", description: "QR-based attendance tracking", route: "/checkin", status: "stable", roles: ["admin", "teacher", "assistant"], category: "Core" },
  { id: "plan-grid", name: "PlanGrid", description: "Lesson and timetable planner", route: "/plan-grid", status: "stable", roles: ["admin", "teacher"], category: "Core" },

  { id: "assessments", name: "Assessment Hub", description: "Central exam and assessment management", route: "/teacher/assessments", status: "stable", roles: ["admin", "teacher"], category: "Teaching" },
  { id: "submit-flow", name: "SubmitFlow", description: "Student assignment submission pipeline", route: "/submit-flow", status: "stable", roles: ["admin", "teacher"], category: "Teaching" },
  { id: "grade-flow", name: "GradeFlow", description: "AI-assisted grading workflow", route: "/grade-flow", status: "stable", roles: ["admin", "teacher", "assistant"], category: "Teaching" },
  { id: "scheme-craft", name: "SchemeCraft", description: "Mark scheme and rubric builder", route: "/scheme-craft", status: "stable", roles: ["admin", "teacher"], category: "Teaching" },
  { id: "moderation", name: "Moderation", description: "Assessment moderation and review", route: "/teacher/moderation", status: "stable", roles: ["admin", "teacher"], category: "Teaching" },
  { id: "session-slots", name: "Session Slots", description: "Lesson slot and scheduling management", route: "/admin/session-slots", status: "stable", roles: ["admin", "teacher"], category: "Teaching" },

  { id: "query-vault", name: "QueryVault", description: "Searchable question bank", route: "/query-vault", status: "stable", roles: ["admin", "teacher"], category: "Content" },
  { id: "question-extract", name: "Question Extractor", description: "AI extracts questions from PDFs and images", route: "/teacher/questions/extract", status: "beta", roles: ["admin", "teacher"], category: "Content" },
  { id: "cardstack", name: "CardStack", description: "Flashcard deck management", route: "/cardstack", status: "stable", roles: ["admin", "teacher"], category: "Content" },
  { id: "syllabuilder", name: "Syllabuilder", description: "Curriculum and syllabus designer", route: "/syllabuilder", status: "stable", roles: ["admin", "teacher"], category: "Content" },
  { id: "content-craft", name: "ContentCraft", description: "AI lesson content generation studio", route: "/content-craft", status: "stable", roles: ["admin", "teacher"], category: "Content" },
  { id: "lab-builder", name: "LabBuilder", description: "Interactive science experiment designer", route: "/lab-builder", status: "beta", roles: ["admin", "teacher"], category: "Content" },
  { id: "marker-mind", name: "MarkerMind", description: "AI-powered answer marking tool", route: "/marker-mind", status: "stable", roles: ["admin", "teacher", "assistant"], category: "Content" },
  { id: "scan-scribe", name: "ScanScribe", description: "Handwritten work OCR and digitisation", route: "/scan-scribe", status: "beta", roles: ["admin", "teacher", "assistant"], category: "Content" },

  { id: "gradebook-plus", name: "GradeBook+", description: "Advanced gradebook with trends and averages", route: "/gradebook-plus", status: "stable", roles: ["admin", "teacher"], category: "Insights" },
  { id: "pulse", name: "Pulse", description: "Real-time class performance analytics", route: "/pulse", status: "stable", roles: ["admin", "teacher"], category: "Insights" },
  { id: "insight-stream", name: "InsightStream", description: "Predictive risk and performance analytics", route: "/insight-stream", status: "stable", roles: ["admin", "teacher"], category: "Insights" },
  { id: "insight-exams", name: "InsightExams", description: "Exam performance breakdown and analysis", route: "/insight-exams", status: "stable", roles: ["admin", "teacher", "assistant"], category: "Insights" },

  { id: "the-mentor", name: "The Mentor", description: "AI academic tutor for students", route: "/mentor", status: "stable", roles: ["student"], category: "AI" },
  { id: "tutorcraft", name: "TutorCraft", description: "AI tutoring session configurator", route: "/tutorcraft", status: "beta", roles: ["admin", "teacher"], category: "AI" },
  { id: "ai-safety", name: "AI Safety", description: "Monitor and moderate AI responses", route: "/admin/ai-safety", status: "stable", roles: ["admin"], category: "AI" },
  { id: "ai-analytics", name: "AI Analytics", description: "AI usage stats and cost monitoring", route: "/admin/ai-analytics", status: "stable", roles: ["admin"], category: "AI" },

  { id: "study-stream", name: "StudyStream", description: "Student personalised learning dashboard", route: "/", status: "stable", roles: ["student"], category: "Student" },
  { id: "ascend", name: "Ascend", description: "Gamified learning progression and XP", route: "/ascend", status: "stable", roles: ["student"], category: "Student" },
  { id: "echo", name: "Echo", description: "Spaced repetition and active recall engine", route: "/echo", status: "stable", roles: ["student"], category: "Student" },
  { id: "focus-coach", name: "FocusCoach", description: "AI study focus and productivity coach", route: "/focus-coach", status: "beta", roles: ["student"], category: "Student" },
  { id: "skill-badge", name: "SkillBadge", description: "Skill certifications and achievement badges", route: "/skill-badge", status: "stable", roles: ["student"], category: "Student" },
  { id: "exam-vault", name: "ExamVault", description: "Past paper practice vault", route: "/exam-vault", status: "stable", roles: ["student"], category: "Student" },
  { id: "exam-room", name: "Exam Room", description: "Live proctored exam environment", route: "/student/exam-room", status: "beta", roles: ["student"], category: "Student" },
  { id: "success-center", name: "Success Center", description: "Student goals and progress tracking", route: "/student/success-center", status: "stable", roles: ["student"], category: "Student" },
  { id: "revision-plan", name: "Revision Planner", description: "AI-generated personalised revision schedule", route: "/student/revision-plan", status: "stable", roles: ["student"], category: "Student" },
  { id: "transcript", name: "Transcript", description: "Academic transcript and record", route: "/student/transcript", status: "stable", roles: ["student"], category: "Student" },

  { id: "admin-os", name: "AdminOS", description: "Full administrative operating system", route: "/admin/os", status: "stable", roles: ["admin"], category: "Admin" },
  { id: "shield-core", name: "ShieldCore", description: "Academic integrity and anti-cheating", route: "/admin/shield-core", status: "stable", roles: ["admin"], category: "Admin" },
  { id: "data-quality", name: "Data Quality", description: "Database health and orphan repair", route: "/admin/data-quality", status: "stable", roles: ["admin"], category: "Admin" },
  { id: "route-health", name: "Route Health", description: "API and frontend route monitoring", route: "/admin/route-health", status: "stable", roles: ["admin"], category: "Admin" },
  { id: "test-runner", name: "Test Runner", description: "System-wide health and integration tests", route: "/admin/test-runner", status: "stable", roles: ["admin"], category: "Admin" },
  { id: "budget-sense", name: "BudgetSense", description: "AI cost and budget monitoring", route: "/admin/budget-sense", status: "stable", roles: ["admin"], category: "Admin" },
  { id: "auto-scale", name: "AutoScale", description: "Infrastructure auto-scaling controls", route: "/admin/auto-scale", status: "beta", roles: ["admin"], category: "Admin" },
  { id: "world-pilot", name: "WorldPilot", description: "Multi-region deployment and geo-routing", route: "/admin/world-pilot", status: "beta", roles: ["admin"], category: "Admin" },
  { id: "guardian-pulse", name: "GuardianPulse", description: "Parent engagement and satisfaction analytics", route: "/admin/guardian-pulse", status: "stable", roles: ["admin"], category: "Admin" },
  { id: "executive", name: "Executive Dashboard", description: "C-level platform metrics and KPIs", route: "/admin/executive", status: "stable", roles: ["admin"], category: "Admin" },
  { id: "spend-wise", name: "SpendWise", description: "Operational spend and budget allocation", route: "/admin/spend-wise", status: "stable", roles: ["admin"], category: "Admin" },
  { id: "feature-status", name: "Feature Status", description: "Module rollout and feature flag management", route: "/admin/feature-status", status: "stable", roles: ["admin"], category: "Admin" },
  { id: "quick-switch", name: "QuickSwitch", description: "Admin role impersonation and switching", route: "/admin/quick-switch", status: "stable", roles: ["admin"], category: "Admin" },

  { id: "unified-inbox", name: "Inbox", description: "Unified messaging and notifications", route: "/inbox", status: "stable", roles: ["admin", "teacher", "assistant", "student", "parent"], category: "Communication" },
  { id: "announcements", name: "Announcements", description: "School-wide announcements and broadcasts", route: "/announcements", status: "stable", roles: ["admin", "teacher", "assistant", "student", "parent"], category: "Communication" },
  { id: "study-rooms", name: "Study Rooms", description: "Collaborative real-time study sessions", route: "/rooms", status: "stable", roles: ["admin", "teacher", "student"], category: "Communication" },
  { id: "messages", name: "Messages", description: "Direct messaging between staff and students", route: "/messages", status: "stable", roles: ["admin", "teacher", "assistant"], category: "Communication" },
  { id: "notifications", name: "Notifications", description: "Smart notification centre", route: "/notifications", status: "stable", roles: ["admin", "teacher", "assistant", "student", "parent"], category: "Communication" },

  { id: "courses", name: "Course Marketplace", description: "Browse and enroll in available courses", route: "/courses", status: "stable", roles: ["admin", "teacher", "assistant", "parent"], category: "Marketplace" },
  { id: "my-courses", name: "My Courses", description: "Teacher course library and management", route: "/my-courses", status: "stable", roles: ["admin", "teacher"], category: "Marketplace" },
  { id: "certifications", name: "Certifications", description: "Course completion certificates", route: "/certifications", status: "stable", roles: ["admin", "teacher", "student"], category: "Marketplace" },

  { id: "pricing", name: "Pricing Plans", description: "Subscription tiers and pricing", route: "/pricing", status: "stable", roles: ["admin", "teacher", "assistant"], category: "Billing" },
  { id: "subscription", name: "My Subscription", description: "Manage your current plan and billing", route: "/account/subscription", status: "stable", roles: ["admin", "teacher", "assistant"], category: "Billing" },
  { id: "commerce-admin", name: "Commerce Admin", description: "Revenue, payments, and subscription management", route: "/admin/commerce", status: "stable", roles: ["admin"], category: "Billing" },

  { id: "simverse", name: "SimVerse", description: "Interactive science simulations", route: "/simverse", status: "coming-soon", roles: ["student", "teacher"], category: "Labs" },
  { id: "paper-vault", name: "PaperVault", description: "Past paper library and smart search", route: "/student-portal/past-papers", status: "stable", roles: ["student", "admin", "teacher"], category: "Labs" },
];

export function getFeaturesByCategory(): Record<string, FeatureEntry[]> {
  return FEATURE_REGISTRY.reduce(
    (acc, f) => {
      if (!acc[f.category]) acc[f.category] = [];
      acc[f.category].push(f);
      return acc;
    },
    {} as Record<string, FeatureEntry[]>,
  );
}

export function getFeaturesByRole(role: string): FeatureEntry[] {
  return FEATURE_REGISTRY.filter((f) => f.roles.includes(role));
}

export function getFeatureByRoute(route: string): FeatureEntry | undefined {
  return FEATURE_REGISTRY.find(
    (f) => f.route === route || route.startsWith(f.route + "/"),
  );
}

export function getFeaturesByStatus(status: FeatureStatus): FeatureEntry[] {
  return FEATURE_REGISTRY.filter((f) => f.status === status);
}

export const STATUS_LABELS: Record<FeatureStatus, string> = {
  stable: "Stable",
  beta: "Beta",
  "coming-soon": "Coming Soon",
  disabled: "Disabled",
};

export const STATUS_COLORS: Record<FeatureStatus, string> = {
  stable: "bg-emerald-50 text-emerald-700 border-emerald-200",
  beta: "bg-amber-50 text-amber-700 border-amber-200",
  "coming-soon": "bg-blue-50 text-blue-600 border-blue-200",
  disabled: "bg-gray-100 text-gray-400 border-gray-200",
};
