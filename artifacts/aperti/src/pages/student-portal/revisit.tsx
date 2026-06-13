import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  Calendar, Clock, BookOpen, Zap, Target, AlertTriangle,
  Layers, FileText, ChevronRight, Flame, Brain,
} from "lucide-react";
import RevisionModesSelector from "@/components/revision-modes-selector";


const MODE_ICONS: Record<string, any> = {
  flashcards: Layers,
  questions: BookOpen,
  "past-paper": FileText,
};
const MODE_COLORS: Record<string, string> = {
  flashcards: "bg-blue-50 text-blue-700 border-blue-100",
  questions: "bg-purple-50 text-purple-700 border-purple-100",
  "past-paper": "bg-orange-50 text-orange-700 border-orange-100",
};

interface PlanItem {
  date: string;
  topic: string;
  durationMinutes: number;
  mode: string;
  resources: { questionCount: number; flashcardDeck?: string };
  examContext?: string;
}
interface Plan {
  type: string;
  plan: PlanItem[];
  weakTopics: string[];
  learningPace: string;
  upcomingExams: { id: number; name: string; examDate: string; subject: string; daysUntil: number }[];
  sprintMode: { examName: string; examDate: string; daysRemaining: number } | null;
}

function PlanCard({ item, idx }: { item: PlanItem; idx: number }) {
  const today = new Date().toISOString().split("T")[0];
  const isToday = item.date === today;
  const ModeIcon = MODE_ICONS[item.mode] || BookOpen;
  const link = item.mode === "flashcards" ? `/flashcards` : `/mentor`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.05 }}
      className={`bg-white rounded-2xl border shadow-sm p-4 ${isToday ? "border-teal-200 ring-1 ring-teal-100" : "border-gray-100"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isToday && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-600 text-white">TODAY</span>
            )}
            <p className="text-[11px] text-gray-400 font-medium">
              {new Date(item.date + "T12:00:00").toLocaleDateString("en-US", {
                weekday: "short", month: "short", day: "numeric",
              })}
            </p>
            {item.examContext && (
              <span className="text-[10px] text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100 flex items-center gap-1">
                <AlertTriangle className="h-2.5 w-2.5" /> {item.examContext}
              </span>
            )}
          </div>
          <p className="font-bold text-gray-900 text-sm leading-snug">{item.topic}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 ${MODE_COLORS[item.mode] || "bg-gray-50 text-gray-600 border-gray-100"}`}>
              <ModeIcon className="h-2.5 w-2.5" /> {item.mode}
            </span>
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" /> {item.durationMinutes} min
            </span>
            {item.resources.questionCount > 0 && (
              <span className="text-[10px] text-gray-400">{item.resources.questionCount} questions</span>
            )}
          </div>
        </div>
        <Link href={link}>
          <Button
            size="sm"
            className="shrink-0 h-8 px-3 text-xs rounded-xl"
            style={{ background: isToday ? "#0D9488" : undefined }}
            variant={isToday ? "default" : "outline"}
          >
            Start <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </Link>
      </div>
    </motion.div>
  );
}

function WeeklyCalendar({ items }: { items: PlanItem[] }) {
  const days = items.slice(0, 7);
  const today = new Date().toISOString().split("T")[0];
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {days.map((item, idx) => {
        const d = new Date(item.date + "T12:00:00");
        const isToday = item.date === today;
        return (
          <motion.div
            key={item.date}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.04 }}
            className={`rounded-xl p-2 text-center border transition-all cursor-default ${
              isToday ? "bg-teal-600 text-white border-teal-600 shadow-md" : "bg-white border-gray-100 hover:border-teal-100"
            }`}
          >
            <p className={`text-[9px] font-bold uppercase mb-1 ${isToday ? "text-teal-100" : "text-gray-400"}`}>
              {d.toLocaleDateString("en-US", { weekday: "short" })}
            </p>
            <p className={`text-base font-black ${isToday ? "text-white" : "text-gray-900"}`}>
              {d.getDate()}
            </p>
            <p className={`text-[9px] mt-1 leading-tight line-clamp-2 ${isToday ? "text-teal-100" : "text-gray-500"}`}>
              {item.topic}
            </p>
            <p className={`text-[8px] mt-1 ${isToday ? "text-teal-200" : "text-gray-400"}`}>
              {item.durationMinutes}m
            </p>
          </motion.div>
        );
      })}
    </div>
  );
}

export default function Revisit() {
  const [planType, setPlanType] = useState<"daily" | "weekly" | "sprint">("daily");
  const [revisionTopic, setRevisionTopic] = useState<{ name: string; subject: string } | null>(null);

  const { data, isLoading } = useQuery<Plan>({
    queryKey: ["revisit", "plan", planType],
    queryFn: async () => {
      const res = await fetch(`/api/revisit/plan?type=${planType}`, {
        headers: {},
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  return (
    <div className="min-h-screen bg-[#F8FAFB] px-4 py-6 max-w-3xl mx-auto" style={{ fontFamily: "Inter, sans-serif" }}>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-9 w-9 rounded-xl bg-teal-50 flex items-center justify-center">
            <Target className="h-4.5 w-4.5 text-teal-600" style={{ width: 18, height: 18 }} />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900">Revisit</h1>
            <p className="text-xs text-gray-500">Your personalised revision plan</p>
          </div>
        </div>
      </motion.div>

      {/* Sprint alert */}
      <AnimatePresence>
        {data?.sprintMode && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-4 flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl p-3.5">
            <Flame className="h-5 w-5 text-orange-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-orange-800">Sprint Mode Active</p>
              <p className="text-xs text-orange-600 mt-0.5">
                {data.sprintMode.examName} in <strong>{data.sprintMode.daysRemaining} days</strong> — intensified plan enabled
              </p>
            </div>
            <button onClick={() => setPlanType("sprint")}
              className="text-xs px-3 py-1.5 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors shrink-0">
              Sprint Plan
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-5 w-fit">
        {(["daily", "weekly", "sprint"] as const).map((type) => (
          <button key={type} onClick={() => setPlanType(type)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold capitalize transition-all ${
              planType === type ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}>
            {type}
          </button>
        ))}
      </div>

      {/* Weak topics */}
      {data?.weakTopics && data.weakTopics.length > 0 && (
        <div className="mb-4 bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Your Weak Topics
          </p>
          <div className="flex flex-wrap gap-1.5">
            {data.weakTopics.map((t) => (
              <Badge key={t} variant="secondary" className="text-xs bg-amber-50 text-amber-700 border-amber-100 border">{t}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming exams */}
      {data?.upcomingExams && data.upcomingExams.length > 0 && (
        <div className="mb-4 bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-teal-600" /> Upcoming Exams
          </p>
          <div className="flex flex-wrap gap-2">
            {data.upcomingExams.map((e) => (
              <div key={e.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5 border border-gray-100">
                <span className="text-xs font-semibold text-gray-800">{e.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${e.daysUntil <= 3 ? "bg-red-100 text-red-700" : e.daysUntil <= 7 ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-600"}`}>
                  {e.daysUntil}d
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── AI Revision Modes ── */}
      <div className="mb-5 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center">
            <Brain className="w-4 h-4 text-teal-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">AI Revision Modes</p>
            <p className="text-[11px] text-gray-400">Choose how you want to revise any topic</p>
          </div>
        </div>
        {!revisionTopic ? (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 mb-2">Select a topic from your plan below, or enter one manually:</p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Photosynthesis, Quadratic equations…"
                className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-teal-400 transition-colors bg-gray-50"
                onKeyDown={e => {
                  if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                    setRevisionTopic({ name: (e.target as HTMLInputElement).value.trim(), subject: "General" });
                  }
                }}
              />
              <button
                className="text-xs px-3 py-2 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 transition-colors"
                onClick={(e) => {
                  const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                  if (input?.value.trim()) setRevisionTopic({ name: input.value.trim(), subject: "General" });
                }}
              >
                Revise
              </button>
            </div>
            {data?.plan && data.plan.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {data.plan.slice(0, 5).map((item) => (
                  <button
                    key={item.date}
                    onClick={() => setRevisionTopic({ name: item.topic, subject: "Subject" })}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-teal-50 text-teal-700 border border-teal-100 hover:bg-teal-100 transition-colors font-medium"
                  >
                    {item.topic}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-bold text-gray-900">{revisionTopic.name}</p>
                <p className="text-[11px] text-gray-400">{revisionTopic.subject}</p>
              </div>
              <button
                onClick={() => setRevisionTopic(null)}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                ← Change topic
              </button>
            </div>
            <RevisionModesSelector
              topicName={revisionTopic.name}
              subjectName={revisionTopic.subject}
            />
          </div>
        )}
      </div>

      {/* Plan content */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : planType === "weekly" && data?.plan ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <WeeklyCalendar items={data.plan} />
          <div className="mt-5 space-y-3">
            {data.plan.map((item, i) => <PlanCard key={item.date} item={item} idx={i} />)}
          </div>
        </motion.div>
      ) : data?.plan && data.plan.length > 0 ? (
        <div className="space-y-3">
          {data.plan.map((item, i) => <PlanCard key={item.date} item={item} idx={i} />)}
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <Target className="h-10 w-10 mx-auto mb-3 text-gray-200" />
          <p className="font-bold text-gray-700">No revision plan yet</p>
          <p className="text-sm text-gray-400 mt-1">Complete some activities to get a personalised plan</p>
        </div>
      )}
    </div>
  );
}
