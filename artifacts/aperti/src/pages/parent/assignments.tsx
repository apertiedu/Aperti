import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { BookOpen, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import ParentChildSwitcher from "@/components/parent-child-switcher";

const authFetch = (url: string) => fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem("aperti_token") || ""}` } });

type Tab = "pending" | "submitted" | "overdue";

function AssignmentCard({ hw }: { hw: any }) {
  const pct = hw.total_marks && hw.marks_awarded != null ? Math.round((hw.marks_awarded / hw.total_marks) * 100) : null;
  return (
    <div className="p-3.5 rounded-xl border border-gray-100 bg-white hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="text-sm font-semibold text-gray-900">{hw.title}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{hw.subject_name || "General"}</p>
        </div>
        {pct !== null && (
          <span className="text-sm font-black shrink-0" style={{ color: pct >= 70 ? "#0D9488" : pct >= 50 ? "#f59e0b" : "#ef4444" }}>{pct}%</span>
        )}
      </div>
      <div className="flex items-center gap-3 text-[10px] text-gray-400">
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Due {new Date(hw.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
        {hw.total_marks && <span>{hw.marks_awarded ?? "—"}/{hw.total_marks} marks</span>}
      </div>
      {hw.teacher_feedback && (
        <p className="text-xs text-gray-500 italic mt-2 p-2 bg-gray-50 rounded-lg">"{hw.teacher_feedback}"</p>
      )}
    </div>
  );
}

export default function ParentAssignments() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const [studentId, setStudentId] = useState<number | null>(params.get("child") ? parseInt(params.get("child")!) : null);
  const [tab, setTab] = useState<Tab>("pending");

  const { data, isLoading } = useQuery({
    queryKey: ["parent-assignments", studentId],
    queryFn: () => authFetch(`/api/parent/child/${studentId}/assignments`).then(r => r.json()),
    enabled: !!studentId,
  });

  const tabs: { key: Tab; label: string; icon: any; color: string }[] = [
    { key: "pending", label: "Pending", icon: Clock, color: "#f59e0b" },
    { key: "submitted", label: "Submitted", icon: CheckCircle2, color: "#0D9488" },
    { key: "overdue", label: "Overdue", icon: AlertTriangle, color: "#ef4444" },
  ];

  const items = tab === "pending" ? data?.pending : tab === "submitted" ? data?.submitted : data?.overdue;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-50">
          <BookOpen className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-black text-gray-900">Assignments</h1>
          <p className="text-sm text-gray-500">Homework status and teacher feedback</p>
        </div>
      </motion.div>

      <ParentChildSwitcher selected={studentId} onSelect={setStudentId} />

      {!studentId ? (
        <div className="text-center py-16 text-gray-400 text-sm">Select a child to view assignments</div>
      ) : isLoading ? (
        <div className="space-y-3">{[0,1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            {tabs.map(t => (
              <Card key={t.key} className={`border cursor-pointer transition-all ${tab === t.key ? "border-2 shadow-md" : "border-gray-100"}`}
                style={{ borderColor: tab === t.key ? t.color : undefined }}
                onClick={() => setTab(t.key)}>
                <CardContent className="p-4 text-center">
                  <t.icon className="h-5 w-5 mx-auto mb-1.5" style={{ color: t.color }} />
                  <p className="text-xl font-black" style={{ color: t.color }}>{(data?.[t.key] || []).length}</p>
                  <p className="text-[10px] text-gray-500">{t.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Tab list */}
          <div className="flex bg-gray-100 rounded-xl p-1">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${tab === t.key ? "bg-white shadow text-gray-900" : "text-gray-500"}`}>
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
                <span className={`ml-1 text-[9px] px-1.5 py-0.5 rounded-full font-bold ${tab === t.key ? "text-white" : "bg-gray-200 text-gray-500"}`}
                  style={{ background: tab === t.key ? t.color : undefined }}>
                  {(data?.[t.key] || []).length}
                </span>
              </button>
            ))}
          </div>

          {/* Items */}
          <div className="space-y-2">
            {!items?.length ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                {tab === "overdue" ? "No overdue assignments 🎉" : tab === "pending" ? "No pending assignments" : "No submitted assignments yet"}
              </div>
            ) : (
              items.map((hw: any, i: number) => (
                <motion.div key={hw.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                  <AssignmentCard hw={hw} />
                </motion.div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
