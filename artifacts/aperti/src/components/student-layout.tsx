import { useLocation, Link } from "wouter";
import { LayoutDashboard, CheckSquare, BookOpen, FolderOpen, User, LogOut, School, Award, CreditCard, Video, Layers, Target, Menu, X, Library, Trophy, Flag, Sparkles } from "lucide-react";
import { useAuth } from "@/context/auth";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useTour } from "@/components/onboarding-tour";

const NAV_ITEMS = [
  { name: "Home", href: "/", icon: LayoutDashboard },
  { name: "Attendance", href: "/attendance", icon: CheckSquare },
  { name: "Homework", href: "/homework", icon: BookOpen },
  { name: "Exams", href: "/exams", icon: Award },
  { name: "Practice", href: "/practice", icon: Target },
  { name: "Flashcards", href: "/flashcards", icon: Layers },
  { name: "Past Papers", href: "/papers", icon: Library },
  { name: "My Goals", href: "/goals", icon: Flag },
  { name: "Achievements", href: "/achievements", icon: Trophy },
  { name: "Recordings", href: "/recordings", icon: Video },
  { name: "Resources", href: "/resources", icon: FolderOpen },
  { name: "Invoices", href: "/invoices", icon: CreditCard },
];

// Top 5 for mobile bottom nav
const MOBILE_NAV_ITEMS = NAV_ITEMS.slice(0, 5);

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const { startTour } = useTour();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    toast({ title: "Signed out" });
  };

  const initials = (user?.displayName || user?.username || "S")
    .split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="min-h-[100dvh] flex w-full bg-muted/20 font-sans pb-16 md:pb-0">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-64 bg-card border-r border-border flex-col h-screen sticky top-0 shadow-sm z-20">
        <div className="p-5 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-primary-foreground flex-shrink-0 shadow-sm">
              <School className="w-4.5 h-4.5" style={{width:18,height:18}} />
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-tight text-foreground leading-none">Aperti</h1>
              <p className="text-[10px] text-primary mt-0.5 font-medium">Student Portal</p>
            </div>
          </div>
        </div>

        <div className="px-4 py-4 border-b border-border/50">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border/50">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center text-primary-foreground text-sm font-bold shadow-sm flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{user?.displayName || user?.username}</p>
              <p className="text-[10px] text-primary font-medium">Student</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
          {NAV_ITEMS.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 card-hover ${
                  isActive
                    ? "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <item.icon className={`w-4 h-4 flex-shrink-0 transition-transform ${!isActive && "group-hover:scale-110"}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border/50 space-y-1">
          <button
            onClick={startTour}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all duration-200"
          >
            <Sparkles className="w-4 h-4 flex-shrink-0" />Replay Tour
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />Sign out
          </button>
        </div>
      </div>

      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-card border-b border-border flex items-center justify-between px-4 z-30 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-primary-foreground">
            <School className="w-4 h-4" />
          </div>
          <span className="font-bold text-foreground tracking-tight">Aperti Portal</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
            {initials}
          </div>
          <button onClick={() => setMobileMenuOpen(v => !v)} className="p-2 -mr-2 text-foreground">
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Full Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -10 }}
            className="md:hidden fixed inset-0 top-14 bg-background z-20 overflow-y-auto pb-20"
          >
            <div className="p-4 space-y-1">
              {NAV_ITEMS.map((item) => {
                const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      isActive ? "bg-primary/10 text-primary font-semibold" : "text-foreground hover:bg-muted"
                    }`}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
              <div className="h-px bg-border my-4" />
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-all"
              >
                <LogOut className="w-5 h-5 flex-shrink-0" />Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-auto pt-14 md:pt-0">
        <div className="flex-1 p-4 md:p-6 lg:p-8 max-w-5xl mx-auto w-full relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={location}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border flex items-center justify-around px-2 z-30 pb-safe shadow-[0_-4px_24px_rgba(0,0,0,0.04)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.2)]">
        {MOBILE_NAV_ITEMS.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-all ${
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className={`p-1 rounded-full ${isActive ? 'bg-primary/10' : ''}`}>
                <item.icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : ''}`} />
              </div>
              <span className={`text-[9px] mt-0.5 ${isActive ? 'font-bold' : 'font-medium'}`}>{item.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}