import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, BookOpen, Clock, ChevronRight, Loader2, RefreshCw,
  CheckCircle2, AlertTriangle, Lightbulb, Target, Star,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

type RevisionMode = "quick" | "deep" | "last-minute";

interface RevisionModesSelectorProps {
  topicId?: number;
  topicName: string;
  subjectName: string;
  onGenerated?: (mode: RevisionMode, content: any) => void;
}

const MODES: { id: RevisionMode; label: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; desc: string; time: string; color: string; bg: string }[] = [
  {
    id: "quick",
    label: "Quick Revision",
    icon: Zap,
    desc: "Key facts, definitions & formulas",
    time: "15 min",
    color: "#0D9488",
    bg: "#E0F2F1",
  },
  {
    id: "deep",
    label: "Deep Dive",
    icon: BookOpen,
    desc: "Full concepts + worked examples",
    time: "45 min",
    color: "#7c3aed",
    bg: "#ede9fe",
  },
  {
    id: "last-minute",
    label: "Last-Minute",
    icon: Clock,
    desc: "High-yield exam tips only",
    time: "5 min",
    color: "#e11d48",
    bg: "#ffe4e6",
  },
];

function QuickContent({ content }: { content: any }) {
  return (
    <div className="space-y-4">
      {content.keyFacts?.length > 0 && (
        <div>
          <p className="text-xs font-bold text-teal-700 uppercase tracking-wide mb-2 flex items-center gap-1"><Star className="w-3 h-3" /> Key Facts</p>
          <ul className="space-y-1.5">
            {content.keyFacts.map((f: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-teal-500" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}
      {content.definitions?.length > 0 && (
        <div>
          <p className="text-xs font-bold text-teal-700 uppercase tracking-wide mb-2 flex items-center gap-1"><Lightbulb className="w-3 h-3" /> Definitions</p>
          <div className="space-y-1.5">
            {content.definitions.map((d: any, i: number) => (
              <div key={i} className="bg-teal-50 rounded-lg px-3 py-2 text-sm">
                <span className="font-semibold text-teal-800">{typeof d === "string" ? d : d.term}</span>
                {typeof d !== "string" && d.definition && <span className="text-teal-700">: {d.definition}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      {content.commonMistakes?.length > 0 && (
        <div>
          <p className="text-xs font-bold text-red-600 uppercase tracking-wide mb-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Common Mistakes</p>
          <ul className="space-y-1.5">
            {content.commonMistakes.map((m: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0 text-red-400" />
                {m}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DeepContent({ content }: { content: any }) {
  const [openQ, setOpenQ] = useState<number | null>(null);
  return (
    <div className="space-y-4">
      {content.coreConcepts && (
        <div>
          <p className="text-xs font-bold text-violet-700 uppercase tracking-wide mb-2">Core Concepts</p>
          <p className="text-sm text-foreground leading-relaxed">{typeof content.coreConcepts === "string" ? content.coreConcepts : JSON.stringify(content.coreConcepts)}</p>
        </div>
      )}
      {content.workedExamples?.length > 0 && (
        <div>
          <p className="text-xs font-bold text-violet-700 uppercase tracking-wide mb-2">Worked Examples</p>
          <div className="space-y-2">
            {content.workedExamples.map((ex: any, i: number) => (
              <div key={i} className="bg-violet-50 rounded-lg px-3 py-2 text-sm">
                <p className="font-semibold text-violet-800 mb-1">{typeof ex === "string" ? ex : ex.problem || ex.question || `Example ${i + 1}`}</p>
                {typeof ex !== "string" && ex.solution && <p className="text-violet-700 text-xs">{ex.solution}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
      {content.practiceQuestions?.length > 0 && (
        <div>
          <p className="text-xs font-bold text-violet-700 uppercase tracking-wide mb-2">Practice Questions</p>
          <div className="space-y-2">
            {content.practiceQuestions.map((q: any, i: number) => (
              <div key={i} className="border border-violet-100 rounded-lg overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-3 py-2 text-sm text-left hover:bg-violet-50 transition-colors"
                  onClick={() => setOpenQ(openQ === i ? null : i)}
                >
                  <span className="font-medium text-foreground">{typeof q === "string" ? q : q.question || `Q${i + 1}`}</span>
                  <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${openQ === i ? "rotate-90" : ""}`} />
                </button>
                <AnimatePresence>
                  {openQ === i && typeof q !== "string" && q.answer && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-2 text-xs text-violet-700 bg-violet-50">{q.answer}</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LastMinuteContent({ content }: { content: any }) {
  return (
    <div className="space-y-4">
      {content.topThings?.length > 0 && (
        <div>
          <p className="text-xs font-bold text-red-600 uppercase tracking-wide mb-2 flex items-center gap-1"><Target className="w-3 h-3" /> Top 3 Must-Knows</p>
          <div className="space-y-2">
            {content.topThings.map((t: string, i: number) => (
              <div key={i} className="flex items-start gap-2 bg-red-50 rounded-lg px-3 py-2 text-sm">
                <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                <span className="text-foreground">{t}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {content.examTips?.length > 0 && (
        <div>
          <p className="text-xs font-bold text-red-600 uppercase tracking-wide mb-2 flex items-center gap-1"><Lightbulb className="w-3 h-3" /> Exam Tips</p>
          <ul className="space-y-1.5">
            {content.examTips.map((t: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-red-400" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}
      {content.redFlags?.length > 0 && (
        <div>
          <p className="text-xs font-bold text-red-600 uppercase tracking-wide mb-2 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Red Flags</p>
          <ul className="space-y-1.5">
            {content.redFlags.map((f: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0 text-amber-400" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function RevisionModesSelector({ topicId, topicName, subjectName, onGenerated }: RevisionModesSelectorProps) {
  const [selectedMode, setSelectedMode] = useState<RevisionMode | null>(null);
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generate = async (mode: RevisionMode) => {
    setSelectedMode(mode);
    setContent(null);
    setError("");
    setLoading(true);

    // Check cache first
    if (topicId) {
      try {
        const cacheRes = await apiFetch(`/api/revision-modes/cache/${topicId}/${mode}`);
        if (cacheRes.ok) {
          const cacheData = await cacheRes.json();
          if (cacheData.cached) {
            setContent(cacheData.content);
            setLoading(false);
            onGenerated?.(mode, cacheData.content);
            return;
          }
        }
      } catch { /* proceed to generate */ }
    }

    try {
      const res = await apiFetch("/api/revision-modes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId, topicName, subjectName, mode }),
      });
      if (!res.ok) throw new Error("Generation failed");
      const data = await res.json();
      setContent(data.content);
      onGenerated?.(mode, data.content);
    } catch {
      setError("Failed to generate revision content. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const selectedModeConfig = MODES.find(m => m.id === selectedMode);

  return (
    <div className="space-y-3">
      {/* Mode picker */}
      <div className="grid grid-cols-3 gap-2">
        {MODES.map(mode => {
          const Icon = mode.icon;
          const active = selectedMode === mode.id;
          return (
            <motion.button
              key={mode.id}
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => generate(mode.id)}
              disabled={loading && selectedMode === mode.id}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center ${
                active
                  ? "shadow-sm"
                  : "border-border bg-white hover:border-slate-300"
              }`}
              style={active ? { borderColor: mode.color, background: mode.bg } : {}}
            >
              <Icon className="w-4 h-4" style={{ color: active ? mode.color : "#94a3b8" }} />
              <p className="text-xs font-bold leading-tight" style={{ color: active ? mode.color : "#1e293b" }}>
                {mode.label}
              </p>
              <p className="text-[10px] text-muted-foreground leading-tight">{mode.time}</p>
            </motion.button>
          );
        })}
      </div>

      {/* Content area */}
      <AnimatePresence mode="wait">
        {loading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center py-8 gap-3"
          >
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: selectedModeConfig?.color }} />
            <p className="text-sm text-muted-foreground">Generating {selectedModeConfig?.label} content…</p>
          </motion.div>
        )}

        {error && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl p-3"
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => selectedMode && generate(selectedMode)} className="text-xs font-semibold underline">
              <RefreshCw className="w-3 h-3" />
            </button>
          </motion.div>
        )}

        {content && !loading && selectedMode && (
          <motion.div
            key={`content-${selectedMode}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="bg-white rounded-2xl border border-border p-4 shadow-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {selectedModeConfig && <selectedModeConfig.icon className="w-4 h-4" style={{ color: selectedModeConfig.color }} />}
                <p className="text-sm font-bold text-foreground">{selectedModeConfig?.label}</p>
              </div>
              <button
                onClick={() => selectedMode && generate(selectedMode)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                <RefreshCw className="w-3 h-3" /> Regenerate
              </button>
            </div>

            {selectedMode === "quick" && <QuickContent content={content} />}
            {selectedMode === "deep" && <DeepContent content={content} />}
            {selectedMode === "last-minute" && <LastMinuteContent content={content} />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
