import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Clock, Wifi, Building2, BookOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
const DAY_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  Monday:    { bg: "bg-blue-50 dark:bg-blue-950/30",    border: "border-blue-200 dark:border-blue-800",    text: "text-blue-700 dark:text-blue-300",    dot: "bg-blue-500" },
  Tuesday:   { bg: "bg-purple-50 dark:bg-purple-950/30", border: "border-purple-200 dark:border-purple-800", text: "text-purple-700 dark:text-purple-300", dot: "bg-purple-500" },
  Wednesday: { bg: "bg-emerald-50 dark:bg-emerald-950/30",border: "border-emerald-200 dark:border-emerald-800",text: "text-emerald-700 dark:text-emerald-300",dot: "bg-emerald-500" },
  Thursday:  { bg: "bg-orange-50 dark:bg-orange-950/30", border: "border-orange-200 dark:border-orange-800", text: "text-orange-700 dark:text-orange-300", dot: "bg-orange-500" },
  Friday:    { bg: "bg-rose-50 dark:bg-rose-950/30",     border: "border-rose-200 dark:border-rose-800",     text: "text-rose-700 dark:text-rose-300",     dot: "bg-rose-500" },
  Saturday:  { bg: "bg-amber-50 dark:bg-amber-950/30",   border: "border-amber-200 dark:border-amber-800",   text: "text-amber-700 dark:text-amber-300",   dot: "bg-amber-500" },
  Sunday:    { bg: "bg-slate-50 dark:bg-slate-900/50",   border: "border-slate-200 dark:border-slate-700",   text: "text-slate-600 dark:text-slate-400",   dot: "bg-slate-400" },
};

type MySession = {
  id: number; lessonNumber: number; dayOfWeek: string; startTime: string;
  type: string; capacity: number | null; onlineLink: string | null; subjectName: string | null;
};

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function getTodayName() {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date().getDay()];
}

export default function MyTimetable() {
  const [sessions, setSessions] = useState<MySession[]>([]);
  const [loading, setLoading] = useState(true);
  const today = getTodayName();

  useEffect(() => {
    fetch("/api/portal/timetable", { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, []);

  const byDay = DAYS.reduce((acc, day) => {
    acc[day] = sessions.filter(s => s.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
    return acc;
  }, {} as Record<string, MySession[]>);

  const activeDays = DAYS.filter(d => byDay[d].length > 0);

  const todaySessions = byDay[today] ?? [];
  const nextDay = activeDays.find(d => {
    const dayOrder = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
    const todayIdx = dayOrder.indexOf(today);
    const dIdx = dayOrder.indexOf(d);
    return dIdx > todayIdx;
  });
  const nextSessions = nextDay ? byDay[nextDay] : [];

  return (
    <div className="max-w-2xl mx-auto space-y-6 px-4 py-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-sm">
          <CalendarDays className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">My Schedule</h1>
          <p className="text-sm text-muted-foreground">Your weekly lesson timetable</p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Loading your schedule...</div>
      ) : sessions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-10 text-center flex flex-col items-center gap-3 text-muted-foreground">
            <CalendarDays className="h-10 w-10 opacity-20" />
            <p>No sessions assigned yet.</p>
            <p className="text-sm">Your teacher will assign you to a lesson group.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Today / Next highlight */}
          {(todaySessions.length > 0 || nextSessions.length > 0) && (
            <div className="space-y-3">
              {todaySessions.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-primary mb-2">Today — {today}</p>
                  <div className="space-y-2">
                    {todaySessions.map(s => {
                      const c = DAY_COLORS[today] ?? DAY_COLORS.Sunday;
                      return (
                        <motion.div key={s.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                          className={`rounded-xl border-2 p-4 ${c.bg} border-primary/40`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-base font-bold">{formatTime(s.startTime)}</span>
                                <Badge className="text-[10px] px-1.5 py-0 bg-primary">Today</Badge>
                              </div>
                              {s.subjectName && (
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <BookOpen className="h-3.5 w-3.5" />{s.subjectName}
                                </div>
                              )}
                            </div>
                            <Badge variant="outline" className={`text-xs ${s.type === "online" ? "border-sky-300 text-sky-600" : "border-slate-300 text-slate-600"}`}>
                              {s.type === "online" ? <Wifi className="h-3 w-3 mr-1" /> : <Building2 className="h-3 w-3 mr-1" />}
                              {s.type === "online" ? "Online" : "Centre"}
                            </Badge>
                          </div>
                          {s.type === "online" && s.onlineLink && (
                            <a href={s.onlineLink} target="_blank" rel="noopener noreferrer"
                              className="mt-3 inline-flex items-center gap-1 text-sm bg-sky-600 text-white px-3 py-1.5 rounded-lg hover:bg-sky-500 transition-colors">
                              <Wifi className="h-3.5 w-3.5" />Join Online Lesson →
                            </a>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}
              {nextSessions.length > 0 && todaySessions.length === 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Next — {nextDay}</p>
                  {nextSessions.map(s => {
                    const c = DAY_COLORS[nextDay!] ?? DAY_COLORS.Sunday;
                    return (
                      <div key={s.id} className={`rounded-xl border p-3 ${c.bg} ${c.border}`}>
                        <p className="font-semibold text-sm">{formatTime(s.startTime)}</p>
                        {s.subjectName && <p className="text-xs text-muted-foreground mt-0.5">{s.subjectName}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Full weekly breakdown */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Full Week</p>
            <div className="space-y-3">
              {activeDays.map((day, di) => {
                const c = DAY_COLORS[day] ?? DAY_COLORS.Sunday;
                const isToday = day === today;
                return (
                  <motion.div key={day}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: di * 0.04 }}>
                    <Card className={`border-border/50 overflow-hidden ${isToday ? "ring-1 ring-primary" : ""}`}>
                      <div className={`px-4 py-2.5 border-b ${c.bg} ${c.border} flex items-center gap-2`}>
                        <div className={`w-2 h-2 rounded-full ${c.dot}`} />
                        <span className={`text-sm font-bold ${c.text}`}>{day}</span>
                        {isToday && <Badge className="text-[10px] px-1.5 py-0 bg-primary ml-1">Today</Badge>}
                      </div>
                      <div className="divide-y divide-border/50">
                        {byDay[day].map(s => (
                          <div key={s.id} className="flex items-center gap-4 px-4 py-3">
                            <div className="flex items-center gap-1.5 text-sm font-mono font-semibold text-foreground w-24 flex-shrink-0">
                              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                              {formatTime(s.startTime)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">Lesson {s.lessonNumber}</p>
                              {s.subjectName && <p className="text-xs text-muted-foreground">{s.subjectName}</p>}
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {s.type === "online" ? (
                                s.onlineLink ? (
                                  <a href={s.onlineLink} target="_blank" rel="noopener noreferrer"
                                    className="text-xs text-sky-600 hover:underline flex items-center gap-1">
                                    <Wifi className="h-3 w-3" />Join
                                  </a>
                                ) : (
                                  <span className="text-xs text-sky-600 flex items-center gap-1">
                                    <Wifi className="h-3 w-3" />Online
                                  </span>
                                )
                              ) : (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Building2 className="h-3 w-3" />Centre
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
