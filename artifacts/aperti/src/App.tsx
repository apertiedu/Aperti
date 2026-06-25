import { useEffect, useRef, lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/auth";
import { ThemeProvider } from "@/context/theme";
import ErrorBoundary from "@/components/error-boundary";
const NotFound = lazy(() => import("@/pages/not-found"));
const ForceChangePassword = lazy(() => import("@/pages/force-change-password"));
import Layout from "@/components/layout";
import StudentLayout from "@/components/student-layout";
const Login = lazy(() => import("@/pages/login"));
const ForgotPassword = lazy(() => import("@/pages/forgot-password"));
const ResetPassword = lazy(() => import("@/pages/reset-password"));
import LowBandwidthBanner from "@/components/LowBandwidthBanner";
import { OfflineDetector } from "@/components/offline-detector";
import { RouteProgressBar } from "@/components/route-progress-bar";
import { NetworkStatusBanner } from "@/components/network-status-banner";
const ServerError = lazy(() => import("@/pages/server-error"));

import { KeyboardShortcutsHelp } from "@/components/keyboard-shortcuts-help";
import { useToast } from "@/hooks/use-toast";

// Public & Legal
const Landing = lazy(() => import("@/pages/landing"));
const FeatureShowcase = lazy(() => import("@/pages/features-showcase"));
const FeatureDetail = lazy(() => import("@/pages/features-detail"));
const RoadmapPublic = lazy(() => import("@/pages/roadmap-public"));
const ReleaseNotesPublic = lazy(() => import("@/pages/release-notes-public"));
const StatusPublic = lazy(() => import("@/pages/status-public"));
const Terms = lazy(() => import("@/pages/terms"));
const Privacy = lazy(() => import("@/pages/privacy"));
const Contact = lazy(() => import("@/pages/contact"));
const TrustCenter = lazy(() => import("@/pages/trust"));
const Sitemap = lazy(() => import("@/pages/sitemap"));
const PaperVaultPublic = lazy(() => import("@/pages/paper-vault-public"));

// Teacher / Admin / Assistant
const CoreHub = lazy(() => import("@/pages/core-hub"));
const PlanGrid = lazy(() => import("@/pages/plan-grid"));
const CheckIn = lazy(() => import("@/pages/checkin"));
const SubmitFlow = lazy(() => import("@/pages/submit-flow"));
const GradeFlow = lazy(() => import("@/pages/grade-flow"));
const SchemeCraft = lazy(() => import("@/pages/scheme-craft"));
const QueryVault = lazy(() => import("@/pages/query-vault"));
const CardStack = lazy(() => import("@/pages/cardstack"));
const Syllabuilder = lazy(() => import("@/pages/syllabuilder"));
const KudosEngine = lazy(() => import("@/pages/kudos-engine"));
const Pulse = lazy(() => import("@/pages/pulse"));
const ContentCraft = lazy(() => import("@/pages/content-craft"));
const MarkerMind = lazy(() => import("@/pages/marker-mind"));
const InsightStream = lazy(() => import("@/pages/insight-stream"));
const HelpDesk = lazy(() => import("@/pages/helpdesk"));
const InsightExams = lazy(() => import("@/pages/insight-exams"));
const Exams = lazy(() => import("@/pages/exams"));
const ScanScribe = lazy(() => import("@/pages/scan-scribe"));
const ErrorTrace = lazy(() => import("@/pages/error-trace"));
const TutorCraft = lazy(() => import("@/pages/tutorcraft"));
const Messages = lazy(() => import("@/pages/messages"));

// Admin — Phase 34
const RouteHealthPage = lazy(() => import("@/pages/admin/route-health"));
const FeatureStatusPage = lazy(() => import("@/pages/admin/feature-status"));
const DataQualityPage = lazy(() => import("@/pages/admin/data-quality"));
const SessionSlotsAdminPage = lazy(() => import("@/pages/admin/session-slots"));
const AdminDebugPage = lazy(() => import("@/pages/admin/debug"));
const SystemDiagnosticsPage = lazy(() => import("@/pages/admin/system-diagnostics"));
const ProductionHardeningPage = lazy(() => import("@/pages/admin/production-hardening"));
const TestRunner = lazy(() => import("@/pages/admin/test-runner"));
const FeatureRegistryPage = lazy(() => import("@/pages/admin/feature-registry"));
// Admin
const PaperVaultAdmin = lazy(() => import("@/pages/admin/paper-vault-admin"));
const SubpilotSettings = lazy(() => import("@/pages/admin/subpilot-settings"));
const LandingEditor = lazy(() => import("@/pages/admin/landing-editor"));
const AssistantPermissions = lazy(() => import("@/pages/admin/assistant-permissions"));
const CheckoutPage = lazy(() => import("@/pages/checkout"));
const HelpDeskAdmin = lazy(() => import("@/pages/admin/helpdesk-admin"));
const ShieldCore = lazy(() => import("@/pages/admin/shield-core"));
const QuickSwitch = lazy(() => import("@/pages/admin/quick-switch"));
const BudgetSense = lazy(() => import("@/pages/admin/budget-sense"));
const AutoScale = lazy(() => import("@/pages/admin/auto-scale"));
const SpendWise = lazy(() => import("@/pages/admin/spend-wise"));
const AdminCommand = lazy(() => import("@/pages/admin/admin-command"));
const EnrollmentAudit = lazy(() => import("@/pages/admin/enrollment-audit"));
const PlatformHealth = lazy(() => import("@/pages/admin/platform-health"));
const WorldPilot = lazy(() => import("@/pages/admin/world-pilot"));
const GuardianPulseAdmin = lazy(() => import("@/pages/admin/guardian-pulse-admin"));
const TeacherVerification = lazy(() => import("@/pages/admin/teacher-verification"));
const AiAnalytics = lazy(() => import("@/pages/admin/ai-analytics"));
const AiSafety = lazy(() => import("@/pages/admin/ai-safety"));
const AiMonitoring = lazy(() => import("@/pages/admin/ai-monitoring"));
// Features 18–21
const BillingCenter = lazy(() => import("@/pages/admin/billing-center"));
const DisputeCenter = lazy(() => import("@/pages/admin/dispute-center"));
const FinancialAnomalyPage = lazy(() => import("@/pages/admin/financial-anomaly"));
const SchoolNetwork = lazy(() => import("@/pages/admin/school-network"));
const SubscriptionEnginePage = lazy(() => import("@/pages/admin/subscription-engine"));
const SubscriptionAnalyticsPage = lazy(() => import("@/pages/admin/subscription-analytics"));
const PaymentRecoveryPage = lazy(() => import("@/pages/admin/payment-recovery"));
const PricingExperimentsPage = lazy(() => import("@/pages/admin/pricing-experiments"));
const BillingEventsPage = lazy(() => import("@/pages/admin/billing-events"));
const FinanceControlCenterPage = lazy(() => import("@/pages/admin/finance-control-center"));
const AutoRenewPage = lazy(() => import("@/pages/admin/auto-renew"));
const SubscribeV2Page = lazy(() => import("@/pages/subscribe-v2"));
const GradeForecastPage = lazy(() => import("@/pages/teacher/grade-forecast"));
// Features 22–25
const ArchitecturePage = lazy(() => import("@/pages/admin/architecture"));
const MigrationSafetyPage = lazy(() => import("@/pages/admin/migration-safety"));
const DeploymentPipelinePage = lazy(() => import("@/pages/admin/deployment-pipeline"));
const LoadSimulationPage = lazy(() => import("@/pages/admin/load-simulation"));

// Student Portal
const PastPaperLibrary = lazy(() => import("@/pages/student-portal/past-paper-library"));

// Student
const StudyStream = lazy(() => import("@/pages/student/study-stream"));
const MyHomework = lazy(() => import("@/pages/student/my-homework"));
const MyTimetable = lazy(() => import("@/pages/student/my-timetable"));
const MyAttendance = lazy(() => import("@/pages/student/my-attendance"));
const TheMentor = lazy(() => import("@/pages/student/the-mentor"));
const MyCardStack = lazy(() => import("@/pages/student/my-cardstack"));
const Ascend = lazy(() => import("@/pages/student/ascend"));
const TakeExam = lazy(() => import("@/pages/student/take-exam"));
const SkillBadge = lazy(() => import("@/pages/student/skill-badge"));
const MyQRPage = lazy(() => import("@/pages/student/my-qr"));
const LearnPath = lazy(() => import("@/pages/student/learn-path"));
const RevisionPlanPage = lazy(() => import("@/pages/student/revision-plan"));
const QuestionExtractionPage = lazy(() => import("@/pages/teacher/question-extraction"));
const DiscoverFeed = lazy(() => import("@/pages/student/discover-feed"));
const Revisit = lazy(() => import("@/pages/student/revisit"));
const FocusCoach = lazy(() => import("@/pages/student/focus-coach"));
const FocusZone = lazy(() => import("@/pages/student/focus-zone"));
const SuccessCenter = lazy(() => import("@/pages/student/success-center"));
const TrialVault = lazy(() => import("@/pages/student/trial-vault"));
const PeakRankings = lazy(() => import("@/pages/student/peak-rankings"));
const PeerReview = lazy(() => import("@/pages/student/peer-review"));
const SnapGrade = lazy(() => import("@/pages/student/snap-grade"));
const Echo = lazy(() => import("@/pages/student/echo"));
const StudentAnalytics = lazy(() => import("@/pages/student/analytics"));
const StudyGroups = lazy(() => import("@/pages/student/study-groups"));
const StudentMessages = lazy(() => import("@/pages/student/messages"));
const ExamVault = lazy(() => import("@/pages/student/exam-vault"));

// Shared pages
const TeamForge = lazy(() => import("@/pages/team-forge"));
const PrivacyVault = lazy(() => import("@/pages/privacy-vault"));

// New Phase 1 pages
const Register = lazy(() => import("@/pages/register"));
const Onboarding = lazy(() => import("@/pages/onboarding"));
const Settings = lazy(() => import("@/pages/settings"));
const Referrals = lazy(() => import("@/pages/referrals"));
const Profile = lazy(() => import("@/pages/profile"));
const AccessDenied = lazy(() => import("@/pages/access-denied"));
const SessionsPage = lazy(() => import("@/pages/account/sessions"));
import ReportProblemModal from "@/components/report-problem-modal";
import SessionExpiryModal from "@/components/session-expiry-modal";

// Marketplace & registration
const Courses = lazy(() => import("@/pages/courses"));
const CourseDetail = lazy(() => import("@/pages/course-detail"));
const StudentRegister = lazy(() => import("@/pages/student-register"));
const MyCourses = lazy(() => import("@/pages/teacher/my-courses"));
const TeacherCourses = lazy(() => import("@/pages/teacher/teacher-courses"));
const StudentMyCourses = lazy(() => import("@/pages/student/my-courses"));
const AssignmentCenter = lazy(() => import("@/pages/student/assignments"));
const StudentCourseHub = lazy(() => import("@/pages/student/course-hub"));
const StudentApprovals = lazy(() => import("@/pages/student-approvals"));
const Automation = lazy(() => import("@/pages/automation"));
const LinkParent = lazy(() => import("@/pages/student/link-parent"));

// Phase 7 — Communication, Collaboration & Community Ecosystem
const UnifiedInbox = lazy(() => import("@/pages/unified-inbox"));
const ClassChannel = lazy(() => import("@/pages/class-channel"));
const AnnouncementsPage = lazy(() => import("@/pages/announcements"));
const StudyRooms = lazy(() => import("@/pages/study-rooms"));
const CollaborateRoom = lazy(() => import("@/pages/collaborate"));
const SupportTickets = lazy(() => import("@/pages/support-tickets"));
const NotificationCenter = lazy(() => import("@/pages/notification-center"));
const AttendanceAuditPage = lazy(() => import("@/pages/attendance-audit"));
const EnrollmentTimelinePage = lazy(() => import("@/pages/enrollment-timeline"));
const AdminModeration = lazy(() => import("@/pages/admin/moderation"));
const CommunicationAnalytics = lazy(() => import("@/pages/admin/communication-analytics"));

// Phase 9 — Admin OS
const AdminOS = lazy(() => import("@/pages/admin/admin-os"));
// Phase 47 — Role & Permission Matrix
const RolesMatrix = lazy(() => import("@/pages/admin/roles-matrix"));
// Phase 47 — Repair Panel
const RepairPanel = lazy(() => import("@/pages/admin/repair-panel"));
const ContentCalendarPage = lazy(() => import("@/pages/admin/content-calendar"));

// Phase 16 — Commercialization & Business Operations
const PricingPage = lazy(() => import("@/pages/pricing"));
const SubscribePage = lazy(() => import("@/pages/subscribe"));
const MySubscriptionPage = lazy(() => import("@/pages/my-subscription"));
const ComingSoonPage = lazy(() => import("@/pages/coming-soon"));
const RevisionNotesPage = lazy(() => import("@/pages/revision-notes"));
const AdminCommercePage = lazy(() => import("@/pages/admin/admin-commerce"));
const PlansAdminPage = lazy(() => import("@/pages/admin/plans-admin"));
const ExecutiveDashboardPage = lazy(() => import("@/pages/admin/executive-dashboard"));

// Phase 17 — Mobile Ecosystem
const StudentMobileHome = lazy(() => import("@/pages/mobile/student-home"));
const TeacherMobileHome = lazy(() => import("@/pages/mobile/teacher-home"));
const ParentMobileHome = lazy(() => import("@/pages/mobile/parent-home"));
const AdminMobileHome = lazy(() => import("@/pages/mobile/admin-home"));
const FlashcardSwipe = lazy(() => import("@/pages/student/flashcard-swipe"));
const AdminPushPage = lazy(() => import("@/pages/admin/admin-push"));
import PWAInstallBanner from "@/components/pwa-install-banner";

// Phase 15 — Educational Content Ecosystem
const ContentCraftStudio = lazy(() => import("@/pages/teacher/contentcraft-studio"));
const CourseBuilder = lazy(() => import("@/pages/teacher/course-builder"));
const QuestionStudio = lazy(() => import("@/pages/teacher/question-studio"));
const QuestionImport = lazy(() => import("@/pages/teacher/question-import"));
const ContentAnalytics = lazy(() => import("@/pages/teacher/content-analytics"));
const PracticeCenter = lazy(() => import("@/pages/student/practice-center"));
const HandwrittenSubmit = lazy(() => import("@/pages/student/handwritten-submit"));
const ResourcesLibrary = lazy(() => import("@/pages/resources-library"));

// Phase 8 — Learning Experience, Content Delivery & Adaptive Personalization
const LearningPathPage = lazy(() => import("@/pages/student/learning-path"));
const RecommendationHub = lazy(() => import("@/pages/student/recommendations"));
const GoalsDashboard = lazy(() => import("@/pages/student/goals-dashboard"));
const ChallengesPage = lazy(() => import("@/pages/student/challenges"));
const LearningAnalyticsPage = lazy(() => import("@/pages/student/learning-analytics"));
const MicroAssessmentPage = lazy(() => import("@/pages/student/micro-assessment"));
const FocusZoneV2 = lazy(() => import("@/pages/student/focus-zone-v2"));

// Phase 6 — Assessment, Examination & Certification Ecosystem
const AssessmentHub = lazy(() => import("@/pages/assessment-hub"));
const GradebookPlus = lazy(() => import("@/pages/gradebook-plus"));
const Certifications = lazy(() => import("@/pages/certifications"));
const ExamRoom = lazy(() => import("@/pages/student/exam-room"));
// Phase 6 Extended pages
const TeacherAssessments = lazy(() => import("@/pages/teacher/assessments"));
const AssessmentBuilder = lazy(() => import("@/pages/teacher/assessment-builder"));
const AssessmentMonitor = lazy(() => import("@/pages/teacher/assessment-monitor"));
const TeacherGradebook = lazy(() => import("@/pages/teacher/gradebook"));
const ModerationCenter = lazy(() => import("@/pages/teacher/moderation"));
const SnapGradeReview = lazy(() => import("@/pages/teacher/snapgrade-review"));
const ExamArchives = lazy(() => import("@/pages/teacher/archives"));
const TeacherSchedulePage = lazy(() => import("@/pages/teacher/schedule"));
const TeacherRevenueDashboard = lazy(() => import("@/pages/teacher/revenue-dashboard"));
const FraudMonitorPage = lazy(() => import("@/pages/admin/fraud-monitor"));
const AdminCertificates = lazy(() => import("@/pages/admin/certificates"));
const StudentExamSession = lazy(() => import("@/pages/student/exam-session"));
const ExamResults = lazy(() => import("@/pages/student/exam-results"));
const StudentTranscript = lazy(() => import("@/pages/student/transcript"));
const StudentAppeals = lazy(() => import("@/pages/student/appeals"));
const ExamReadiness = lazy(() => import("@/pages/student/exam-readiness"));
const AiPersonalTutor = lazy(() => import("@/pages/student/ai-personal-tutor"));
const SmartStudyPlan = lazy(() => import("@/pages/student/smart-study-plan"));
const GradePrediction = lazy(() => import("@/pages/student/grade-prediction"));

// Parent
const GuardianHub = lazy(() => import("@/pages/parent/dashboard"));
const GuardianLink = lazy(() => import("@/pages/parent/guardian-link"));
const LinkStudent = lazy(() => import("@/pages/parent/link-student"));
import ParentLayout from "@/components/parent-layout";
const ParentGrades = lazy(() => import("@/pages/parent/grades"));
const ParentAttendance = lazy(() => import("@/pages/parent/attendance"));
const ParentRevision = lazy(() => import("@/pages/parent/revision"));
const ParentAssignments = lazy(() => import("@/pages/parent/assignments"));
const ParentExamReadiness = lazy(() => import("@/pages/parent/exam-readiness"));
const ParentMeetings = lazy(() => import("@/pages/parent/meetings"));
const ParentNotifications = lazy(() => import("@/pages/parent/notifications"));
const ParentInterventions = lazy(() => import("@/pages/parent/interventions"));
const ParentReports = lazy(() => import("@/pages/parent/reports"));
const FamilyCalendar = lazy(() => import("@/pages/parent/calendar"));
const ParentDocuments = lazy(() => import("@/pages/parent/documents"));
const ParentAIAssistant = lazy(() => import("@/pages/parent/ai-assistant"));
const ParentBilling = lazy(() => import("@/pages/parent/billing"));
const ParentSettings = lazy(() => import("@/pages/parent/settings"));
const ChildProfile = lazy(() => import("@/pages/parent/child-profile"));
const Subjects = lazy(() => import("@/pages/subjects"));

const PAGE_MESSAGES = [
  "Preparing your dashboard…",
  "Loading content…",
  "Almost ready…",
  "Fetching data…",
  "Getting things ready…",
];

const PageLoader = ({ message }: { message?: string }) => {
  const msg = message ?? PAGE_MESSAGES[Math.floor(Math.random() * PAGE_MESSAGES.length)];
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 animate-in fade-in duration-300">
      <div className="relative">
        <div className="w-10 h-10 border-2 border-primary/10 rounded-full" />
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin absolute inset-0" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-4 h-4 rounded-full bg-primary/10 animate-pulse" />
        </div>
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-muted-foreground animate-pulse">{msg}</p>
      </div>
    </div>
  );
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        if (error?.status === 401 || error?.status === 403 || error?.status === 404) return false;
        return failureCount < 2;
      },
      retryDelay: (attempt) => Math.min(600 * 2 ** attempt, 10_000),
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnMount: "always",
      networkMode: "offlineFirst",
    },
    mutations: {
      retry: 0,
      networkMode: "offlineFirst",
    },
  },
});

// ─── Role-based access control ───────────────────────────────────────────────

const ADMIN_PREFIXES = ["/admin"];

const TEACHER_ONLY_PREFIXES = [
  "/plan-grid", "/checkin", "/submit-flow", "/grade-flow", "/scheme-craft",
  "/query-vault", "/cardstack", "/syllabuilder", "/kudos-engine", "/pulse",
  "/content-craft", "/marker-mind", "/insight-stream",
  "/risk-report", "/timetable", "/helpdesk", "/insight-exams", "/scan-scribe",
  "/error-trace", "/tutorcraft", "/teacher-courses", "/teacher/",
  "/automation", "/assessment-hub", "/gradebook-plus", "/certifications",
  "/student-approvals", "/corehub",
];

function pathBlocked(path: string, prefixes: string[]): boolean {
  return prefixes.some(
    (p) => path === p || path.startsWith(p + "/") || path.startsWith(p + "?"),
  );
}

function useRoleGuard(role: "student" | "teacher" | "parent") {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const lastBlocked = useRef<string | null>(null);

  useEffect(() => {
    const blockedAdmin = pathBlocked(location, ADMIN_PREFIXES);
    const blockedTeacher = pathBlocked(location, TEACHER_ONLY_PREFIXES);

    const isBlocked =
      role === "student" || role === "parent"
        ? blockedAdmin || blockedTeacher
        : role === "teacher"
          ? blockedAdmin
          : false;

    if (isBlocked && location !== lastBlocked.current) {
      lastBlocked.current = location;
      navigate("/access-denied");
      fetch("/api/auth/audit-event", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "access_denied", resource: location, details: { role } }),
      }).catch(() => {});
    } else if (!isBlocked) {
      lastBlocked.current = null;
    }
  }, [location]); // eslint-disable-line react-hooks/exhaustive-deps
}

// ─────────────────────────────────────────────────────────────────────────────

const ROLE_OVERRIDE_KEY = "aperti_role_override";

export function getRoleOverride(): string | null {
  return localStorage.getItem(ROLE_OVERRIDE_KEY);
}
export function setRoleOverride(role: string | null) {
  if (role) localStorage.setItem(ROLE_OVERRIDE_KEY, role);
  else localStorage.removeItem(ROLE_OVERRIDE_KEY);
}

function RoleOverrideBanner({ originalRole }: { originalRole: string }) {
  const override = getRoleOverride();
  if (!override) return null;
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: "hsl(var(--primary))",
        color: "white",
        textAlign: "center",
        padding: "6px 12px",
        fontSize: 13,
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
      }}
    >
      <span>
        Previewing as <strong>{override}</strong> — you are actually <strong>{originalRole}</strong>
      </span>
      <button
        onClick={() => {
          setRoleOverride(null);
          window.location.reload();
        }}
        style={{
          background: "rgba(255,255,255,0.2)",
          border: "1px solid rgba(255,255,255,0.4)",
          color: "white",
          padding: "2px 10px",
          borderRadius: 4,
          cursor: "pointer",
          fontSize: 12,
        }}
      >
        Exit Preview
      </button>
    </div>
  );
}

function StudentRouter() {
  useRoleGuard("student");
  return (
    <ErrorBoundary>
    <StudentLayout>
      <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/access-denied" component={AccessDenied} />
        <Route path="/account/sessions" component={SessionsPage} />
        <Route path="/onboarding" component={Onboarding} />
        <Route path="/settings" component={Settings} />
        <Route path="/referrals" component={Referrals} />
        <Route path="/profile/:id" component={Profile} />
        <Route path="/courses" component={Courses} />
        <Route path="/courses/:id" component={CourseDetail} />
        <Route path="/my-courses" component={StudentMyCourses} />
        <Route path="/" component={StudyStream} />
        <Route path="/my-homework" component={MyHomework} />
        <Route path="/assignments" component={AssignmentCenter} />
        <Route path="/course-hub" component={StudentCourseHub} />
        <Route path="/my-timetable" component={MyTimetable} />
        <Route path="/my-attendance" component={MyAttendance} />
        <Route path="/mentor" component={TheMentor} />
        <Route path="/flashcards" component={MyCardStack} />
        <Route path="/ascend" component={Ascend} />
        <Route path="/exams/:examId/take" component={TakeExam} />
        <Route path="/skill-badge" component={SkillBadge} />
        <Route path="/learn-path" component={LearnPath} />
        <Route path="/discover" component={DiscoverFeed} />
        <Route path="/revisit" component={Revisit} />
        <Route path="/focus-coach" component={FocusCoach} />
        <Route path="/focus-zone" component={FocusZone} />
        <Route path="/trial-vault" component={TrialVault} />
        <Route path="/peak-rankings" component={PeakRankings} />
        <Route path="/peer-review" component={PeerReview} />
        <Route path="/snap-grade" component={SnapGrade} />
        <Route path="/papers" component={PastPaperLibrary} />
        <Route path="/team-forge" component={TeamForge} />
        <Route path="/privacy-vault" component={PrivacyVault} />
        <Route path="/link-parent" component={LinkParent} />
        <Route path="/echo" component={Echo} />
        <Route path="/analytics" component={StudentAnalytics} />
        <Route path="/study-groups" component={StudyGroups} />
        <Route path="/messages" component={StudentMessages} />
        <Route path="/exam-vault" component={ExamVault} />
        <Route path="/exam-room" component={ExamRoom} />
        <Route path="/student/exams/:id/results" component={ExamResults} />
        <Route path="/student/exams/:id" component={StudentExamSession} />
        <Route path="/student/transcript" component={StudentTranscript} />
        <Route path="/student/appeals" component={StudentAppeals} />
        <Route path="/student/exam-readiness" component={ExamReadiness} />
        <Route path="/success" component={SuccessCenter} />
        {/* Phase 8 — Learning Experience */}
        <Route path="/learning-path" component={LearningPathPage} />
        <Route path="/recommendations" component={RecommendationHub} />
        <Route path="/goals" component={GoalsDashboard} />
        <Route path="/challenges" component={ChallengesPage} />
        <Route path="/learning-analytics" component={LearningAnalyticsPage} />
        <Route path="/micro-assessment" component={MicroAssessmentPage} />
        <Route path="/focus-zone" component={FocusZoneV2} />
        {/* Phase 7 — Communication */}
        <Route path="/inbox" component={UnifiedInbox} />
        <Route path="/channels/:courseId" component={ClassChannel} />
        <Route path="/announcements" component={AnnouncementsPage} />
        <Route path="/rooms" component={StudyRooms} />
        <Route path="/collaborate/:roomId" component={CollaborateRoom} />
        <Route path="/support" component={SupportTickets} />
        <Route path="/notifications" component={NotificationCenter} />
        <Route path="/attendance-audit" component={AttendanceAuditPage} />
        <Route path="/enrollment-timeline" component={EnrollmentTimelinePage} />
        {/* Phase 15 — Educational Content Ecosystem */}
        <Route path="/practice" component={PracticeCenter} />
        <Route path="/submit/handwritten" component={HandwrittenSubmit} />
        <Route path="/resources/library" component={ResourcesLibrary} />
        {/* Phase 16 — Commercialization */}
        <Route path="/pricing" component={PricingPage} />
        <Route path="/subscribe/:planId" component={SubscribePage} />
        <Route path="/account/subscription" component={MySubscriptionPage} />
        <Route path="/coming-soon" component={ComingSoonPage} />
        <Route path="/revision-notes" component={RevisionNotesPage} />
        {/* Phase 21 — Experience & Product Excellence */}
        <Route path="/revision-plan" component={RevisionPlanPage} />
        {/* Phase 17 — Mobile */}
        <Route path="/mobile/home" component={StudentMobileHome} />
        <Route path="/flashcards/swipe" component={FlashcardSwipe} />
        {/* Phase 34 — Student QR Center */}
        <Route path="/my-qr" component={MyQRPage} />
        {/* Phase 51 — AI Intelligence Suite */}
        <Route path="/ai-tutor" component={AiPersonalTutor} />
        <Route path="/smart-study-plan" component={SmartStudyPlan} />
        <Route path="/grade-prediction" component={GradePrediction} />
        <Route path="/500" component={ServerError} />
        <Route component={NotFound} />
      </Switch>
      </Suspense>
    </StudentLayout>
    </ErrorBoundary>
  );
}

const TEACHER_ROUTES = (
  <>
    <Route path="/onboarding" component={Onboarding} />
    <Route path="/settings" component={Settings} />
    <Route path="/profile/:id" component={Profile} />
    <Route path="/courses" component={Courses} />
    <Route path="/courses/:id" component={CourseDetail} />
    <Route path="/my-courses" component={MyCourses} />
    <Route path="/student-approvals" component={StudentApprovals} />
    <Route path="/plan-grid" component={PlanGrid} />
    <Route path="/subjects" component={Subjects} />
    <Route path="/checkin" component={CheckIn} />
    <Route path="/submit-flow" component={SubmitFlow} />
    <Route path="/grade-flow" component={GradeFlow} />
    <Route path="/scheme-craft" component={SchemeCraft} />
    <Route path="/query-vault" component={QueryVault} />
    <Route path="/cardstack" component={CardStack} />
    <Route path="/syllabuilder" component={Syllabuilder} />
    <Route path="/kudos-engine" component={KudosEngine} />
    <Route path="/pulse" component={Pulse} />
    <Route path="/content-craft" component={ContentCraft} />
    <Route path="/exams" component={Exams} />
    <Route path="/marker-mind" component={MarkerMind} />
    <Route path="/insight-stream" component={InsightStream} />
    {/* Aliases — teacher dashboard quick links */}
    <Route path="/analytics" component={InsightStream} />
    <Route path="/risk-report" component={InsightStream} />
    <Route path="/timetable" component={PlanGrid} />
    <Route path="/attendance" component={CheckIn} />
    <Route path="/helpdesk" component={HelpDesk} />
    <Route path="/insight-exams" component={InsightExams} />
    <Route path="/scan-scribe" component={ScanScribe} />
    <Route path="/error-trace" component={ErrorTrace} />
    <Route path="/papers" component={PastPaperLibrary} />
    <Route path="/tutorcraft" component={TutorCraft} />
    <Route path="/messages" component={Messages} />
    <Route path="/teacher-courses" component={TeacherCourses} />
    <Route path="/automation" component={Automation} />
    <Route path="/assessment-hub" component={AssessmentHub} />
    <Route path="/gradebook-plus" component={GradebookPlus} />
    <Route path="/certifications" component={Certifications} />
    <Route path="/teacher/assessments" component={TeacherAssessments} />
    <Route path="/teacher/assessments/:id/builder" component={AssessmentBuilder} />
    <Route path="/teacher/assessments/:id/monitor" component={AssessmentMonitor} />
    <Route path="/teacher/gradebook"><Redirect to="/gradebook-plus" /></Route>
    <Route path="/teacher/grade-forecast" component={GradeForecastPage} />
    <Route path="/teacher/moderation" component={ModerationCenter} />
    <Route path="/teacher/snapgrade/:id/review" component={SnapGradeReview} />
    <Route path="/teacher/archives" component={ExamArchives} />
    <Route path="/teacher/schedule" component={TeacherSchedulePage} />
    {/* Phase 7 — Communication */}
    <Route path="/inbox" component={UnifiedInbox} />
    <Route path="/channels/:courseId" component={ClassChannel} />
    <Route path="/announcements" component={AnnouncementsPage} />
    <Route path="/rooms" component={StudyRooms} />
    <Route path="/collaborate/:roomId" component={CollaborateRoom} />
    <Route path="/support" component={SupportTickets} />
    <Route path="/notifications" component={NotificationCenter} />
    <Route path="/attendance-audit" component={AttendanceAuditPage} />
    <Route path="/enrollment-timeline" component={EnrollmentTimelinePage} />
    {/* Phase 15 — Educational Content Ecosystem */}
    <Route path="/teacher/contentcraft" component={ContentCraftStudio} />
    <Route path="/teacher/contentcraft/:pageId" component={ContentCraftStudio} />
    <Route path="/courses/:courseId/builder" component={CourseBuilder} />
    <Route path="/teacher/question-studio" component={QuestionStudio} />
    <Route path="/teacher/questions/import" component={QuestionImport} />
    <Route path="/teacher/questions/extract" component={QuestionExtractionPage} />
    <Route path="/teacher/analytics/content" component={ContentAnalytics} />
    <Route path="/teacher/revenue" component={TeacherRevenueDashboard} />
    <Route path="/admin/fraud-monitor" component={FraudMonitorPage} />
    <Route path="/resources/library" component={ResourcesLibrary} />
    {/* Phase 16 — Commercialization */}
    <Route path="/pricing" component={PricingPage} />
    <Route path="/subscribe/:planId" component={SubscribePage} />
    <Route path="/account/subscription" component={MySubscriptionPage} />
    <Route path="/coming-soon" component={ComingSoonPage} />
    <Route path="/revision-notes" component={RevisionNotesPage} />
    {/* Phase 17 — Mobile */}
    <Route path="/mobile/home" component={TeacherMobileHome} />
    <Route path="/flashcards/swipe" component={FlashcardSwipe} />
    <Route path="/referrals" component={Referrals} />
  </>
);

const ADMIN_ROUTES = (
  <>
    <Route path="/admin/os/:rest*" component={AdminOS} />
    <Route path="/admin/os" component={AdminOS} />
    <Route path="/admin/command" component={AdminCommand} />
    <Route path="/admin/certificates" component={AdminCertificates} />
    <Route path="/admin/world-pilot" component={WorldPilot} />
    <Route path="/admin/paper-vault" component={PaperVaultAdmin} />
    <Route path="/admin/helpdesk" component={HelpDeskAdmin} />
    <Route path="/admin/shield-core" component={ShieldCore} />
    <Route path="/admin/quick-switch" component={QuickSwitch} />
    <Route path="/admin/budget-sense" component={BudgetSense} />
    <Route path="/admin/auto-scale" component={AutoScale} />
    <Route path="/admin/spend-wise" component={SpendWise} />
    <Route path="/admin/guardian-pulse" component={GuardianPulseAdmin} />
    <Route path="/admin/landing-editor" component={LandingEditor} />
    <Route path="/admin/assistant-permissions" component={AssistantPermissions} />
    <Route path="/admin/teacher-verification" component={TeacherVerification} />
    <Route path="/admin/ai-analytics" component={AiAnalytics} />
    <Route path="/admin/ai-monitoring" component={AiMonitoring} />
    <Route path="/admin/ai-safety" component={AiSafety} />
    <Route path="/admin/subpilot-settings" component={SubpilotSettings} />
    {/* Phase 7 — Admin Communication */}
    <Route path="/admin/moderation" component={AdminModeration} />
    <Route path="/admin/communication-analytics" component={CommunicationAnalytics} />
    {/* Phase 16 — Commerce Admin */}
    <Route path="/admin/plans" component={PlansAdminPage} />
    <Route path="/admin/commerce" component={AdminCommercePage} />
    <Route path="/admin/executive" component={ExecutiveDashboardPage} />
    {/* Phase 17 — Mobile Admin */}
    <Route path="/admin/push" component={AdminPushPage} />
    <Route path="/mobile/home" component={AdminMobileHome} />
    {/* Phase 34 — Data Quality, Route Health, Feature Status, Session Slots */}
    <Route path="/admin/route-health" component={RouteHealthPage} />
    <Route path="/admin/feature-status" component={FeatureStatusPage} />
    <Route path="/admin/data-quality" component={DataQualityPage} />
    <Route path="/admin/session-slots" component={SessionSlotsAdminPage} />
    <Route path="/admin/enrollment-audit" component={EnrollmentAudit} />
    <Route path="/admin/health" component={PlatformHealth} />
    <Route path="/admin/debug" component={AdminDebugPage} />
    <Route path="/admin/system-diagnostics" component={SystemDiagnosticsPage} />
    <Route path="/admin/production-hardening" component={ProductionHardeningPage} />
    <Route path="/admin/test-runner" component={TestRunner} />
    <Route path="/admin/feature-registry" component={FeatureRegistryPage} />
    {/* Phase 36 — /admin/launch shortcut */}
    <Route path="/admin/launch" component={AdminOS} />
    {/* Phase 47 — Role & Permission Matrix */}
    <Route path="/admin/roles-matrix" component={RolesMatrix} />
    {/* Phase 47 — System Repair Panel */}
    <Route path="/admin/repair" component={RepairPanel} />
    {/* Content Calendar */}
    <Route path="/admin/content-calendar" component={ContentCalendarPage} />
    {/* Features 18–21 — Billing, Disputes, AI Anomaly, School Network */}
    <Route path="/admin/billing-center" component={BillingCenter} />
    <Route path="/admin/dispute-center" component={DisputeCenter} />
    <Route path="/admin/financial-anomaly" component={FinancialAnomalyPage} />
    <Route path="/admin/school-network" component={SchoolNetwork} />
    {/* Subscription Engine + Billing Intelligence Suite */}
    <Route path="/admin/subscription-engine" component={SubscriptionEnginePage} />
    <Route path="/admin/subscription-analytics" component={SubscriptionAnalyticsPage} />
    <Route path="/admin/payment-recovery" component={PaymentRecoveryPage} />
    <Route path="/admin/auto-renew" component={AutoRenewPage} />
    <Route path="/admin/pricing-experiments" component={PricingExperimentsPage} />
    <Route path="/admin/billing-events" component={BillingEventsPage} />
    <Route path="/admin/finance-control-center" component={FinanceControlCenterPage} />
    <Route path="/subscribe" component={SubscribeV2Page} />
    {/* Features 22–25 — Architecture, Migration Safety, Deployment, Load Simulation */}
    <Route path="/admin/architecture" component={ArchitecturePage} />
    <Route path="/admin/migration-safety" component={MigrationSafetyPage} />
    <Route path="/admin/deployment-pipeline" component={DeploymentPipelinePage} />
    <Route path="/admin/load-simulation" component={LoadSimulationPage} />
  </>
);

function AdminRouter() {
  return (
    <ErrorBoundary>
    <Layout>
      <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/access-denied" component={AccessDenied} />
        <Route path="/account/sessions" component={SessionsPage} />
        <Route path="/" component={AdminCommand} />
        <Route path="/corehub" component={CoreHub} />
        {TEACHER_ROUTES}
        {ADMIN_ROUTES}
        <Route path="/500" component={ServerError} />
        <Route component={NotFound} />
      </Switch>
      </Suspense>
    </Layout>
    </ErrorBoundary>
  );
}

function TeacherRouter() {
  useRoleGuard("teacher");
  return (
    <ErrorBoundary>
    <Layout>
      <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/access-denied" component={AccessDenied} />
        <Route path="/account/sessions" component={SessionsPage} />
        <Route path="/" component={CoreHub} />
        {TEACHER_ROUTES}
        <Route path="/500" component={ServerError} />
        <Route component={NotFound} />
      </Switch>
      </Suspense>
    </Layout>
    </ErrorBoundary>
  );
}

function ParentRouter() {
  useRoleGuard("parent");
  return (
    <ErrorBoundary>
    <ParentLayout>
      <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/access-denied" component={AccessDenied} />
        <Route path="/account/sessions" component={SessionsPage} />
        {/* Dashboard */}
        <Route path="/" component={GuardianHub} />

        {/* Academic monitoring */}
        <Route path="/parent/grades" component={ParentGrades} />
        <Route path="/parent/attendance" component={ParentAttendance} />
        <Route path="/parent/revision" component={ParentRevision} />
        <Route path="/parent/assignments" component={ParentAssignments} />
        <Route path="/parent/exams" component={ParentExamReadiness} />

        {/* Child profile */}
        <Route path="/parent/child/:studentId" component={ChildProfile} />

        {/* Communication */}
        <Route path="/parent/messages" component={GuardianLink} />
        <Route path="/parent/meetings" component={ParentMeetings} />

        {/* Alerts & reports */}
        <Route path="/parent/notifications" component={ParentNotifications} />
        <Route path="/parent/interventions" component={ParentInterventions} />
        <Route path="/parent/reports" component={ParentReports} />

        {/* Calendar & Documents */}
        <Route path="/parent/calendar" component={FamilyCalendar} />
        <Route path="/parent/documents" component={ParentDocuments} />

        {/* Tools */}
        <Route path="/parent/ai-assistant" component={ParentAIAssistant} />
        <Route path="/parent/billing" component={ParentBilling} />
        <Route path="/parent/settings" component={ParentSettings} />
        <Route path="/parent/link-student" component={LinkStudent} />

        {/* Legacy / shared */}
        <Route path="/parent/guardian-hub" component={GuardianHub} />
        <Route path="/parent/guardian-link" component={GuardianLink} />
        <Route path="/profile/:id" component={Profile} />
        <Route path="/courses" component={Courses} />
        <Route path="/courses/:id" component={CourseDetail} />
        {/* Phase 17 — Mobile */}
        <Route path="/mobile/home" component={ParentMobileHome} />
        <Route path="/500" component={ServerError} />
        <Route component={NotFound} />
      </Switch>
      </Suspense>
    </ParentLayout>
    </ErrorBoundary>
  );
}

function PublicRouter() {
  return (
    <Suspense fallback={<PageLoader />}>
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/register" component={Register} />
      <Route path="/student-register" component={StudentRegister} />
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/checkout" component={CheckoutPage} />
      <Route path="/courses" component={Courses} />
      <Route path="/courses/:id" component={CourseDetail} />
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/contact" component={Contact} />
      <Route path="/trust" component={TrustCenter} />
      <Route path="/sitemap" component={Sitemap} />
      <Route path="/paper-vault" component={PaperVaultPublic} />
      <Route path="/features" component={FeatureShowcase} />
      <Route path="/features/:id" component={FeatureDetail} />
      <Route path="/roadmap" component={RoadmapPublic} />
      <Route path="/release-notes" component={ReleaseNotesPublic} />
      <Route path="/status" component={StatusPublic} />
      <Route path="/500" component={ServerError} />
      <Route component={Landing} />
    </Switch>
    </Suspense>
  );
}

function SessionExpiryGate() {
  const { sessionExpired, clearSessionExpired } = useAuth();
  return <SessionExpiryModal open={sessionExpired} onDismiss={clearSessionExpired} />;
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-10 h-10 border-2 border-primary/20 rounded-full" />
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin absolute inset-0" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-foreground text-sm">Aperti.</p>
            <p className="text-muted-foreground text-xs mt-0.5">Loading your workspace…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <PublicRouter />
      </WouterRouter>
    );
  }

  if (user.mustChangePassword) {
    return (
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <ForceChangePassword />
      </WouterRouter>
    );
  }

  const roleOverride = getRoleOverride();
  const effectiveRole = roleOverride || user.role;

  let router: React.ReactNode;
  if (effectiveRole === "student") {
    router = <StudentRouter />;
  } else if (effectiveRole === "parent") {
    router = <ParentRouter />;
  } else if (effectiveRole === "admin") {
    router = <AdminRouter />;
  } else {
    router = <TeacherRouter />;
  }

  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      {roleOverride && user.role === "admin" && (
        <RoleOverrideBanner originalRole={user.role} />
      )}
      <div style={roleOverride ? { paddingTop: 36 } : undefined}>
        {router}
      </div>
      <ReportProblemModal />
    </WouterRouter>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AuthProvider>
            <ErrorBoundary>
                <a
                  href="#main-content"
                  className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:bg-background focus:border focus:border-primary focus:text-primary focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-medium"
                >
                  Skip to main content
                </a>
                <AppContent />
                <SessionExpiryGate />
              </ErrorBoundary>
          </AuthProvider>
          <RouteProgressBar />
          <NetworkStatusBanner />
          <Toaster />
          <LowBandwidthBanner />
          <OfflineDetector />
          <PWAInstallBanner />
          <KeyboardShortcutsHelp />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
