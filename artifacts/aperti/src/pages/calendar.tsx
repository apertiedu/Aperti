import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Calendar, X, Clock, Users,
  GraduationCap, BookOpen, Wifi, Building2, ExternalLink,
  ClipboardList, BookText, CalendarDays
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, isToday, isSameDay, parseISO, addMonths, subMonths } from "date-fns";
import { Link } from "wouter";

type CalEvent = {
  id: string; type: "session" | "exam" | "homework"; date: string;
  title: string; subtitle: string;
  meta: { sessionId?: number; examId?: number; homeworkId?: number; type?: string; studentCount?: number; onlineLink?: string | null };
  color: "blue" | "purple" | "amber";
};

const EVENT_STYLES: Record<string, { bg: string; text: string; border: string; dot: string; icon: React.ElementType }> = {
  session:  { bg: "bg-blue-50 dark:bg-blue-950/40",   text: "text-blue-700 dark:text-blue-300",   border: "border-blue-200 dark:border-blue-800",   dot: "bg-blue-500",   icon: CalendarDays },
  exam:     { bg: "bg-violet-50 dark:bg-violet-950/40",text: "text-violet-700 dark:text-violet-300",border: "border-violet-200 dark:border-violet-800",dot: "bg-violet-500",icon: GraduationCap },
  homework: { bg: "bg-amber-50 dark:bg-amber-950/40",  text: "text-amber-700 dark:text-amber-300",  border: "border-amber-200 dark:border-amber-800",  dot: "bg-amber-500",  icon: BookText },
};

function EventPill({ event, compact = false }: { event: CalEvent; compact?: boolean }) {
  const s = EVENT_STYLES[event.type];
  return (
    <div className={`${s.bg} ${s.text} ${s.border} border rounded-md px-1.5 py-0.5 ${compact ? "text-[10px]" : "text-xs"} font-semibold truncate flex items-center gap-1`}>
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
      <span className="truncate">{event.title}</span>
    </div>
  );
}

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const fetchEvents = useCallback((month: Date) => {
    setLoading(true);
    const start = format(startOfMonth(month), "yyyy-MM-dd");
    const end = format(endOfMonth(month), "yyyy-MM-dd");
    fetch(`/api/calendar/events?start=${start}&end=${end}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(setEvents)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchEvents(currentMonth); }, [currentMonth, fetchEvents]);

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const startPad = getDay(startOfMonth(currentMonth)); // 0 = Sun

  const eventsOnDay = (day: Date) =>
    events.filter(e => isSameDay(parseISO(e.date), day));

  const selectedEvents = selectedDay ? eventsOnDay(selectedDay) : [];

  // KPIs for the month
  const sessionCount = new Set(events.filter(e => e.type === "session").map(e => e.meta.sessionId)).size;
  const examCount = events.filter(e => e.type === "exam").length;
  const homeworkCount = events.filter(e => e.type === "homework").length;
  const totalEvents = events.length;

  const kpis = [
    { label: "Sessions", value: sessionCount, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/40", icon: CalendarDays },
    { label: "Exams", value: examCount, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950/40", icon: GraduationCap },
    { label: "Homework", value: homeworkCount, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/40", icon: BookText },
    { label: "Total Events", value: totalEvents, color: "text-foreground", bg: "bg-muted", icon: Calendar },
  ];

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
            <Calendar className="w-7 h-7 text-primary" /> Calendar
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Sessions, exams and homework at a glance</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrentMonth(new Date())}>Today</Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-bold min-w-[120px] text-center">{format(currentMonth, "MMMM yyyy")}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map(k => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`${k.bg} p-2 rounded-lg`}>
                  <k.icon className={`w-4 h-4 ${k.color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">{k.label}</p>
                  <p className={`text-xl font-black ${k.color}`}>{loading ? "—" : k.value}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs font-semibold flex-wrap">
        {(["session", "exam", "homework"] as const).map(t => {
          const s = EVENT_STYLES[t];
          return (
            <span key={t} className={`flex items-center gap-1.5 ${s.text}`}>
              <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
              {t.charAt(0).toUpperCase() + t.slice(1)}s
            </span>
          );
        })}
      </div>

      <div className="flex gap-5 items-start">
        {/* Calendar Grid */}
        <Card className={`border-border/60 shadow-sm flex-1 transition-all ${selectedDay ? "lg:flex-[2]" : ""}`}>
          <CardContent className="p-4">
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                <div key={d} className="text-center text-xs font-bold text-muted-foreground py-2">{d}</div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden">
              {/* Padding cells */}
              {Array.from({ length: startPad }).map((_, i) => (
                <div key={`pad-${i}`} className="bg-muted/30 min-h-[80px] p-1" />
              ))}

              {days.map(day => {
                const dayEvents = eventsOnDay(day);
                const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;
                const today = isToday(day);
                const inMonth = isSameMonth(day, currentMonth);
                const MAX_SHOW = 2;

                return (
                  <motion.div
                    key={day.toISOString()}
                    className={`bg-background min-h-[80px] p-1.5 cursor-pointer transition-colors hover:bg-muted/40 relative
                      ${isSelected ? "ring-2 ring-primary ring-inset z-10" : ""}
                      ${!inMonth ? "opacity-40" : ""}`}
                    onClick={() => setSelectedDay(isSelected ? null : day)}
                  >
                    <div className={`text-xs font-bold mb-1 w-6 h-6 flex items-center justify-center rounded-full mx-auto
                      ${today ? "bg-primary text-primary-foreground" : "text-foreground"}`}>
                      {format(day, "d")}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, MAX_SHOW).map(e => (
                        <EventPill key={e.id} event={e} compact />
                      ))}
                      {dayEvents.length > MAX_SHOW && (
                        <div className="text-[10px] text-muted-foreground font-semibold pl-1">
                          +{dayEvents.length - MAX_SHOW} more
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Day Detail Panel */}
        <AnimatePresence>
          {selectedDay && (
            <motion.div
              initial={{ opacity: 0, x: 20, width: 0 }}
              animate={{ opacity: 1, x: 0, width: "auto" }}
              exit={{ opacity: 0, x: 20, width: 0 }}
              className="hidden lg:block w-72 shrink-0"
            >
              <Card className="border-border/60 shadow-sm">
                <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm font-bold">
                      {format(selectedDay, "EEEE")}
                    </CardTitle>
                    <p className="text-muted-foreground text-xs">{format(selectedDay, "dd MMMM yyyy")}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 -mt-1" onClick={() => setSelectedDay(null)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </CardHeader>
                <CardContent className="pt-0 space-y-2 max-h-[520px] overflow-y-auto custom-scrollbar">
                  {selectedEvents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-center gap-2">
                      <Calendar className="w-8 h-8 opacity-20" />
                      <p className="text-sm font-medium">Nothing scheduled</p>
                    </div>
                  ) : (
                    selectedEvents.map(e => {
                      const s = EVENT_STYLES[e.type];
                      const Icon = s.icon;
                      return (
                        <motion.div key={e.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
                          <div className={`${s.bg} ${s.border} border rounded-xl p-3`}>
                            <div className="flex items-start gap-2.5">
                              <div className={`${s.bg} border ${s.border} p-1.5 rounded-lg shrink-0`}>
                                <Icon className={`w-3.5 h-3.5 ${s.text}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-bold ${s.text} truncate`}>{e.title}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">{e.subtitle}</p>
                                {e.type === "session" && e.meta.studentCount !== undefined && (
                                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      {e.meta.type === "online" ? <Wifi className="w-3 h-3" /> : <Building2 className="w-3 h-3" />}
                                      {e.meta.type}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Users className="w-3 h-3" /> {e.meta.studentCount}
                                    </span>
                                  </div>
                                )}
                                {e.type === "session" && e.meta.onlineLink && (
                                  <a href={e.meta.onlineLink} target="_blank" rel="noopener noreferrer"
                                    className={`mt-1.5 flex items-center gap-1 text-xs ${s.text} hover:underline font-medium`}
                                    onClick={ev => ev.stopPropagation()}>
                                    <ExternalLink className="w-3 h-3" /> Join session
                                  </a>
                                )}
                                {e.type === "exam" && (
                                  <Link href="/exams">
                                    <span className={`mt-1.5 flex items-center gap-1 text-xs ${s.text} hover:underline font-medium cursor-pointer`}>
                                      <ClipboardList className="w-3 h-3" /> View exam
                                    </span>
                                  </Link>
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile: Selected Day Events */}
      <AnimatePresence>
        {selectedDay && selectedEvents.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="lg:hidden">
            <Card className="border-border/60">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold">{format(selectedDay, "EEEE, dd MMMM")}</CardTitle>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedDay(null)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {selectedEvents.map(e => {
                  const s = EVENT_STYLES[e.type];
                  return (
                    <div key={e.id} className={`${s.bg} ${s.border} border rounded-xl p-3 flex items-center gap-3`}>
                      <div className={`w-2 h-2 rounded-full ${s.dot} shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold ${s.text} truncate`}>{e.title}</p>
                        <p className="text-xs text-muted-foreground">{e.subtitle}</p>
                      </div>
                      <Badge variant="secondary" className="text-[10px] shrink-0">{e.type}</Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
