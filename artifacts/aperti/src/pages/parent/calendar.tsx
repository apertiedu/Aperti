import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, CalendarDays, BookOpen, FileText, GraduationCap, Users, X } from "lucide-react";

const authFetch = (url: string) =>
  fetch(url, { credentials: "include" });

type EventType = "homework" | "exam" | "class" | "meeting";

interface CalEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  type: EventType;
  childName: string | null;
  childId: number | null;
  colour: string;
  detail: string;
}

const TYPE_CONFIG: Record<EventType, { label: string; icon: any }> = {
  homework: { label: "Homework", icon: BookOpen },
  exam:     { label: "Exam", icon: FileText },
  class:    { label: "Class", icon: GraduationCap },
  meeting:  { label: "Meeting", icon: Users },
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function FamilyCalendar() {
  const today = new Date();
  const [view, setView] = useState<"month" | "week">("month");
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);

  const { data: events = [], isLoading } = useQuery<CalEvent[]>({
    queryKey: ["family-calendar"],
    queryFn: () => authFetch("/api/parent/family-calendar").then(r => r.json()),
    refetchInterval: 120000,
  });

  // unique children for legend
  const children = useMemo(() => {
    const map = new Map<number, { name: string; colour: string }>();
    events.forEach(e => { if (e.childId && e.childName) map.set(e.childId, { name: e.childName, colour: e.colour }); });
    return [...map.entries()].map(([id, v]) => ({ id, ...v }));
  }, [events]);

  // events by day key "YYYY-MM-DD"
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    events.forEach(e => {
      const key = e.start.split("T")[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    return map;
  }, [events]);

  function prevPeriod() {
    if (view === "month") {
      setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
    } else {
      setCurrentDate(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
    }
  }
  function nextPeriod() {
    if (view === "month") {
      setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));
    } else {
      setCurrentDate(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });
    }
  }

  // Month view grid
  function MonthGrid() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDow = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [
      ...Array(firstDow).fill(null),
      ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
    ];
    // pad to full weeks
    while (cells.length % 7 !== 0) cells.push(null);

    return (
      <div className="flex-1">
        <div className="grid grid-cols-7 border-b border-gray-100">
          {DAYS.map(d => (
            <div key={d} className="text-center text-[10px] font-bold text-gray-400 uppercase py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((date, i) => {
            if (!date) return <div key={i} className="border-b border-r border-gray-50 min-h-[80px] bg-gray-50/30" />;
            const key = date.toISOString().split("T")[0];
            const dayEvents = eventsByDay.get(key) || [];
            const isToday = date.toDateString() === today.toDateString();
            return (
              <div key={i} className="border-b border-r border-gray-100 min-h-[80px] p-1 hover:bg-gray-50 transition-colors">
                <div className={`text-xs font-bold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? "text-white" : "text-gray-700"}`}
                  style={isToday ? { background: "#0D9488" } : undefined}>
                  {date.getDate()}
                </div>
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map(ev => (
                    <button
                      key={ev.id}
                      onClick={() => setSelectedEvent(ev)}
                      className="w-full text-left text-[9px] px-1.5 py-0.5 rounded font-medium truncate text-white leading-tight"
                      style={{ background: ev.colour }}
                    >
                      {ev.title}
                    </button>
                  ))}
                  {dayEvents.length > 3 && (
                    <p className="text-[9px] text-gray-400 pl-1">+{dayEvents.length - 3} more</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Week view
  function WeekGrid() {
    const start = new Date(currentDate);
    // snap to Sunday
    start.setDate(start.getDate() - start.getDay());
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });

    return (
      <div className="flex-1">
        <div className="grid grid-cols-7 border-b border-gray-100">
          {weekDays.map((d, i) => {
            const isToday = d.toDateString() === today.toDateString();
            return (
              <div key={i} className={`text-center py-2 ${isToday ? "bg-teal-50" : ""}`}>
                <p className="text-[9px] font-bold text-gray-400 uppercase">{DAYS[i]}</p>
                <p className={`text-sm font-black ${isToday ? "text-teal-600" : "text-gray-700"}`}>{d.getDate()}</p>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-7 min-h-[400px]">
          {weekDays.map((d, i) => {
            const key = d.toISOString().split("T")[0];
            const dayEvents = eventsByDay.get(key) || [];
            const isToday = d.toDateString() === today.toDateString();
            return (
              <div key={i} className={`border-r border-gray-100 p-1.5 space-y-1.5 ${isToday ? "bg-teal-50/40" : ""}`}>
                {dayEvents.map(ev => (
                  <button
                    key={ev.id}
                    onClick={() => setSelectedEvent(ev)}
                    className="w-full text-left p-1.5 rounded-lg text-white text-[10px] font-medium leading-tight"
                    style={{ background: ev.colour }}
                  >
                    <p className="truncate">{ev.title}</p>
                    {ev.childName && <p className="opacity-80 text-[8px]">{ev.childName}</p>}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const headerLabel = view === "month"
    ? `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`
    : (() => {
        const start = new Date(currentDate);
        start.setDate(start.getDate() - start.getDay());
        const end = new Date(start); end.setDate(end.getDate() + 6);
        return `${start.getDate()} ${MONTHS[start.getMonth()]} — ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`;
      })();

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-teal-50">
            <CalendarDays className="h-5 w-5 text-teal-600" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900">Family Calendar</h1>
            <p className="text-sm text-gray-500">All children's schedules in one view</p>
          </div>
        </div>

        {/* View toggle */}
        <div className="flex bg-gray-100 rounded-xl p-1">
          {(["month","week"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${view === v ? "bg-card shadow text-foreground" : "text-gray-500"}`}>
              {v}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Legend */}
      {children.length > 0 && (
        <div className="flex flex-wrap gap-2 shrink-0">
          {children.map(c => (
            <div key={c.id} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gray-100 bg-white text-xs font-medium text-gray-700">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: c.colour }} />
              {c.name}
            </div>
          ))}
          {[
            { colour: "#0D9488", label: "Class" },
            { colour: "#f59e0b", label: "Homework" },
            { colour: "#6366f1", label: "Exam" },
            { colour: "#64748b", label: "Meeting" },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-gray-100 bg-white text-xs text-gray-500">
              <div className="w-2 h-2 rounded" style={{ background: l.colour }} />
              {l.label}
            </div>
          ))}
        </div>
      )}

      {/* Calendar card */}
      <Card className="border border-gray-100 shadow-sm flex-1 flex flex-col overflow-hidden">
        {/* Nav bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={prevPeriod}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-sm font-bold text-gray-900">{headerLabel}</h2>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={nextPeriod}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {isLoading ? (
          <div className="flex-1 p-6 space-y-3">
            {[0,1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            {view === "month" ? <MonthGrid /> : <WeekGrid />}
          </div>
        )}
      </Card>

      {/* Event detail tooltip */}
      {selectedEvent && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 w-80"
        >
          <Card className="border shadow-xl">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: selectedEvent.colour }} />
                  <p className="text-sm font-bold text-gray-900">{selectedEvent.title}</p>
                </div>
                <button onClick={() => setSelectedEvent(null)} className="p-0.5 rounded hover:bg-gray-100">
                  <X className="h-3.5 w-3.5 text-gray-400" />
                </button>
              </div>
              <div className="space-y-1.5 text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <Badge className="text-[9px] rounded-full" style={{ background: `${selectedEvent.colour}20`, color: selectedEvent.colour }}>
                    {TYPE_CONFIG[selectedEvent.type]?.label || selectedEvent.type}
                  </Badge>
                  {selectedEvent.childName && <span className="text-gray-500">for {selectedEvent.childName}</span>}
                </div>
                <p className="flex items-center gap-1.5">
                  <CalendarDays className="h-3 w-3 text-gray-400" />
                  {new Date(selectedEvent.start).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  {selectedEvent.detail && <span className="text-gray-400">· {selectedEvent.detail}</span>}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
