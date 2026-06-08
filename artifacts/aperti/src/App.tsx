import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/auth";
import { TourProvider } from "@/components/onboarding-tour";
import { ThemeProvider } from "@/context/theme";
import ErrorBoundary from "@/components/error-boundary";
import NotFound from "@/pages/not-found";
import Layout from "@/components/layout";
import StudentLayout from "@/components/student-layout";
import Login from "@/pages/login";
import { useEffect } from "react";

// Public & Legal
import Landing from "@/pages/landing";
import Terms from "@/pages/terms";
import Privacy from "@/pages/privacy";
import Contact from "@/pages/contact";
import Sitemap from "@/pages/sitemap";
import PaperVaultPublic from "@/pages/paper-vault-public";

// Teacher / Admin / Assistant
import CoreHub from "@/pages/core-hub";
import PlanGrid from "@/pages/plan-grid";
import CheckIn from "@/pages/checkin";
import SubmitFlow from "@/pages/submit-flow";
import GradeFlow from "@/pages/grade-flow";
import SchemeCraft from "@/pages/scheme-craft";
import QueryVault from "@/pages/query-vault";
import CardStack from "@/pages/cardstack";
import Syllabuilder from "@/pages/syllabuilder";
import KudosEngine from "@/pages/kudos-engine";
import Pulse from "@/pages/pulse";
import LiveClass from "@/pages/live-class";
import ClassForge from "@/pages/class-forge";
import ContentCraft from "@/pages/content-craft";
import LabBuilder from "@/pages/lab-builder";
import MarkerMind from "@/pages/marker-mind";
import InsightStream from "@/pages/insight-stream";
import InkSpace from "@/pages/inkspace";
import TwinControl from "@/pages/twin-control";
import SubPilot from "@/pages/subpilot";
import HelpDesk from "@/pages/helpdesk";
import InsightExams from "@/pages/insight-exams";
import ScanScribe from "@/pages/scan-scribe";
import ErrorTrace from "@/pages/error-trace";
import TutorCraft from "@/pages/tutorcraft";
import Messages from "@/pages/messages";

// Admin
import PaperVaultAdmin from "@/pages/admin/paper-vault-admin";
import SubPilotAdmin from "@/pages/admin/subpilot-settings";
import LandingEditor from "@/pages/admin/landing-editor";
import AssistantPermissions from "@/pages/admin/assistant-permissions";
import CheckoutPage from "@/pages/checkout";
import HelpDeskAdmin from "@/pages/admin/helpdesk-admin";
import ShieldCore from "@/pages/admin/shield-core";
import QuickSwitch from "@/pages/admin/quick-switch";
import BudgetSense from "@/pages/admin/budget-sense";
import AutoScale from "@/pages/admin/auto-scale";
import SpendWise from "@/pages/admin/spend-wise";
import AdminCommand from "@/pages/admin/admin-command";
import WorldPilot from "@/pages/admin/world-pilot";
import GuardianPulseAdmin from "@/pages/admin/guardian-pulse-admin";
import TeacherVerification from "@/pages/admin/teacher-verification";
import AiAnalytics from "@/pages/admin/ai-analytics";
import AiSafety from "@/pages/admin/ai-safety";

// Student Portal
import PastPaperLibrary from "@/pages/student-portal/past-paper-library";

// Student
import StudyStream from "@/pages/student/study-stream";
import MyHomework from "@/pages/student/my-homework";
import MyTimetable from "@/pages/student/my-timetable";
import MyAttendance from "@/pages/student/my-attendance";
import TheMentor from "@/pages/student/the-mentor";
import MyCardStack from "@/pages/student/my-cardstack";
import Ascend from "@/pages/student/ascend";
import SimVerse from "@/pages/student/simverse";
import TakeExam from "@/pages/student/take-exam";
import SkillBadge from "@/pages/student/skill-badge";
import LearnPath from "@/pages/student/learn-path";
import DiscoverFeed from "@/pages/student/discover-feed";
import Revisit from "@/pages/student/revisit";
import FocusCoach from "@/pages/student/focus-coach";
import FocusZone from "@/pages/student/focus-zone";
import TrialVault from "@/pages/student/trial-vault";
import PeakRankings from "@/pages/student/peak-rankings";
import PeerReview from "@/pages/student/peer-review";
import SnapGrade from "@/pages/student/snap-grade";
import LiveClassSession from "@/pages/student/live-class-session";
import Echo from "@/pages/student/echo";
import StudentAnalytics from "@/pages/student/analytics";
import StudyGroups from "@/pages/student/study-groups";
import StudentMessages from "@/pages/student/messages";
import ExamVault from "@/pages/student/exam-vault";
import StudentInkSpace from "@/pages/student/inkspace";
import ForgeFieldLab from "@/pages/student/labs/forge-field";
import ReactSphereLab from "@/pages/student/labs/react-sphere";
import GeometrixLab from "@/pages/student/labs/geometrix";
import BioSphereLab from "@/pages/student/labs/biosphere";

// Shared pages
import TeamForge from "@/pages/team-forge";
import PrivacyVault from "@/pages/privacy-vault";

// New Phase 1 pages
import Register from "@/pages/register";
import Onboarding from "@/pages/onboarding";
import Settings from "@/pages/settings";
import Profile from "@/pages/profile";

// Marketplace & registration
import Courses from "@/pages/courses";
import CourseDetail from "@/pages/course-detail";
import StudentRegister from "@/pages/student-register";
import MyCourses from "@/pages/teacher/my-courses";
import TeacherCourses from "@/pages/teacher/teacher-courses";
import StudentMyCourses from "@/pages/student/my-courses";
import AssignmentCenter from "@/pages/student/assignments";
import StudentCourseHub from "@/pages/student/course-hub";
import StudentApprovals from "@/pages/student-approvals";
import Automation from "@/pages/automation";
import LinkParent from "@/pages/student/link-parent";

// Phase 7 — Communication, Collaboration & Community Ecosystem
import UnifiedInbox from "@/pages/unified-inbox";
import ClassChannel from "@/pages/class-channel";
import AnnouncementsPage from "@/pages/announcements";
import StudyRooms from "@/pages/study-rooms";
import CollaborateRoom from "@/pages/collaborate";
import SupportTickets from "@/pages/support-tickets";
import NotificationCenter from "@/pages/notification-center";
import AdminModeration from "@/pages/admin/moderation";
import CommunicationAnalytics from "@/pages/admin/communication-analytics";

// Phase 9 — Admin OS
import AdminOS from "@/pages/admin/admin-os";

// Phase 8 — Learning Experience, Content Delivery & Adaptive Personalization
import LearningPathPage from "@/pages/student/learning-path";
import RecommendationHub from "@/pages/student/recommendations";
import GoalsDashboard from "@/pages/student/goals-dashboard";
import ChallengesPage from "@/pages/student/challenges";
import LearningAnalyticsPage from "@/pages/student/learning-analytics";
import MicroAssessmentPage from "@/pages/student/micro-assessment";
import FocusZoneV2 from "@/pages/student/focus-zone-v2";

// Phase 6 — Assessment, Examination & Certification Ecosystem
import AssessmentHub from "@/pages/assessment-hub";
import GradebookPlus from "@/pages/gradebook-plus";
import Certifications from "@/pages/certifications";
import ExamRoom from "@/pages/student/exam-room";
// Phase 6 Extended pages
import TeacherAssessments from "@/pages/teacher/assessments";
import AssessmentBuilder from "@/pages/teacher/assessment-builder";
import AssessmentMonitor from "@/pages/teacher/assessment-monitor";
import TeacherGradebook from "@/pages/teacher/gradebook";
import ModerationCenter from "@/pages/teacher/moderation";
import ExamArchives from "@/pages/teacher/archives";
import AdminCertificates from "@/pages/admin/certificates";
import StudentExamSession from "@/pages/student/exam-session";
import ExamResults from "@/pages/student/exam-results";
import StudentTranscript from "@/pages/student/transcript";
import StudentAppeals from "@/pages/student/appeals";
import ExamReadiness from "@/pages/student/exam-readiness";

// Parent
import GuardianHub from "@/pages/parent/dashboard";
import GuardianLink from "@/pages/parent/guardian-link";
import LinkStudent from "@/pages/parent/link-student";
import ParentLayout from "@/components/parent-layout";
import ParentGrades from "@/pages/parent/grades";
import ParentAttendance from "@/pages/parent/attendance";
import ParentRevision from "@/pages/parent/revision";
import ParentAssignments from "@/pages/parent/assignments";
import ParentExamReadiness from "@/pages/parent/exam-readiness";
import ParentMeetings from "@/pages/parent/meetings";
import ParentNotifications from "@/pages/parent/notifications";
import ParentInterventions from "@/pages/parent/interventions";
import ParentReports from "@/pages/parent/reports";
import FamilyCalendar from "@/pages/parent/calendar";
import ParentDocuments from "@/pages/parent/documents";
import ParentAIAssistant from "@/pages/parent/ai-assistant";
import ParentBilling from "@/pages/parent/billing";
import ParentSettings from "@/pages/parent/settings";
import ChildProfile from "@/pages/parent/child-profile";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});

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
        background: "#00796B",
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
  return (
    <StudentLayout>
      <Switch>
        <Route path="/onboarding" component={Onboarding} />
        <Route path="/settings" component={Settings} />
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
        <Route path="/simverse" component={SimVerse} />
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
        <Route path="/live-class" component={LiveClassSession} />
        <Route path="/labs/forge-field" component={ForgeFieldLab} />
        <Route path="/labs/react-sphere" component={ReactSphereLab} />
        <Route path="/labs/geometrix" component={GeometrixLab} />
        <Route path="/labs/biosphere" component={BioSphereLab} />
        <Route path="/papers" component={PastPaperLibrary} />
        <Route path="/team-forge" component={TeamForge} />
        <Route path="/privacy-vault" component={PrivacyVault} />
        <Route path="/link-parent" component={LinkParent} />
        <Route path="/echo" component={Echo} />
        <Route path="/analytics" component={StudentAnalytics} />
        <Route path="/study-groups" component={StudyGroups} />
        <Route path="/messages" component={StudentMessages} />
        <Route path="/exam-vault" component={ExamVault} />
        <Route path="/inkspace" component={StudentInkSpace} />
        <Route path="/exam-room" component={ExamRoom} />
        <Route path="/student/exams/:id/results" component={ExamResults} />
        <Route path="/student/exams/:id" component={StudentExamSession} />
        <Route path="/student/transcript" component={StudentTranscript} />
        <Route path="/student/appeals" component={StudentAppeals} />
        <Route path="/student/exam-readiness" component={ExamReadiness} />
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
        <Route component={NotFound} />
      </Switch>
    </StudentLayout>
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
    <Route path="/checkin" component={CheckIn} />
    <Route path="/submit-flow" component={SubmitFlow} />
    <Route path="/grade-flow" component={GradeFlow} />
    <Route path="/scheme-craft" component={SchemeCraft} />
    <Route path="/query-vault" component={QueryVault} />
    <Route path="/cardstack" component={CardStack} />
    <Route path="/syllabuilder" component={Syllabuilder} />
    <Route path="/kudos-engine" component={KudosEngine} />
    <Route path="/pulse" component={Pulse} />
    <Route path="/live-class" component={LiveClass} />
    <Route path="/class-forge" component={ClassForge} />
    <Route path="/content-craft" component={ContentCraft} />
    <Route path="/lab-builder" component={LabBuilder} />
    <Route path="/marker-mind" component={MarkerMind} />
    <Route path="/insight-stream" component={InsightStream} />
    <Route path="/inkspace" component={InkSpace} />
    <Route path="/twin-control" component={TwinControl} />
    <Route path="/subpilot" component={SubPilot} />
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
    <Route path="/teacher/gradebook" component={TeacherGradebook} />
    <Route path="/teacher/moderation" component={ModerationCenter} />
    <Route path="/teacher/archives" component={ExamArchives} />
    {/* Phase 7 — Communication */}
    <Route path="/inbox" component={UnifiedInbox} />
    <Route path="/channels/:courseId" component={ClassChannel} />
    <Route path="/announcements" component={AnnouncementsPage} />
    <Route path="/rooms" component={StudyRooms} />
    <Route path="/collaborate/:roomId" component={CollaborateRoom} />
    <Route path="/support" component={SupportTickets} />
    <Route path="/notifications" component={NotificationCenter} />
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
    <Route path="/admin/subpilot-settings" component={SubPilotAdmin} />
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
    <Route path="/admin/ai-safety" component={AiSafety} />
    {/* Phase 7 — Admin Communication */}
    <Route path="/admin/moderation" component={AdminModeration} />
    <Route path="/admin/communication-analytics" component={CommunicationAnalytics} />
  </>
);

function AdminRouter() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={AdminCommand} />
        <Route path="/corehub" component={CoreHub} />
        {TEACHER_ROUTES}
        {ADMIN_ROUTES}
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function TeacherRouter() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={CoreHub} />
        {TEACHER_ROUTES}
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function ParentRouter() {
  return (
    <ParentLayout>
      <Switch>
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

        <Route component={NotFound} />
      </Switch>
    </ParentLayout>
  );
}

function PublicRouter() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/student-register" component={StudentRegister} />
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/checkout" component={CheckoutPage} />
      <Route path="/courses" component={Courses} />
      <Route path="/courses/:id" component={CourseDetail} />
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/contact" component={Contact} />
      <Route path="/sitemap" component={Sitemap} />
      <Route path="/paper-vault" component={PaperVaultPublic} />
      <Route component={Landing} />
    </Switch>
  );
}

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-xs">Loading Aperti…</p>
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
    </WouterRouter>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AuthProvider>
            <TourProvider>
              <ErrorBoundary>
                <AppContent />
              </ErrorBoundary>
            </TourProvider>
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
