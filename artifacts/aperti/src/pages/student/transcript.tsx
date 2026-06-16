import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, RefreshCw, Award, BarChart3, Clock } from "lucide-react";
import { AppEmptyState } from "@/components/app-empty-state";
import { useToast } from "@/hooks/use-toast";

const IGCSE_COLOR: Record<string, string> = {
  "A*": "text-yellow-500 bg-yellow-500/10", "A": "text-emerald-500 bg-emerald-500/10",
  "B": "text-green-500 bg-green-500/10", "C": "text-primary bg-primary/10",
  "D": "text-blue-500 bg-blue-500/10", "E": "text-orange-500 bg-orange-500/10",
  "F": "text-amber-500 bg-amber-500/10", "G": "text-red-400 bg-red-400/10", "U": "text-red-600 bg-red-600/10",
};

function igcseGrade(pct: number): string {
  if (pct >= 90) return "A*"; if (pct >= 80) return "A"; if (pct >= 70) return "B";
  if (pct >= 60) return "C"; if (pct >= 50) return "D"; if (pct >= 40) return "E";
  if (pct >= 30) return "F"; if (pct >= 20) return "G"; return "U";
}

export default function StudentTranscript() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: profileRes } = useQuery({
    queryKey: ["student-profile"],
    queryFn: async () => {
      const res = await apiFetch("/api/student/profile");
      return res.json();
    },
  });
  const studentId = profileRes?.student?.id;

  const { data: transcripts, isLoading } = useQuery({
    queryKey: ["transcripts", studentId],
    queryFn: async () => {
      const res = await apiFetch(`/api/transcripts/student/${studentId}`);
      return (await res.json()).transcripts ?? [];
    },
    enabled: !!studentId,
  });

  const generateMut = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/transcripts/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transcripts", studentId] }); toast({ title: "Transcript generated" }); },
    onError: () => toast({ title: "Failed to generate transcript", variant: "destructive" }),
  });

  const handlePrint = () => window.print();

  const latestTranscript = transcripts?.[0];
  const transcriptData = latestTranscript?.data;
  const assessments = transcriptData?.assessments ?? [];
  const certs = transcriptData?.certificates ?? [];
  const student = transcriptData?.student;
  const overall = transcriptData?.overall_average;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="w-6 h-6 text-primary" />Academic Transcript</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Official record of all academic achievements.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={handlePrint}><Download className="w-4 h-4" />Print / PDF</Button>
          <Button size="sm" className="gap-2" onClick={() => generateMut.mutate()} disabled={generateMut.isPending || !studentId}>
            <RefreshCw className={`w-4 h-4 ${generateMut.isPending ? "animate-spin" : ""}`} />
            {generateMut.isPending ? "Generating…" : "Regenerate"}
          </Button>
        </div>
      </div>

      {isLoading || !studentId ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted/40 rounded-xl animate-pulse" />)}</div>
      ) : !latestTranscript ? (
        <AppEmptyState
          type="results"
          title="No transcript generated yet"
          description="Generate your transcript to see all your grades and achievements in one place."
          size="lg"
          actions={[{
            label: generateMut.isPending ? "Generating..." : "Generate Transcript",
            primary: true,
            icon: RefreshCw,
            onClick: () => generateMut.mutate()
          }]}
        />
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5" id="printable-transcript">
          {/* Header */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">{student?.display_name}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Year {student?.grade_level ?? "—"}</p>
              </div>
              {overall !== null && overall !== undefined && (
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">{Math.round(overall)}%</p>
                  <span className={`text-sm px-2 py-0.5 rounded font-bold ${IGCSE_COLOR[igcseGrade(overall)] ?? ""}`}>{igcseGrade(overall)}</span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Overall Average</p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-4 text-[11px] text-muted-foreground border-t border-border pt-3">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Generated {new Date(latestTranscript.generated_at).toLocaleDateString()}</span>
              <span>Version {latestTranscript.version}</span>
              <span>{assessments.length} assessments</span>
            </div>
          </div>

          {/* Assessments */}
          {assessments.length > 0 && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-border bg-muted/30">
                <h3 className="font-bold text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" />Assessment Results</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/20">
                    <tr>
                      {["Assessment","Type","Score","Percentage","Grade","Date"].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 font-semibold text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {assessments.map((a: any, i: number) => {
                      const pct = parseFloat(a.percentage ?? 0);
                      const grade = a.grade ?? igcseGrade(pct);
                      return (
                        <tr key={i} className="hover:bg-muted/20">
                          <td className="px-4 py-2.5 font-medium max-w-[180px] truncate">{a.title}</td>
                          <td className="px-4 py-2.5"><Badge variant="secondary" className="text-[10px]">{a.type}</Badge></td>
                          <td className="px-4 py-2.5">{a.score ?? "—"}/{a.max_score ?? "—"}</td>
                          <td className="px-4 py-2.5 font-medium">{Math.round(pct)}%</td>
                          <td className="px-4 py-2.5">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${IGCSE_COLOR[grade] ?? ""}`}>{grade}</span>
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {a.submitted_at ? new Date(a.submitted_at).toLocaleDateString() : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Certificates */}
          {certs.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
              <h3 className="font-bold text-sm flex items-center gap-2"><Award className="w-4 h-4 text-primary" />Certificates & Awards</h3>
              <div className="space-y-2">
                {certs.map((c: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 bg-muted/50 rounded-xl px-4 py-3">
                    <Award className="w-4 h-4 text-primary shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{c.title}</p>
                      <p className="text-[11px] text-muted-foreground">Issued {new Date(c.issued_at).toLocaleDateString()}</p>
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground">{c.unique_code}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
