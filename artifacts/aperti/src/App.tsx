import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/auth";
import NotFound from "@/pages/not-found";
import Layout from "@/components/layout";
import StudentLayout from "@/components/student-layout";
import Login from "@/pages/login";

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

import StudentDashboard from "@/pages/student-portal/dashboard";
import MyAttendance from "@/pages/student-portal/my-attendance";
import MyHomework from "@/pages/student-portal/my-homework";
import MyResources from "@/pages/student-portal/my-resources";

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
        {isAdmin && <Route path="/admin" component={Admin} />}
        <Route component={NotFound} />
      </Switch>
    </Layout>
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

  if (!user) return <Login />;

  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      {user.role === "student" ? <StudentRouter /> : <TeacherRouter />}
    </WouterRouter>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
