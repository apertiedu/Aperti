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
import LinkParent from "@/pages/student/link-parent";

// Parent
import GuardianHub from "@/pages/parent/guardian-hub";
import GuardianLink from "@/pages/parent/guardian-link";
import LinkStudent from "@/pages/parent/link-student";

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
  </>
);

const ADMIN_ROUTES = (
  <>
    <Route path="/admin/command" component={AdminCommand} />
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
    <Layout>
      <Switch>
        <Route path="/onboarding" component={Onboarding} />
        <Route path="/settings" component={Settings} />
        <Route path="/profile/:id" component={Profile} />
        <Route path="/courses" component={Courses} />
        <Route path="/courses/:id" component={CourseDetail} />
        <Route path="/parent/guardian-hub" component={GuardianHub} />
        <Route path="/parent/guardian-link" component={GuardianLink} />
        <Route path="/parent/link-student" component={LinkStudent} />
        <Route path="/" component={GuardianHub} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
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
