import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  LayoutDashboard, CheckSquare, Users, CalendarClock, FileBarChart,
  BookOpen, ClipboardList, BarChart3, Shield, Search, ChevronRight,
  BookMarked, MessageSquare, TrendingUp
} from "lucide-react";
import { useAuth } from "@/context/auth";

const ALL_ROUTES = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, roles: ["admin", "teacher", "assistant"] },
  { name: "Mark Attendance", href: "/attendance", icon: CheckSquare, roles: ["admin", "teacher", "assistant"] },
  { name: "Students", href: "/students", icon: Users, roles: ["admin", "teacher", "assistant"] },
  { name: "Sessions", href: "/sessions", icon: CalendarClock, roles: ["admin", "teacher"] },
  { name: "Subjects", href: "/subjects", icon: BookOpen, roles: ["admin", "teacher"] },
  { name: "Exams & Marks", href: "/exams", icon: ClipboardList, roles: ["admin", "teacher", "assistant"] },
  { name: "Analytics", href: "/analytics", icon: BarChart3, roles: ["admin", "teacher"] },
  { name: "Reports", href: "/reports", icon: FileBarChart, roles: ["admin", "teacher"] },
  { name: "Question Bank", href: "/question-bank", icon: BookMarked, roles: ["admin", "teacher"] },
  { name: "Parent Comms", href: "/parent-comms", icon: MessageSquare, roles: ["admin", "teacher"] },
  { name: "Admin Panel", href: "/admin", icon: Shield, roles: ["admin"] },
];

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const routes = ALL_ROUTES.filter(r =>
    user && (r.roles as string[]).includes(user.role) &&
    r.name.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = useCallback((href: string) => {
    navigate(href);
    onOpenChange(false);
    setQuery("");
    setSelected(0);
  }, [navigate, onOpenChange]);

  useEffect(() => {
    if (!open) { setQuery(""); setSelected(0); }
  }, [open]);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "ArrowDown") { e.preventDefault(); setSelected(s => Math.min(s + 1, routes.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
      if (e.key === "Enter" && routes[selected]) { handleSelect(routes[selected].href); }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [open, routes, selected, handleSelect]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-md overflow-hidden">
        <div className="flex items-center border-b border-border px-4 py-3 gap-3">
          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <input
            autoFocus
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Search pages..."
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0); }}
          />
          <kbd className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground">ESC</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {routes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No results found</p>
          ) : (
            routes.map((route, i) => (
              <button
                key={route.href}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${i === selected ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                onMouseEnter={() => setSelected(i)}
                onClick={() => handleSelect(route.href)}
              >
                <route.icon className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1">{route.name}</span>
                <ChevronRight className="h-3.5 w-3.5 opacity-50" />
              </button>
            ))
          )}
        </div>
        <div className="border-t border-border px-4 py-2 flex items-center gap-4 text-[10px] text-muted-foreground">
          <span><kbd className="bg-muted px-1 py-0.5 rounded font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="bg-muted px-1 py-0.5 rounded font-mono">↵</kbd> select</span>
          <span><kbd className="bg-muted px-1 py-0.5 rounded font-mono">⌘K</kbd> toggle</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, []);

  return { open, setOpen };
}
