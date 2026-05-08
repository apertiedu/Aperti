import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useAuth } from "@/context/auth";
import { Button } from "@/components/ui/button";
import {
  X, ChevronRight, ChevronLeft, SkipForward, Sparkles,
  LayoutDashboard, Users, CheckSquare, CalendarClock, FileBarChart,
  BookOpen, BarChart3, MessageSquare, Wand2, Package, GraduationCap,
  Award, Target, Brain, FileText, ClipboardList, BookMarked,
  Shield, Play, AlertTriangle, Zap, Star
} from "lucide-react";

type TourStep = {
  title: string;
  description: string;
  icon: any;
  route?: string;
  highlight?: string;
  badge?: string;
};

const TEACHER_STEPS: TourStep[] = [
  { title: "Welcome to Aperti Nexus!", description: "You're now inside the most advanced AI academic operating system for educators. Let's take a 2-minute tour so you know exactly where everything lives.", icon: Sparkles, badge: "Welcome" },
  { title: "Your Dashboard", description: "The dashboard gives you a real-time snapshot of your academy — today's attendance, upcoming sessions, recent exam scores, and AI-generated risk alerts for students who need attention.", icon: LayoutDashboard, route: "/", highlight: "nav-dashboard", badge: "Step 1" },
  { title: "Student Management", description: "Add and manage all your students here. Each student has a code, phone number, parent contact, and can be assigned up to 3 weekly sessions. Click the chart icon on any student row to see their full academic profile.", icon: Users, route: "/students", badge: "Step 2" },
  { title: "Attendance Tracking", description: "Mark attendance by scanning a student's QR code or typing their student code. The system auto-marks absences weekly. You can also export weekly attendance as a CSV.", icon: CheckSquare, route: "/attendance", badge: "Step 3" },
  { title: "Sessions & Timetable", description: "Define your weekly recurring lesson slots — set the day, time, subject, and whether each session is in-centre, online, or hybrid. Students are assigned to sessions here.", icon: CalendarClock, route: "/sessions", badge: "Step 4" },
  { title: "Exams & Marking", description: "Create exams, build question papers, and enter student marks in a live grid. The system auto-calculates percentages, IGCSE grades, and generates trend analytics per student.", icon: FileBarChart, route: "/exams", badge: "Step 5" },
  { title: "Online Examination", description: "Assign exams for students to take live in the browser. Students answer MCQ and structured questions with a countdown timer, auto-save, and instant MCQ marking. You monitor their progress in real time.", icon: Play, route: "/exams", badge: "Step 6" },
  { title: "Question Bank & AI Generator", description: "Build a reusable library of questions tagged by topic, difficulty, and marks. Then use the AI Exam Generator to automatically build balanced exams from your bank in seconds.", icon: Brain, route: "/question-bank", badge: "Step 7" },
  { title: "Analytics & Risk Report", description: "Deep analytics across all your students — attendance rates, grade distributions, predicted IGCSE grades, and an AI Risk Detection engine that flags students in danger of falling behind.", icon: BarChart3, route: "/analytics", badge: "Step 8" },
  { title: "AI Weekly Reports", description: "Generate professionally formatted academic reports for every student in one click. Each report includes smart metrics, AI insights, action plans, and can be exported as a CSV for bulk WhatsApp sending.", icon: FileText, route: "/reports", badge: "Step 9" },
  { title: "Parent Communication", description: "Generate WhatsApp-ready messages for parents — absence alerts, low attendance warnings, exam reminders, and weekly performance summaries. One-click copy or direct WhatsApp link.", icon: MessageSquare, route: "/parent-comms", badge: "Step 10" },
  { title: "Inventory & Sales", description: "Track your books, revision sheets, and worksheets. Record sales, monitor stock levels, get low-stock alerts, and view your revenue — all in one place.", icon: Package, route: "/inventory", badge: "Step 11" },
  { title: "You're all set! 🎉", description: "You now know every corner of Aperti Nexus. Start by adding your students, setting up your sessions, and marking your first attendance. You can replay this tour anytime from the sidebar.", icon: Star, badge: "Done!" },
];

const ADMIN_STEPS: TourStep[] = [
  { title: "Welcome, Admin!", description: "As an Admin you have full control over the entire platform — all teachers, students, accounts, and system settings.", icon: Sparkles, badge: "Welcome" },
  { title: "Admin Control Center", description: "The Admin panel gives you a bird's-eye view of the entire system — total students, teachers, attendance rates, and a live activity log of everything happening on the platform.", icon: Shield, route: "/admin", badge: "Step 1" },
  { title: "Account Management", description: "Create teacher, assistant, and student accounts. Set roles, suspend accounts, reset passwords, and manage the full user directory from one place.", icon: Users, route: "/admin", badge: "Step 2" },
  { title: "Analytics Overview", description: "See platform-wide analytics — grade distributions, at-risk students, top performers, and teacher workspace stats to understand which teachers have the most engaged students.", icon: BarChart3, route: "/analytics", badge: "Step 3" },
  { title: "Past Paper Library", description: "Upload and manage past exam papers with full metadata — subject, year, session, variant. All teachers and students can access them. Only admins can upload or delete.", icon: BookMarked, route: "/past-papers", badge: "Step 4" },
  { title: "Inventory & Sales", description: "Manage physical inventory — books, sheets, worksheets. Track stock, record sales, and monitor revenue across the academy.", icon: Package, route: "/inventory", badge: "Step 5" },
  { title: "Risk Detection Engine", description: "The AI Risk Report scans all students for attendance drops, low exam performance, and disengagement signals. Instant visibility into who needs intervention.", icon: AlertTriangle, route: "/risk-report", badge: "Step 6" },
  { title: "You're all set! 🎉", description: "You have full control of Aperti Nexus. Manage accounts, monitor the platform, and use the analytics to keep every teacher and student on track.", icon: Star, badge: "Done!" },
];

const ASSISTANT_STEPS: TourStep[] = [
  { title: "Welcome, Assistant!", description: "As a teacher assistant, you have access to the key operational tools — attendance, student management, and exams.", icon: Sparkles, badge: "Welcome" },
  { title: "Your Dashboard", description: "Your dashboard shows a summary of today's activity — how many students attended, upcoming sessions, and recent marks entered.", icon: LayoutDashboard, route: "/", badge: "Step 1" },
  { title: "Student Management", description: "View and manage students assigned to your teacher. You can add students, update their information, and view their attendance history.", icon: Users, route: "/students", badge: "Step 2" },
  { title: "Attendance Marking", description: "Mark attendance using student codes or QR scanning. You can view and manage attendance for all your teacher's sessions.", icon: CheckSquare, route: "/attendance", badge: "Step 3" },
  { title: "Exam Marks", description: "Enter and review student marks for exams created by your teacher. The system calculates grades automatically.", icon: ClipboardList, route: "/exams", badge: "Step 4" },
  { title: "You're all set! 🎉", description: "You're ready to get started. Focus on marking attendance accurately and keeping student records up to date.", icon: Star, badge: "Done!" },
];

const STUDENT_STEPS: TourStep[] = [
  { title: "Welcome to Aperti Nexus!", description: "Your personal academic portal is ready. Everything about your learning journey lives here — attendance, exams, flashcards, revision, and more.", icon: Sparkles, badge: "Welcome" },
  { title: "Your Dashboard", description: "Your dashboard shows your attendance rate, latest exam scores, XP level, active goals, and recent AI insights from your teacher. Check it daily to stay on track.", icon: LayoutDashboard, route: "/", badge: "Step 1" },
  { title: "Attendance", description: "Track every session you've attended. You can see your attendance rate, which sessions you missed, and a GitHub-style heatmap of your consistency over the past 26 weeks.", icon: CheckSquare, route: "/attendance", badge: "Step 2" },
  { title: "Online Exams", description: "Take exams your teacher assigns directly in the browser. MCQ questions are auto-marked instantly — structured questions are marked by your teacher.", icon: Play, route: "/exams", badge: "Step 3" },
  { title: "Flashcards & Revision", description: "Study with AI-powered flashcards organised by topic. The spaced repetition engine prioritises the cards you're weakest on. Earn XP for every session.", icon: BookOpen, route: "/flashcards", badge: "Step 4" },
  { title: "Practice Exams", description: "Test yourself with past paper questions in a timed exam environment. See topic-by-topic breakdowns of your performance after each session.", icon: Brain, route: "/practice", badge: "Step 5" },
  { title: "Goals & Achievements", description: "Set targets for your attendance rate, exam average, or revision streak. Earn badges and XP as you hit milestones. Climb the class leaderboard.", icon: Target, route: "/goals", badge: "Step 6" },
  { title: "Past Paper Library", description: "Browse and download past papers, mark schemes, and examiner reports — organised by subject, year, and session. Great for last-minute exam prep.", icon: BookMarked, route: "/papers", badge: "Step 7" },
  { title: "You're all set! 🎉", description: "Your learning journey starts now. Check your dashboard every day, stay consistent with attendance, and keep revising. Good luck! 🚀", icon: Star, badge: "Done!" },
];

const STEPS_BY_ROLE: Record<string, TourStep[]> = {
  admin: ADMIN_STEPS,
  teacher: TEACHER_STEPS,
  assistant: ASSISTANT_STEPS,
  student: STUDENT_STEPS,
};

const ROLE_COLORS: Record<string, { from: string; to: string; accent: string }> = {
  admin:     { from: "from-rose-500",    to: "to-pink-600",    accent: "text-rose-600" },
  teacher:   { from: "from-indigo-500",  to: "to-violet-600",  accent: "text-indigo-600" },
  assistant: { from: "from-sky-500",     to: "to-blue-600",    accent: "text-sky-600" },
  student:   { from: "from-emerald-500", to: "to-teal-600",    accent: "text-emerald-600" },
};

interface TourContextType {
  startTour: () => void;
  isTourDone: boolean;
}
const TourContext = createContext<TourContextType | null>(null);
export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be within TourProvider");
  return ctx;
}

const LS_KEY = (role: string) => `aperti_tour_done_${role}`;

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [isTourDone, setIsTourDone] = useState(true);

  const role = user?.role ?? "teacher";
  const steps = STEPS_BY_ROLE[role] ?? TEACHER_STEPS;
  const color = ROLE_COLORS[role] ?? ROLE_COLORS.teacher;

  const saveProgress = useCallback(async (done: boolean, s: number) => {
    try {
      await fetch("/api/tutorial/progress", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: done, lastStep: s }),
      });
    } catch (_) {}
    if (done && user?.role) localStorage.setItem(LS_KEY(user.role), "1");
  }, [user?.role]);

  useEffect(() => {
    if (!user) return;
    const lsDone = !!localStorage.getItem(LS_KEY(user.role));
    if (lsDone) { setIsTourDone(true); return; }
    // Check server
    fetch("/api/tutorial/progress", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d || !d.exists || !d.completed) {
          setIsTourDone(false);
          // Small delay to let the app render first
          setTimeout(() => setVisible(true), 800);
        } else {
          setIsTourDone(true);
          if (user?.role) localStorage.setItem(LS_KEY(user.role), "1");
        }
      })
      .catch(() => {
        setIsTourDone(false);
        setTimeout(() => setVisible(true), 800);
      });
  }, [user]);

  const startTour = useCallback(() => {
    if (!user?.role) return;
    localStorage.removeItem(LS_KEY(user.role));
    setStep(0);
    setIsTourDone(false);
    setVisible(true);
  }, [user?.role]);

  const dismiss = (done: boolean) => {
    setVisible(false);
    setIsTourDone(true);
    saveProgress(done, step);
  };

  const goToStep = (idx: number) => {
    const s = steps[idx];
    if (s?.route) navigate(s.route);
    setStep(idx);
    saveProgress(false, idx);
  };

  const next = () => {
    if (step < steps.length - 1) goToStep(step + 1);
    else dismiss(true);
  };

  const prev = () => { if (step > 0) goToStep(step - 1); };

  const currentStep = steps[step];
  const Icon = currentStep?.icon ?? Sparkles;
  const progress = (step / (steps.length - 1)) * 100;
  const isLast = step === steps.length - 1;
  const isFirst = step === 0;

  return (
    <TourContext.Provider value={{ startTour, isTourDone }}>
      {children}
      <AnimatePresence>
        {visible && currentStep && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 sm:p-6"
            style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>

            <motion.div
              initial={{ y: 40, scale: 0.95, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 40, scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", damping: 22, stiffness: 300 }}
              className="w-full max-w-md bg-card border border-border rounded-3xl shadow-2xl overflow-hidden">

              {/* Progress bar */}
              <div className="h-1 bg-border">
                <motion.div
                  className={`h-full bg-gradient-to-r ${color.from} ${color.to}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.4, ease: "easeInOut" }}
                />
              </div>

              {/* Header */}
              <div className="px-6 pt-5 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${color.from} ${color.to} flex items-center justify-center shadow-md flex-shrink-0`}>
                      <AnimatePresence mode="wait">
                        <motion.div key={step}
                          initial={{ rotate: -10, scale: 0.7, opacity: 0 }}
                          animate={{ rotate: 0, scale: 1, opacity: 1 }}
                          exit={{ rotate: 10, scale: 0.7, opacity: 0 }}
                          transition={{ duration: 0.2 }}>
                          <Icon className="h-6 w-6 text-white" />
                        </motion.div>
                      </AnimatePresence>
                    </div>
                    <div>
                      {currentStep.badge && (
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${color.accent} px-2 py-0.5 rounded-full bg-current/10`}>
                          {currentStep.badge}
                        </span>
                      )}
                      <AnimatePresence mode="wait">
                        <motion.h2 key={`title-${step}`}
                          initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
                          className="text-base font-bold text-foreground mt-0.5 leading-snug">
                          {currentStep.title}
                        </motion.h2>
                      </AnimatePresence>
                    </div>
                  </div>
                  <button onClick={() => dismiss(false)} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 mt-0.5">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="px-6 pb-5">
                <AnimatePresence mode="wait">
                  <motion.p key={`desc-${step}`}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                    className="text-sm text-muted-foreground leading-relaxed">
                    {currentStep.description}
                  </motion.p>
                </AnimatePresence>

                {/* Step dots */}
                <div className="flex items-center justify-center gap-1.5 my-5">
                  {steps.map((_, i) => (
                    <button key={i} onClick={() => goToStep(i)}
                      className={`rounded-full transition-all duration-200 ${
                        i === step ? `w-6 h-2 bg-gradient-to-r ${color.from} ${color.to}` :
                        i < step ? `w-2 h-2 ${color.from.replace("from-", "bg-")} opacity-60` :
                        "w-2 h-2 bg-muted"
                      }`}
                    />
                  ))}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {!isFirst && (
                    <Button variant="ghost" size="sm" onClick={prev} className="gap-1 text-muted-foreground">
                      <ChevronLeft className="h-4 w-4" />Back
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => dismiss(false)} className="text-muted-foreground gap-1 ml-auto">
                    <SkipForward className="h-3.5 w-3.5" />Skip tour
                  </Button>
                  <Button onClick={next}
                    className={`gap-1.5 bg-gradient-to-r ${color.from} ${color.to} hover:opacity-90 text-white shadow-sm px-4`}>
                    {isLast ? "Get started!" : "Next"}
                    {!isLast && <ChevronRight className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </TourContext.Provider>
  );
}
