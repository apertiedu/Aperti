import { Switch, Route, Router as WouterRouter } from "wouter";
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
import PaperVaultAdmin from "@/pages/admin/paper-vault-admin";
import SubPilotAdmin from "@/pages/admin/subpilot-settings";
import HelpDeskAdmin from "@/pages/admin/helpdesk-admin";
import ShieldCore from "@/pages/admin/shield-core";
import QuickSwitch from "@/pages/admin/quick-switch";
import BudgetSense from "@/pages/admin/budget-sense";
import AutoScale from "@/pages/admin/auto-scale";
import SpendWise from "@/pages/admin/spend-wise";
import AdminCommand from "@/pages/admin/admin-command";

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
import TeamForge from "@/pages/team-forge";
import PrivacyVault from "@/pages/privacy-vault";
import ErrorTrace from "@/pages/error-trace";

// Parent
import GuardianHub from "@/pages/parent/guardian-hub";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});

function StudentRouter() {
  return (
    <StudentLayout>
      <Switch>
        <Route path="/" component={StudyStream} />
        <Route path="/my-homework" component={MyHomework} />
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
        <Route path="/team-forge" component={TeamForge} />
        <Route path="/privacy-vault" component={PrivacyVault} />
        <Route component={NotFound} />
      </Switch>
    </StudentLayout>
  );
}

function TeacherRouter() {
  const { user } = useAuth();
  const isAssistant = user?.role === "assistant";
  const isAdmin = user?.role === "admin";

  return (
    <Layout>
      <Switch>
        <Route path="/" component={CoreHub} />
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
        {isAdmin && (
          <>
            <Route path="/admin/command" component={AdminCommand} />
            <Route path="/admin/paper-vault" component={PaperVaultAdmin} />
            <Route path="/admin/subpilot-settings" component={SubPilotAdmin} />
            <Route path="/admin/helpdesk" component={HelpDeskAdmin} />
            <Route path="/admin/shield-core" component={ShieldCore} />
            <Route path="/admin/quick-switch" component={QuickSwitch} />
            <Route path="/admin/budget-sense" component={BudgetSense} />
            <Route path="/admin/auto-scale" component={AutoScale} />
            <Route path="/admin/spend-wise" component={SpendWise} />
          </>
        )}
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function PublicRouter() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
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
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Loading...</p>
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

  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      {user.role === "student" ? <StudentRouter /> : <TeacherRouter />}
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
