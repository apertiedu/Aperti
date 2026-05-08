import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Clock, Users, Wifi, Building2, BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
const DAY_SHORT: Record<string, string> = {
  Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed", Thursday: "Thu",
  Friday: "Fri", Saturday: "Sat", Sunday: "Sun",
};

const DAY_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  Monday:    { bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200 dark:border-blue-800", text: "text-blue-700 dark:text-blue-300", dot: "bg-blue-500" },
  Tuesday:   { bg: "bg-purple-50 dark:bg-purple-950/30", border: "border-purple-200 dark:border-purple-800", text: "text-purple-700 dark:text-purple-300", dot: "bg-purple-500" },
  Wednesday: { bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800", text: "text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  Thursday:  { bg: "bg-orange-50 dark:bg-orange-950/30", border: "border-orange-200 dark:border-orange-800", text: "text-orange-700 dark:text-orange-300", dot: "bg-orange-500" },
  Friday:    { bg: "bg-rose-50 dark:bg-rose-950/30", border: "border-rose-200 dark:border-rose-800", text: "text-rose-700 dark:text-rose-300", dot: "bg-rose-500" },
  Saturday:  { bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800", text: "text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  Sunday:    { bg: "bg-slate-50 dark:bg-slate-900/50", border: "border-slate-200 dark:border-slate-700", text: "text-slate-600 dark:text-slate-400", dot: "bg-slate-400" },
};

type Session = {
  id: number; lessonNumber: number; dayOfWeek: string; startTime: string;
  type: string; capacity: number | null; onlineLink: string | null;
  subjectName: string | null; studentCount: number;
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

export default function Timetable() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"week" | "list">("week");
  const today = getTodayName();

  useEffect(() => {
    fetch("/api/timetable", { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, []);

  const byDay = DAYS.reduce((acc, day) => {
    acc[day] = sessions.filter(s => s.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
    return acc;
  }, {} as Record<string, Session[]>);

  const activeDays = DAYS.filter(d => byDay[d].length > 0);
  const totalSessions = sessions.length;
  const totalStudents = Math.max(...sessions.map(s => s.studentCount), 0);
  const onlineSessions = sessions.filter(s => s.type === "online").length;

  const SessionCard = ({ s, dayKey }: { s: Session; dayKey: string }) => {
    const c = DAY_COLORS[dayKey] ?? DAY_COLORS.Sunday;
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-xl border p-3 ${c.bg} ${c.border} space-y-2`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${c.dot} flex-shrink-0`} />
            <span className={`text-xs font-bold uppercase tracking-wide ${c.text}`}>
              Lesson {s.lessonNumber}
            </span>
          </div>
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${s.type === "online" ? "border-sky-300 text-sky-600 bg-sky-50" : "border-slate-300 text-slate-600 bg-slate-50"}`}>
            {s.type === "online" ? <Wifi className="h-2.5 w-2.5 mr-1" /> : <Building2 className="h-2.5 w-2.5 mr-1" />}
            {s.type === "online" ? "Online" : "Centre"}
          </Badge>
        </div>
        <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          {formatTime(s.startTime)}
        </div>
        {s.subjectName && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <BookOpen className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{s.subjectName}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="h-3 w-3 flex-shrink-0" />
          <span>{s.studentCount} student{s.studentCount !== 1 ? "s" : ""}</span>
          {s.capacity && <span className="text-muted-foreground/60">/ {s.capacity} max</span>}
        </div>
        {s.type === "online" && s.onlineLink && (
          <a href={s.onlineLink} target="_blank" rel="noopener noreferrer"
            className="block text-xs text-sky-600 hover:underline truncate">
            Join Meeting →
          </a>
        )}
      </motion.div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <CalendarDays className="h-7 w-7 text-primary" />
            Weekly Timetable
          </h1>
          <p className="text-muted-foreground mt-1">Your recurring lesson schedule across the week.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView("week")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${view === "week" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"}`}>
            Week View
          </button>
          <button onClick={() => setView("list")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${view === "list" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"}`}>
            List View
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Sessions", value: totalSessions, icon: CalendarDays, color: "text-primary" },
          { label: "Active Days", value: activeDays.length, icon: CalendarDays, color: "text-purple-600" },
          { label: "Online Sessions", value: onlineSessions, icon: Wifi, color: "text-sky-600" },
          { label: "Max Students/Day", value: totalStudents, icon: Users, color: "text-emerald-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-border/50 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${color}`} />
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
              <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Loading timetable...</div>
      ) : sessions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center flex flex-col items-center gap-3 text-muted-foreground">
            <CalendarDays className="h-12 w-12 opacity-20" />
            <p className="font-medium">No sessions yet</p>
            <p className="text-sm">Go to Sessions to create your weekly recurring lessons.</p>
          </CardContent>
        </Card>
      ) : view === "week" ? (
        /* WEEK GRID */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7 gap-3">
          {DAYS.map(day => {
            const daySessions = byDay[day];
            const isToday = day === today;
            return (
              <div key={day} className={`space-y-2 ${daySessions.length === 0 ? "opacity-40" : ""}`}>
                <div className={`flex items-center gap-2 px-1 py-0.5 rounded-md ${isToday ? "bg-primary/10" : ""}`}>
                  <div className={`w-2 h-2 rounded-full ${DAY_COLORS[day]?.dot ?? "bg-muted"}`} />
                  <span className={`text-xs font-bold uppercase tracking-wider ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                    {DAY_SHORT[day]}
                    {isToday && <span className="ml-1 text-[9px] bg-primary text-primary-foreground rounded px-1">Today</span>}
                  </span>
                </div>
                {daySessions.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/50 p-3 min-h-[60px] flex items-center justify-center">
                    <span className="text-xs text-muted-foreground/50">—</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {daySessions.map(s => <SessionCard key={s.id} s={s} dayKey={day} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="space-y-4">
          {activeDays.map(day => {
            const isToday = day === today;
            return (
              <Card key={day} className={`border-border/50 ${isToday ? "ring-1 ring-primary" : ""}`}>
                <CardHeader className="py-3 px-4 border-b border-border/50">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${DAY_COLORS[day]?.dot ?? "bg-muted"}`} />
                    {day}
                    {isToday && <Badge className="text-[10px] px-1.5 py-0 bg-primary">Today</Badge>}
                    <span className="ml-auto text-xs font-normal text-muted-foreground">{byDay[day].length} session{byDay[day].length !== 1 ? "s" : ""}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 divide-y divide-border/50">
                  {byDay[day].map(s => (
                    <div key={s.id} className="flex items-center gap-4 px-4 py-3">
                      <div className="text-sm font-mono font-semibold text-muted-foreground w-20 flex-shrink-0">{formatTime(s.startTime)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">Lesson {s.lessonNumber}</span>
                          {s.subjectName && <span className="text-xs text-primary">{s.subjectName}</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            {s.type === "online" ? <Wifi className="h-3 w-3 text-sky-500" /> : <Building2 className="h-3 w-3" />}
                            {s.type === "online" ? "Online" : "Centre"}
                          </span>
                          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{s.studentCount} students</span>
                          {s.capacity && <span>Max: {s.capacity}</span>}
                        </div>
                      </div>
                      {s.type === "online" && s.onlineLink && (
                        <a href={s.onlineLink} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-sky-600 hover:underline flex-shrink-0">
                          Join →
                        </a>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
