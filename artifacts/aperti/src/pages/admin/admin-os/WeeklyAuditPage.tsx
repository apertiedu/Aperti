import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  CalendarCheck, RefreshCw, FileText, AlertTriangle, Users,
  Clock, Zap, TrendingDown, Plus, Loader2
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const tok = () => localStorage.getItem("aperti_token") || "";
const api = (path: string, opts?: RequestInit) =>
  fetch(path, { headers: { Authorization: `Bearer ${tok()}`, "Content-Type": "application/json" }, ...opts }).then(r => r.json());

function ReportCard({ report, index }: { report: any; index: number }) {
  const data = typeof report.report_data === "string" ? JSON.parse(report.report_data) : (report.report_data ?? {});
  const [expanded, setExpanded] = useState(index === 0);

  const items = [
    { label: "New Errors", value: data.newErrors ?? 0, icon: AlertTriangle, warn: data.newErrors > 5 },
    { label: "Slow Queries", value: data.slowQueries ?? 0, icon: Clock, warn: data.slowQueries > 10 },
    { label: "Avg Query Latency", value: data.avgQueryMs ? `${data.avgQueryMs}ms` : "—", icon: Zap, warn: (data.avgQueryMs ?? 0) > 500 },
    { label: "Friction Events", value: data.frictionEvents ?? 0, icon: TrendingDown, warn: data.frictionEvents > 20 },
    { label: "New Users", value: data.newUsers ?? 0, icon: Users, warn: false },
  ];

  const hasWarnings = items.some(i => i.warn);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08 }}>
      <Card className={hasWarnings ? "border-amber-100" : "border-green-100"}>
        <CardHeader
          className="cursor-pointer pb-2 select-none"
          onClick={() => setExpanded(e => !e)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-800">
                Week of {new Date(report.week_start).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {hasWarnings
                ? <Badge className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">Has Warnings</Badge>
                : <Badge className="text-[10px] bg-green-50 text-green-700 border-green-200">Healthy</Badge>}
              <span className="text-xs text-gray-400">{expanded ? "▲" : "▼"}</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Generated {new Date(data.generatedAt ?? report.generated_at).toLocaleString()}
          </p>
        </CardHeader>

        {expanded && (
          <CardContent className="pt-0 pb-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {items.map(item => (
                <div key={item.label} className={`rounded-xl p-3 ${item.warn ? "bg-amber-50" : "bg-gray-50"}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <item.icon className={`w-3.5 h-3.5 ${item.warn ? "text-amber-500" : "text-gray-400"}`} />
                    <p className="text-[11px] text-gray-500">{item.label}</p>
                  </div>
                  <p className={`text-base font-bold tabular-nums ${item.warn ? "text-amber-700" : "text-gray-800"}`}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>
    </motion.div>
  );
}

export default function WeeklyAuditPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["weekly-audit"],
    queryFn: () => api("/api/founder/weekly-audit"),
    staleTime: 300000,
  });

  const generateMutation = useMutation({
    mutationFn: () => api("/api/founder/weekly-audit/generate", { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["weekly-audit"] }),
  });

  const reports: any[] = data?.reports ?? [];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-indigo-600" />
            Weekly Audit Reports
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Summaries generated every Monday — errors, performance, friction, and new users
          </p>
        </div>
        <button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
        >
          {generateMutation.isPending
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
            : <><Plus className="w-4 h-4" /> Generate Now</>}
        </button>
      </div>

      {/* Scheduling note */}
      <div className="flex items-start gap-3 p-3 rounded-xl bg-indigo-50 border border-indigo-100">
        <RefreshCw className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
        <p className="text-xs text-indigo-700">
          Audits auto-generate every Monday at midnight. You can also trigger one manually at any time using the button above.
          Each report covers the previous week's errors, slow queries, friction events, and new registrations.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <CalendarCheck className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500">No audit reports yet</p>
            <p className="text-xs text-gray-400 mt-1">
              Click "Generate Now" to create your first report, or wait for the Monday auto-generation.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((r: any, i: number) => (
            <ReportCard key={r.id} report={r} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
