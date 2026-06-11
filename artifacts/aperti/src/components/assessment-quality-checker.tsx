import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertTriangle, XCircle, ChevronDown, Sparkles } from "lucide-react";
import { useState } from "react";

interface Question {
  marks: number;
  question_type: string;
  question_text?: string;
  custom_question?: { text?: string };
}

interface QualityCheck {
  id: string;
  label: string;
  passed: boolean;
  warning?: boolean;
  detail: string;
}

interface Props {
  questions: Question[];
  totalMarks?: number;
  timeLimitMinutes?: number | null;
  status?: string;
}

function computeChecks(questions: Question[], timeLimitMinutes: number | null | undefined): QualityCheck[] {
  const checks: QualityCheck[] = [];
  const total = questions.length;
  const totalMarks = questions.reduce((s, q) => s + (q.marks || 0), 0);
  const types = new Set(questions.map(q => q.question_type));
  const avgLen = total > 0 ? questions.reduce((s, q) => {
    const text = q.question_text || q.custom_question?.text || "";
    return s + text.length;
  }, 0) / total : 0;

  checks.push({
    id: "has-questions",
    label: "Has at least 1 question",
    passed: total >= 1,
    detail: total >= 1 ? `${total} question${total !== 1 ? "s" : ""} added` : "Add questions to the assessment",
  });

  checks.push({
    id: "enough-marks",
    label: "Adequate marks (≥ 10)",
    passed: totalMarks >= 10,
    warning: totalMarks > 0 && totalMarks < 10,
    detail: totalMarks >= 10 ? `${totalMarks} total marks` : `Only ${totalMarks} marks — consider adding more questions`,
  });

  checks.push({
    id: "has-time",
    label: "Time limit set",
    passed: !!timeLimitMinutes && timeLimitMinutes > 0,
    warning: true,
    detail: timeLimitMinutes ? `${timeLimitMinutes} minutes` : "No time limit — students will not be timed",
  });

  checks.push({
    id: "question-variety",
    label: "Question variety",
    passed: types.size >= 2,
    warning: types.size === 1,
    detail: types.size >= 2 ? `${types.size} question types used` : "Using only one question type — consider mixing types",
  });

  checks.push({
    id: "question-quality",
    label: "Questions are descriptive",
    passed: avgLen >= 20,
    warning: avgLen > 0 && avgLen < 20,
    detail: avgLen >= 20 ? "Questions have good detail" : "Some questions may be too brief — add more context",
  });

  checks.push({
    id: "not-too-short",
    label: "Assessment not too short",
    passed: total >= 5,
    warning: total > 0 && total < 5,
    detail: total >= 5 ? `${total} questions` : `Only ${total} question${total !== 1 ? "s" : ""} — add more for a thorough assessment`,
  });

  return checks;
}

export default function AssessmentQualityChecker({ questions, timeLimitMinutes, status }: Props) {
  const [open, setOpen] = useState(false);
  const checks = useMemo(() => computeChecks(questions, timeLimitMinutes), [questions, timeLimitMinutes]);

  const failures = checks.filter(c => !c.passed && !c.warning);
  const warnings = checks.filter(c => !c.passed && c.warning);
  const passed = checks.filter(c => c.passed);
  const score = Math.round((passed.length / checks.length) * 100);

  const overallColor =
    score === 100 ? "text-emerald-600 bg-emerald-50 border-emerald-200" :
    failures.length > 0 ? "text-red-600 bg-red-50 border-red-200" :
    "text-amber-600 bg-amber-50 border-amber-200";

  const overallIcon =
    score === 100 ? CheckCircle2 :
    failures.length > 0 ? XCircle :
    AlertTriangle;

  const OverallIcon = overallIcon;

  return (
    <div className={`rounded-xl border ${overallColor} overflow-hidden`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
      >
        <div className="flex items-center gap-2">
          <OverallIcon className="w-3.5 h-3.5 shrink-0" />
          <span className="text-xs font-semibold">Quality Check</span>
          <span className="text-[10px] opacity-70">{score}%</span>
        </div>
        <div className="flex items-center gap-2">
          {failures.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">{failures.length} issue{failures.length > 1 ? "s" : ""}</span>
          )}
          {warnings.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">{warnings.length} tip{warnings.length > 1 ? "s" : ""}</span>
          )}
          <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-1.5 border-t border-current/10 pt-2">
              {checks.map(c => (
                <div key={c.id} className="flex items-start gap-2">
                  {c.passed ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  ) : c.warning ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="text-[11px] font-semibold text-gray-800 leading-none">{c.label}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{c.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
