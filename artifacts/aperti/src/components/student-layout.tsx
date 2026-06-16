import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/context/auth";
import { useTheme } from "@/context/theme";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home, BookOpen, CalendarCheck, Brain, Layers, Flame, FlaskConical,
  Target, Clock, Trophy, Star, Camera, FileText, MoreHorizontal,
  Sun, Moon, LogOut, Users, Shield, Repeat2, Library, Link2,
  MessageSquare, BarChart3, Cpu, Lock, GraduationCap,
  Bell, Inbox, Megaphone, Ticket,
} from "lucide-react";
import NotificationBell from "@/components/notification-bell";

const primaryNav = [
  { href: "/", label: "Home", icon: Home },
  { href: "/course-hub", label: "Courses", icon: BookOpen },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/mentor", label: "Mentor", icon: Brain },
  { href: "/flashcards", label: "Flashcards", icon: Layers },
];

const allNav = [
  { href: "/", label: "StudyStream", icon: Home, desc: "Your dashboard" },
  { href: "/success", label: "Success Center", icon: Target, desc: "Focus — weak topics & tasks" },
  { href: "/my-homework", label: "Homework", icon: BookOpen, desc: "SubmitFlow" },
  { href: "/my-timetable", label: "Timetable", icon: CalendarCheck, desc: "PlanGrid" },
  { href: "/my-attendance", label: "Attendance", icon: CalendarCheck, desc: "CheckIn" },
  { href: "/mentor", label: "The Mentor", icon: Brain, desc: "Adaptive AI tutor" },
  { href: "/flashcards", label: "CardStack", icon: Layers, desc: "Spaced repetition" },
  { href: "/ascend", label: "Ascend", icon: Flame, desc: "Academic RPG" },
  { href: "/simverse", label: "SimVerse", icon: FlaskConical, desc: "Labs & simulations" },
  { href: "/revisit", label: "Revisit", icon: Repeat2, desc: "Revision planner" },
  { href: "/revision-plan", label: "Revision Plan", icon: Target, desc: "AI daily study calendar" },
  { href: "/ai-tutor", label: "AI Personal Tutor", icon: Brain, desc: "Adaptive AI teaching engine" },
  { href: "/smart-study-plan", label: "Smart Study Plan", icon: CalendarCheck, desc: "Exam-aware daily schedule" },
  { href: "/grade-prediction", label: "Grade Forecast", icon: BarChart3, desc: "Predict your exam score" },
  { href: "/focus-coach", label: "FocusCoach", icon: Target, desc: "Weak topic tracker" },
  { href: "/focus-zone", label: "FocusZone", icon: Clock, desc: "Distraction-free study" },
  { href: "/papers", label: "Past Papers", icon: Library, desc: "Past paper library" },
  { href: "/trial-vault", label: "TrialVault", icon: FileText, desc: "Mock exams" },
  { href: "/peak-rankings", label: "PeakRankings", icon: Trophy, desc: "Leaderboards" },
  { href: "/peer-review", label: "PeerReview", icon: Users, desc: "Peer assessment" },
  { href: "/snap-grade", label: "SnapGrade", icon: Camera, desc: "Camera OCR grading" },
  { href: "/skill-badge", label: "SkillBadge", icon: Star, desc: "Achievements" },
  { href: "/learn-path", label: "LearnPath", icon: Target, desc: "Learning journey" },
  { href: "/discover", label: "DiscoverFeed", icon: Star, desc: "Curated content" },
  { href: "/team-forge", label: "TeamForge", icon: Users, desc: "Class competitions" },
  { href: "/privacy-vault", label: "PrivacyVault", icon: Shield, desc: "My data" },
  { href: "/link-parent", label: "Link Parent", icon: Link2, desc: "Connect to parent" },
  { href: "/echo", label: "Echo", icon: Brain, desc: "AI learning memory" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, desc: "Academic insights" },
  { href: "/study-groups", label: "Study Groups", icon: Users, desc: "Peer learning" },
  { href: "/messages", label: "Messages", icon: MessageSquare, desc: "Communication" },
  { href: "/inbox", label: "Inbox", icon: Inbox, desc: "Unified messaging" },
  { href: "/announcements", label: "Announcements", icon: Megaphone, desc: "Class announcements" },
  { href: "/rooms", label: "Study Rooms", icon: Users, desc: "Collaboration rooms" },
  { href: "/support", label: "Support", icon: Ticket, desc: "Help & tickets" },
  { href: "/notifications", label: "Notifications", icon: Bell, desc: "Notification settings" },
  { href: "/exam-vault", label: "ExamVault", icon: Lock, desc: "Secure offline exams" },
  { href: "/my-qr", label: "My QR Code", icon: GraduationCap, desc: "Attendance QR & ID card" },
  { href: "/exam-room", label: "Exam Room", icon: GraduationCap, desc: "Take your exams" },
  { href: "/student/exam-readiness", label: "Exam Readiness", icon: Target, desc: "AI readiness dashboard" },
  { href: "/student/transcript", label: "Transcript", icon: FileText, desc: "Academic record" },
  { href: "/student/appeals", label: "Appeals", icon: MessageSquare, desc: "Grade review requests" },
  { href: "/course-hub", label: "Course Hub", icon: BookOpen, desc: "My courses" },
  { href: "/assignments", label: "Assignments", icon: Cpu, desc: "Assignment center" },
  { href: "/learning-path", label: "Learning Path", icon: Target, desc: "Adaptive journey" },
  { href: "/recommendations", label: "For You", icon: Star, desc: "Personalised picks" },
  { href: "/goals", label: "My Goals", icon: Shield, desc: "Learning goals & XP" },
  { href: "/challenges", label: "Challenges", icon: Trophy, desc: "Compete & earn XP" },
  { href: "/learning-analytics", label: "Analytics", icon: BarChart3, desc: "Deep learning insights" },
  { href: "/micro-assessment", label: "Quick Quiz", icon: Flame, desc: "Adaptive micro-quiz" },
];

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { dark, toggleDark } = useTheme();
  const [sheetOpen, setSheetOpen] = useState(false);

  const initials = (user?.displayName || user?.username || "S")
    .split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      {/* Top bar — desktop */}
      <header className="hidden md:flex sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border/40 px-6 h-12 items-center justify-between shrink-0" role="banner">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-base text-foreground">Aperti</span>
          <span className="text-muted-foreground/40 text-xs ml-2" aria-label="Student portal">Student</span>
        </div>
        <nav className="flex items-center gap-0.5" aria-label="Primary navigation">
          {primaryNav.map((item) => {
            const active = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-7 text-xs gap-1.5 focus:outline-none focus:ring-2 focus:ring-primary ${active ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"}`}
                  aria-current={active ? "page" : undefined}
                >
                  <item.icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <button
            onClick={toggleDark}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {dark ? <Sun className="h-3.5 w-3.5" aria-hidden="true" /> : <Moon className="h-3.5 w-3.5" aria-hidden="true" />}
          </button>
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <button
                className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[10px] font-bold focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                aria-label="Open all modules menu"
              >
                {initials}
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>All Modules</SheetTitle>
              </SheetHeader>
              <nav className="mt-4 space-y-1 overflow-y-auto" aria-label="All modules">
                {allNav.map((item) => {
                  const active = location === item.href;
                  return (
                    <Link key={item.href} href={item.href} onClick={() => setSheetOpen(false)}>
                      <div
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${active ? "bg-primary/10 text-primary" : "hover:bg-muted text-foreground"}`}
                        aria-current={active ? "page" : undefined}
                      >
                        <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <div>
                          <p className="font-medium text-xs">{item.label}</p>
                          <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors mt-4 focus:outline-none focus:ring-2 focus:ring-destructive"
                  aria-label="Sign out of Aperti"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Sign out
                </button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 pb-16 md:pb-4" id="main-content">
        <AnimatePresence mode="wait">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom tab bar — mobile */}
      <nav
        className="fixed bottom-0 w-full border-t border-border/60 bg-card/95 backdrop-blur-md z-50 md:hidden"
        aria-label="Mobile navigation"
      >
        <div className="flex justify-around items-center h-14 max-w-lg mx-auto px-2">
          {primaryNav.map((item) => {
            const active = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <button
                  className={`flex flex-col items-center gap-0.5 px-2 py-1 transition-colors focus:outline-none focus:ring-2 focus:ring-primary rounded ${active ? "text-primary" : "text-muted-foreground"}`}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                >
                  <item.icon className={`h-5 w-5 ${active ? "text-primary" : ""}`} aria-hidden="true" />
                  <span className="text-[9px] font-medium">{item.label}</span>
                </button>
              </Link>
            );
          })}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <button
                className="flex flex-col items-center gap-0.5 px-2 py-1 transition-colors text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary rounded"
                aria-label="More navigation options"
              >
                <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
                <span className="text-[9px] font-medium">More</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[80vh]">
              <SheetHeader>
                <SheetTitle className="text-left">All Modules</SheetTitle>
              </SheetHeader>
              <nav className="mt-4 grid grid-cols-2 gap-2 overflow-y-auto pb-6" aria-label="All modules grid">
                {allNav.map((item) => {
                  const active = location === item.href;
                  return (
                    <Link key={item.href} href={item.href} onClick={() => setSheetOpen(false)}>
                      <div
                        className={`flex items-center gap-2 p-3 rounded-xl text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${active ? "border-primary/40 bg-primary/10 text-primary" : "border-border hover:border-primary/20 hover:bg-muted/60"}`}
                        aria-current={active ? "page" : undefined}
                      >
                        <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="font-medium text-xs truncate">{item.label}</p>
                          <p className="text-[9px] text-muted-foreground truncate">{item.desc}</p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </div>
  );
}
