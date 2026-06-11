import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  LayoutDashboard, CheckSquare, Users, CalendarClock, FileBarChart,
  BookOpen, ClipboardList, BarChart3, Shield, Search, ChevronRight,
  BookMarked, MessageSquare, TrendingUp, Loader2, User, GraduationCap,
  FileQuestion, Book, Sparkles,
} from "lucide-react";
import { useAuth } from "@/context/auth";
import { apiFetch } from "@/lib/api";

const ALL_ROUTES = [
  { name: "Dashboard",      href: "/",             icon: LayoutDashboard, roles: ["admin", "teacher", "assistant"] },
  { name: "Mark Attendance",href: "/attendance",    icon: CheckSquare,     roles: ["admin", "teacher", "assistant"] },
  { name: "Students",       href: "/students",      icon: Users,           roles: ["admin", "teacher", "assistant"] },
  { name: "Sessions",       href: "/sessions",      icon: CalendarClock,   roles: ["admin", "teacher"] },
  { name: "Subjects",       href: "/subjects",      icon: BookOpen,        roles: ["admin", "teacher"] },
  { name: "Exams & Marks",  href: "/exams",         icon: ClipboardList,   roles: ["admin", "teacher", "assistant"] },
  { name: "Analytics",      href: "/analytics",     icon: BarChart3,       roles: ["admin", "teacher"] },
  { name: "Reports",        href: "/reports",       icon: FileBarChart,    roles: ["admin", "teacher"] },
  { name: "Question Bank",  href: "/question-bank", icon: BookMarked,      roles: ["admin", "teacher"] },
  { name: "Parent Comms",   href: "/parent-comms",  icon: MessageSquare,   roles: ["admin", "teacher"] },
  { name: "Admin Panel",    href: "/admin",         icon: Shield,          roles: ["admin"] },
  { name: "AutoPilot",      href: "/automation",    icon: TrendingUp,      roles: ["admin", "teacher"] },
];

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  person:   User,
  student:  GraduationCap,
  course:   Book,
  subject:  BookOpen,
  topic:    Sparkles,
  question: FileQuestion,
  lesson:   BookOpen,
};

const SEMANTIC_TRIGGER = /\s|weak|hard|easy|igcse|gcse|struggling|explain|find|who|what|show|quiz|exam|topic|chapter/i;

interface SemanticResult {
  id: number;
  name: string;
  subtitle?: string;
  type: string;
  category: string;
  relevance?: number;
  href?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const RECENT_KEY = "aperti_recent_searches";
const MAX_RECENT = 5;

function getRecentSearches(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; }
}
function addRecentSearch(q: string) {
  const prev = getRecentSearches().filter(s => s !== q);
  localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...prev].slice(0, MAX_RECENT)));
}
function clearRecentSearches() {
  localStorage.removeItem(RECENT_KEY);
}

export default function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const [semanticResults, setSemanticResults] = useState<Record<string, SemanticResult[]>>({});
  const [semanticLoading, setSemanticLoading] = useState(false);
  const [universalResults, setUniversalResults] = useState<SemanticResult[]>([]);
  const [universalLoading, setUniversalLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const uAbortRef = useRef<AbortController | null>(null);

  const routes = ALL_ROUTES.filter(r =>
    user && (r.roles as string[]).includes(user.role) &&
    r.name.toLowerCase().includes(query.toLowerCase())
  );

  const isSemantic = query.length >= 3 && SEMANTIC_TRIGGER.test(query);
  const isUniversal = query.length >= 2 && !isSemantic;

  // Semantic search
  useEffect(() => {
    if (!isSemantic) {
      setSemanticResults({});
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      setSemanticLoading(true);
      try {
        const res = await apiFetch("/api/search/semantic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
          signal: abortRef.current.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setSemanticResults(data.groups ?? {});
        }
      } catch (e: any) {
        if (e?.name !== "AbortError") setSemanticResults({});
      } finally {
        setSemanticLoading(false);
      }
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, isSemantic]);

  // Universal (non-semantic) search
  useEffect(() => {
    if (!isUniversal) { setUniversalResults([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (uAbortRef.current) uAbortRef.current.abort();
      uAbortRef.current = new AbortController();
      setUniversalLoading(true);
      try {
        const res = await apiFetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: uAbortRef.current.signal,
        });
        if (res.ok) {
          const data = await res.json();
          setUniversalResults(data.results ?? []);
        }
      } catch (e: any) {
        if (e?.name !== "AbortError") setUniversalResults([]);
      } finally {
        setUniversalLoading(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, isUniversal]);

  // Group universal results by category
  const universalGrouped = universalResults.reduce((acc: Record<string, SemanticResult[]>, item) => {
    const cat = (item as any).category ?? "Results";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const totalSemanticCount = Object.values(semanticResults).reduce((s, a) => s + a.length, 0);

  const handleSelect = useCallback((href: string, searchQuery?: string) => {
    if (searchQuery) addRecentSearch(searchQuery);
    navigate(href);
    onOpenChange(false);
    setQuery("");
    setSelected(0);
  }, [navigate, onOpenChange]);

  useEffect(() => {
    if (open) {
      setRecentSearches(getRecentSearches());
    } else {
      setQuery("");
      setSelected(0);
      setSemanticResults({});
      setUniversalResults([]);
    }
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
      <DialogContent className="p-0 gap-0 max-w-lg overflow-hidden">
        {/* Search input */}
        <div className="flex items-center border-b border-border px-4 py-3 gap-3">
          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <input
            autoFocus
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Search pages or ask anything…"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0); }}
          />
          {semanticLoading && <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />}
          {isSemantic && !semanticLoading && (
            <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" /> AI
            </span>
          )}
          <kbd className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground">ESC</kbd>
        </div>

        <div className="max-h-[440px] overflow-y-auto">
          {/* Navigation results */}
          {routes.length > 0 && (
            <div className="p-2">
              {!isSemantic && (
                <p className="text-[10px] font-bold tracking-widest text-muted-foreground/60 uppercase px-3 pb-1">Pages</p>
              )}
              {routes.map((route, i) => (
                <button
                  key={route.href}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${
                    i === selected ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  }`}
                  onMouseEnter={() => setSelected(i)}
                  onClick={() => handleSelect(route.href)}
                >
                  <route.icon className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1">{route.name}</span>
                  <ChevronRight className="h-3.5 w-3.5 opacity-50" />
                </button>
              ))}
            </div>
          )}

          {/* Universal search results (non-semantic) */}
          {isUniversal && (universalLoading || Object.keys(universalGrouped).length > 0) && (
            <div className="pb-2">
              {routes.length > 0 && <div className="h-px bg-border mx-4 my-1" />}
              {universalLoading ? (
                <div className="flex items-center gap-2 px-5 py-3 text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching…
                </div>
              ) : (
                Object.entries(universalGrouped).map(([category, items]) => (
                  <div key={category} className="px-2 mb-2">
                    <p className="text-[10px] font-bold tracking-widest text-muted-foreground/60 uppercase px-3 py-1">{category}</p>
                    {items.map((item: any) => {
                      const Icon = TYPE_ICONS[item.type] ?? BookOpen;
                      return (
                        <div key={`${item.type}-${item.id}`}
                          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted cursor-pointer"
                          onClick={() => onOpenChange(false)}>
                          <Icon className="h-4 w-4 flex-shrink-0 text-primary/70" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.name}</p>
                            {item.subtitle && (
                              <p className="text-[11px] text-muted-foreground truncate">{item.subtitle}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Semantic results grouped by category */}
          {isSemantic && totalSemanticCount > 0 && (
            <div className="pb-2">
              {routes.length > 0 && <div className="h-px bg-border mx-4 my-1" />}
              {Object.entries(semanticResults).map(([category, items]) => (
                <div key={category} className="px-2 mb-2">
                  <p className="text-[10px] font-bold tracking-widest text-muted-foreground/60 uppercase px-3 py-1">{category}</p>
                  {items.map(item => {
                    const Icon = TYPE_ICONS[item.type] ?? BookOpen;
                    return (
                      <div
                        key={`${item.type}-${item.id}`}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted cursor-pointer text-left"
                        onClick={() => onOpenChange(false)}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0 text-primary" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          {item.subtitle && (
                            <p className="text-[11px] text-muted-foreground truncate">{item.subtitle}</p>
                          )}
                        </div>
                        {item.relevance && (
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {Math.round(item.relevance * 100)}%
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {/* Recently searched — shown only when query is empty */}
          {!query && recentSearches.length > 0 && (
            <div className="px-2 pb-2">
              <div className="flex items-center justify-between px-3 pt-1 pb-1">
                <p className="text-[10px] font-bold tracking-widest text-muted-foreground/60 uppercase">Recent Searches</p>
                <button
                  onClick={() => { clearRecentSearches(); setRecentSearches([]); }}
                  className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                >Clear</button>
              </div>
              {recentSearches.map((s, i) => (
                <button
                  key={i}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted text-sm text-left transition-colors text-muted-foreground"
                  onClick={() => setQuery(s)}
                >
                  <Search className="h-3.5 w-3.5 shrink-0 opacity-50" />
                  <span className="flex-1 truncate">{s}</span>
                </button>
              ))}
            </div>
          )}

          {/* Empty states */}
          {routes.length === 0 && !semanticLoading && totalSemanticCount === 0 && query && (
            <p className="text-sm text-muted-foreground text-center py-8">
              {isSemantic ? "No results found. Try a different query." : "No pages match."}
            </p>
          )}
          {isSemantic && semanticLoading && totalSemanticCount === 0 && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Searching with AI…
            </div>
          )}
        </div>

        <div className="border-t border-border px-4 py-2 flex items-center gap-4 text-[10px] text-muted-foreground">
          <span><kbd className="bg-muted px-1 py-0.5 rounded font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="bg-muted px-1 py-0.5 rounded font-mono">↵</kbd> select</span>
          <span><kbd className="bg-muted px-1 py-0.5 rounded font-mono">⌘K</kbd> toggle</span>
          {isSemantic && (
            <span className="ml-auto text-primary flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" /> FindWise
            </span>
          )}
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
