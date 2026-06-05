import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Scale, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight,
  BarChart3, Users, Eye, Search,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ConsistencyItem {
  question_id: number;
  std_dev: number;
  avg_marks: number;
  count: number;
  max_given: number;
  min_given: number;
}

interface Submission {
  id: number;
  student_name: string;
  score: number;
  max_score: number;
  percentage: number;
  grade: string;
  graded_at: string;
  graded_by: number;
}

export default function ModerationCenter() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedAssessment, setSelectedAssessment] = useState<number | null>(null);
  const [moderateForm, setModerateForm] = useState<Record<number, { score: string; reason: string }>>({});
  const [expandedSub, setExpandedSub] = useState<number | null>(null);

  const { data: assessments } = useQuery({
    queryKey: ["assessments-for-mod"],
    queryFn: async () => {
      const res = await apiFetch("/api/assessments");
      return (await res.json()).assessments?.filter((a: any) =>
        ["published","active","completed"].includes(a.status) && parseInt(a.submission_count) > 0
      ) ?? [];
    },
  });

  const { data: consistencyData } = useQuery({
    queryKey: ["consistency", selectedAssessment],
    queryFn: async () => {
      const res = await apiFetch(`/api/moderation/consistency?assessment_id=${selectedAssessment}`);
      return res.json();
    },
    enabled: !!selectedAssessment,
  });

  const { data: submissionsData } = useQuery({
    queryKey: ["submissions-for-mod", selectedAssessment],
    queryFn: async () => {
      const res = await apiFetch(`/api/assessments/${selectedAssessment}/submissions`);
      return (await res.json()).submissions as Submission[];
    },
    enabled: !!selectedAssessment,
  });

  const moderateMut = useMutation({
    mutationFn: async ({ subId }: { subId: number }) => {
      const fd = moderateForm[subId];
      if (!fd) throw new Error("No data");
      const res = await apiFetch(`/api/grading/assessments/${subId}/moderate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moderated_score: parseFloat(fd.score), reason: fd.reason }),
      });
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["submissions-for-mod"] }); toast({ title: "Grade moderated" }); },
  });

  const doubleMarkMut = useMutation({
    mutationFn: async ({ subId, marker2 }: { subId: number; marker2: string }) => {
      const res = await apiFetch("/api/moderation/double-mark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission_id: subId, second_marker_id: parseInt(marker2) }),
      });
      return res.json();
    },
    onSuccess: () => toast({ title: "Second marker assigned" }),
  });

  const discrepancies: ConsistencyItem[] = consistencyData?.discrepancies ?? [];
  const allAnalysis: ConsistencyItem[] = consistencyData?.analysis ?? [];
  const submissions = submissionsData ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Scale className="w-6 h-6 text-primary" /> Standardization Centre
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Review marking consistency, moderate grades, and manage double-marking.</p>
      </div>

      {/* Assessment selector */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Select Assessment</label>
        <div className="flex flex-wrap gap-2">
          {(assessments ?? []).map((a: any) => (
            <button
              key={a.id}
              onClick={() => setSelectedAssessment(selectedAssessment === a.id ? null : a.id)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                selectedAssessment === a.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
              }`}
            >
              {a.title} <span className="opacity-60">({a.submission_count})</span>
            </button>
          ))}
          {(!assessments || assessments.length === 0) && (
            <p className="text-sm text-muted-foreground">No published assessments with submissions found.</p>
          )}
        </div>
      </div>

      {selectedAssessment && (
        <>
          {/* Consistency Analysis */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <h3 className="font-bold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" /> Marking Consistency
            </h3>
            {discrepancies.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-amber-600 flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {discrepancies.length} question{discrepancies.length > 1 ? "s" : ""} with high marking variance detected
                </p>
                {discrepancies.map((d, i) => (
                  <div key={i} className="flex items-center gap-4 bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3 text-sm">
                    <div className="flex-1">
                      <p className="font-semibold text-xs">Question #{d.question_id}</p>
                      <p className="text-muted-foreground text-xs mt-0.5">
                        Marks given: {parseFloat(String(d.min_given)).toFixed(1)} – {parseFloat(String(d.max_given)).toFixed(1)}
                        &nbsp;· Avg: {parseFloat(String(d.avg_marks)).toFixed(1)}
                        &nbsp;· {d.count} markers
                      </p>
                    </div>
                    <span className="text-amber-600 font-bold text-xs">σ = {parseFloat(String(d.std_dev)).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-emerald-600 flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-4 h-4" /> Marking is consistent across all questions.
              </p>
            )}
            {allAnalysis.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      {["Question","Markers","Min","Max","Avg","Std Dev"].map(h => (
                        <th key={h} className="text-left px-2 py-1.5 text-muted-foreground font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {allAnalysis.map((a, i) => (
                      <tr key={i} className="hover:bg-muted/30">
                        <td className="px-2 py-1.5">#{a.question_id}</td>
                        <td className="px-2 py-1.5 text-muted-foreground">{a.count}</td>
                        <td className="px-2 py-1.5">{parseFloat(String(a.min_given)).toFixed(1)}</td>
                        <td className="px-2 py-1.5">{parseFloat(String(a.max_given)).toFixed(1)}</td>
                        <td className="px-2 py-1.5 font-medium">{parseFloat(String(a.avg_marks)).toFixed(1)}</td>
                        <td className={`px-2 py-1.5 font-bold ${parseFloat(String(a.std_dev)) > 2 ? "text-amber-600" : "text-emerald-600"}`}>
                          {parseFloat(String(a.std_dev || 0)).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Submission moderation */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <h3 className="font-bold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Moderate Submissions
            </h3>
            {submissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No submissions yet.</p>
            ) : (
              <div className="space-y-2">
                {submissions.map(s => {
                  const isExpanded = expandedSub === s.id;
                  const mf = moderateForm[s.id] ?? { score: "", reason: "" };
                  return (
                    <div key={s.id} className="border border-border rounded-xl overflow-hidden">
                      <button
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
                        onClick={() => setExpandedSub(isExpanded ? null : s.id)}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-sm">{s.student_name}</span>
                          <span className="text-xs text-muted-foreground">{s.score}/{s.max_score} · {s.percentage}%</span>
                          {s.grade && (
                            <span className="text-xs px-1.5 py-0.5 rounded font-bold bg-primary/10 text-primary">{s.grade}</span>
                          )}
                        </div>
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                      </button>
                      {isExpanded && (
                        <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} className="px-4 pb-4 space-y-3 border-t border-border">
                          <p className="text-xs text-muted-foreground pt-3">Enter moderated grade to override original mark:</p>
                          <div className="flex gap-3 flex-wrap">
                            <Input
                              type="number" min={0} max={s.max_score}
                              placeholder={`Max: ${s.max_score}`}
                              className="w-28 h-8 text-sm"
                              value={mf.score}
                              onChange={e => setModerateForm(f => ({ ...f, [s.id]: { ...mf, score: e.target.value } }))}
                            />
                            <Input
                              placeholder="Reason for moderation…"
                              className="flex-1 h-8 text-sm"
                              value={mf.reason}
                              onChange={e => setModerateForm(f => ({ ...f, [s.id]: { ...mf, reason: e.target.value } }))}
                            />
                            <Button size="sm" className="h-8"
                              onClick={() => moderateMut.mutate({ subId: s.id })}
                              disabled={!mf.score || moderateMut.isPending}>
                              Apply
                            </Button>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
