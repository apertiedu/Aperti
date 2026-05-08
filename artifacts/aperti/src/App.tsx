import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/auth";
import { TourProvider } from "@/components/onboarding-tour";
import { ThemeProvider } from "@/context/theme";
import NotFound from "@/pages/not-found";
import Layout from "@/components/layout";
import StudentLayout from "@/components/student-layout";
import Login from "@/pages/login";

import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Attendance from "@/pages/attendance";
import Students from "@/pages/students";
import Sessions from "@/pages/sessions";
import Reports from "@/pages/reports";
import Admin from "@/pages/admin";
import Subjects from "@/pages/subjects";
import Exams from "@/pages/exams";
import Analytics from "@/pages/analytics";
import StudentProfile from "@/pages/student-profile";
import QuestionBank from "@/pages/question-bank";
import ParentComms from "@/pages/parent-comms";
import HomeworkPage from "@/pages/homework";
import ResourcesPage from "@/pages/resources";
import PaymentsPage from "@/pages/payments";
import RecordingsPage from "@/pages/recordings";
import FlashcardsPage from "@/pages/flashcards";
import CoursesPage from "@/pages/courses";
import CentersPage from "@/pages/centers";
import PastPapersPage from "@/pages/past-papers";
import ExamGeneratorPage from "@/pages/exam-generator";

import StudentDashboard from "@/pages/student-portal/dashboard";
import MyAttendance from "@/pages/student-portal/my-attendance";
import MyHomework from "@/pages/student-portal/my-homework";
import MyResources from "@/pages/student-portal/my-resources";
import MyExams from "@/pages/student-portal/my-exams";
import MyInvoices from "@/pages/student-portal/my-invoices";
import MyRecordings from "@/pages/student-portal/my-recordings";
import MyFlashcards from "@/pages/student-portal/my-flashcards";
import PracticeExams from "@/pages/student-portal/practice-exams";
import PastPaperLibrary from "@/pages/student-portal/past-paper-library";
import MyGoals from "@/pages/student-portal/my-goals";
import AchievementsPage from "@/pages/student-portal/achievements";
import RiskReportPage from "@/pages/risk-report";
import TakeExam from "@/pages/student-portal/take-exam";
import ExamMonitor from "@/pages/exam-monitor";
import InventoryPage from "@/pages/inventory";
import TimetablePage from "@/pages/timetable";
import MyTimetable from "@/pages/student-portal/my-timetable";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});

function StudentRouter() {
  return (
    <StudentLayout>
      <Switch>
        <Route path="/" component={StudentDashboard} />
        <Route path="/attendance" component={MyAttendance} />
        <Route path="/homework" component={MyHomework} />
        <Route path="/resources" component={MyResources} />
        <Route path="/exams" component={MyExams} />
        <Route path="/invoices" component={MyInvoices} />
        <Route path="/recordings" component={MyRecordings} />
        <Route path="/flashcards" component={MyFlashcards} />
        <Route path="/practice" component={PracticeExams} />
        <Route path="/papers" component={PastPaperLibrary} />
        <Route path="/goals" component={MyGoals} />
        <Route path="/achievements" component={AchievementsPage} />
        <Route path="/exams/:examId/take" component={TakeExam} />
        <Route path="/timetable" component={MyTimetable} />
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
        <Route path="/" component={Dashboard} />
        <Route path="/attendance" component={Attendance} />
        <Route path="/students" component={Students} />
        <Route path="/students/:id" component={StudentProfile} />
        <Route path="/exams" component={Exams} />
        {!isAssistant && <Route path="/sessions" component={Sessions} />}
        {!isAssistant && <Route path="/subjects" component={Subjects} />}
        {!isAssistant && <Route path="/analytics" component={Analytics} />}
        {!isAssistant && <Route path="/reports" component={Reports} />}
        {!isAssistant && <Route path="/question-bank" component={QuestionBank} />}
        {!isAssistant && <Route path="/parent-comms" component={ParentComms} />}
        {!isAssistant && <Route path="/homework" component={HomeworkPage} />}
        {!isAssistant && <Route path="/resources" component={ResourcesPage} />}
        {!isAssistant && <Route path="/recordings" component={RecordingsPage} />}
        {!isAssistant && <Route path="/payments" component={PaymentsPage} />}
        {!isAssistant && <Route path="/flashcards" component={FlashcardsPage} />}
        {!isAssistant && <Route path="/courses" component={CoursesPage} />}
        {!isAssistant && <Route path="/centers" component={CentersPage} />}
        {!isAssistant && <Route path="/past-papers" component={PastPapersPage} />}
        {!isAssistant && <Route path="/exam-generator" component={ExamGeneratorPage} />}
        {!isAssistant && <Route path="/risk-report" component={RiskReportPage} />}
        {!isAssistant && <Route path="/inventory" component={InventoryPage} />}
        {!isAssistant && <Route path="/timetable" component={TimetablePage} />}
        <Route path="/exams/:examId/monitor" component={ExamMonitor} />
        {isAdmin && <Route path="/admin" component={Admin} />}
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function PublicRouter() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AuthProvider>
            <TourProvider>
              <AppContent />
            </TourProvider>
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
