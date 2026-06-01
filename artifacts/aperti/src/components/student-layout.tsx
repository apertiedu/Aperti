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
  Sun, Moon, LogOut, Users, Shield, Repeat2, Video, Library, Link2,
} from "lucide-react";

const primaryNav = [
  { href: "/", label: "Home", icon: Home },
  { href: "/my-homework", label: "Homework", icon: BookOpen },
  { href: "/mentor", label: "Mentor", icon: Brain },
  { href: "/ascend", label: "Ascend", icon: Flame },
  { href: "/simverse", label: "SimVerse", icon: FlaskConical },
];

const allNav = [
  { href: "/", label: "StudyStream", icon: Home, desc: "Your dashboard" },
  { href: "/my-homework", label: "Homework", icon: BookOpen, desc: "SubmitFlow" },
  { href: "/my-timetable", label: "Timetable", icon: CalendarCheck, desc: "PlanGrid" },
  { href: "/my-attendance", label: "Attendance", icon: CalendarCheck, desc: "CheckIn" },
  { href: "/mentor", label: "The Mentor", icon: Brain, desc: "Adaptive AI tutor" },
  { href: "/flashcards", label: "CardStack", icon: Layers, desc: "Spaced repetition" },
  { href: "/ascend", label: "Ascend", icon: Flame, desc: "Academic RPG" },
  { href: "/simverse", label: "SimVerse", icon: FlaskConical, desc: "Labs & simulations" },
  { href: "/revisit", label: "Revisit", icon: Repeat2, desc: "Revision planner" },
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
  { href: "/live-class", label: "LiveClass", icon: Video, desc: "Join live session" },
  { href: "/privacy-vault", label: "PrivacyVault", icon: Shield, desc: "My data" },
  { href: "/link-parent", label: "Link Parent", icon: Link2, desc: "Connect to parent" },
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
      {/* Top bar — desktop */}
      <header className="hidden md:flex sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border/40 px-6 h-12 items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="font-bold text-base text-foreground">Aperti<span className="text-primary">.</span></span>
          <span className="text-muted-foreground/40 text-xs ml-2">Student</span>
        </div>
        <nav className="flex items-center gap-0.5">
          {primaryNav.map((item) => {
            const active = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-7 text-xs gap-1.5 ${active ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <button onClick={toggleDark} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <button className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-[10px] font-bold">
                {initials}
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>All Modules</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-1 overflow-y-auto">
                {allNav.map((item) => {
                  const active = location === item.href;
                  return (
                    <Link key={item.href} href={item.href} onClick={() => setSheetOpen(false)}>
                      <div className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${active ? "bg-primary/10 text-primary" : "hover:bg-muted text-foreground"}`}>
                        <item.icon className="h-4 w-4 shrink-0" />
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
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors mt-4"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 pb-16 md:pb-4">
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
      <nav className="fixed bottom-0 w-full border-t border-border/60 bg-card/95 backdrop-blur-md z-50 md:hidden">
        <div className="flex justify-around items-center h-14 max-w-lg mx-auto px-2">
          {primaryNav.map((item) => {
            const active = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <button className={`flex flex-col items-center gap-0.5 px-2 py-1 transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}>
                  <item.icon className={`h-5 w-5 ${active ? "text-primary" : ""}`} />
                  <span className="text-[9px] font-medium">{item.label}</span>
                </button>
              </Link>
            );
          })}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <button className={`flex flex-col items-center gap-0.5 px-2 py-1 transition-colors text-muted-foreground`}>
                <MoreHorizontal className="h-5 w-5" />
                <span className="text-[9px] font-medium">More</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[80vh]">
              <SheetHeader>
                <SheetTitle className="text-left">All Modules</SheetTitle>
              </SheetHeader>
              <div className="mt-4 grid grid-cols-2 gap-2 overflow-y-auto pb-6">
                {allNav.map((item) => {
                  const active = location === item.href;
                  return (
                    <Link key={item.href} href={item.href} onClick={() => setSheetOpen(false)}>
                      <div className={`flex items-center gap-2 p-3 rounded-xl text-sm border transition-colors ${active ? "border-primary/40 bg-primary/10 text-primary" : "border-border hover:border-primary/20 hover:bg-muted/60"}`}>
                        <item.icon className="h-4 w-4 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-xs truncate">{item.label}</p>
                          <p className="text-[9px] text-muted-foreground truncate">{item.desc}</p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </div>
  );
}
