import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { fetchJSON, putJSON } from "@/lib/api";
import {
  Rocket, CheckCircle2, XCircle, Clock, ShieldCheck,
  RefreshCw, ChevronDown, ChevronUp,
} from "lucide-react";
import { useState } from "react";

const STATUS_CONFIG = {
  pass:    { label: "Pass",    icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50 border-green-200" },
  fail:    { label: "Fail",    icon: XCircle,      color: "text-rose-600",  bg: "bg-rose-50 border-rose-200" },
  pending: { label: "Pending", icon: Clock,        color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
};

const AUTO_CHECKS: Record<string, { label: string; category: string }> = {
  health_api:       { label: "API Health Check",        category: "Infrastructure" },
  health_db:        { label: "Database Connectivity",   category: "Infrastructure" },
  auth_flow:        { label: "Authentication Flow",     category: "Security" },
  payment_gateway:  { label: "Payment Gateway",         category: "Business" },
  email_delivery:   { label: "Email Delivery",          category: "Communications" },
  ssl_cert:         { label: "SSL Certificate",         category: "Security" },
  backup_recent:    { label: "Recent Backup Exists",    category: "Infrastructure" },
  gdpr_compliance:  { label: "GDPR Compliance Check",   category: "Legal" },
  rate_limits:      { label: "Rate Limiting Active",    category: "Security" },
  error_tracking:   { label: "Error Tracking",          category: "Operations" },
};

export default function LaunchCommandPage() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["Infrastructure", "Security"]));

  const { data, isLoading } = useQuery({
    queryKey: ["launch-status"],
    queryFn: () => fetchJSON("/api/launch/status"),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      putJSON(`/api/launch/checklist/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["launch-status"] }),
  });

  const items: any[] = data?.items ?? [];
  const readiness = data?.readinessScore ?? 0;
  const total = items.length;
  const passed = items.filter((i: any) => i.status === "pass").length;

  // Group by category (derived from check_key prefix)
  const grouped = items.reduce((acc: Record<string, any[]>, item: any) => {
    const meta = AUTO_CHECKS[item.check_key] ?? { label: item.check_key, category: "Other" };
    const cat = meta.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push({ ...item, label: meta.label });
    return acc;
  }, {});

  const toggleCategory = (cat: string) => {
    setExpanded(s => {
      const n = new Set(s);
      n.has(cat) ? n.delete(cat) : n.add(cat);
      return n;
    });
  };

  const readinessColor = readiness >= 80 ? "text-green-600" : readiness >= 50 ? "text-amber-600" : "text-rose-600";
  const readinessBg = readiness >= 80 ? "bg-green-500" : readiness >= 50 ? "bg-amber-500" : "bg-rose-500";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Launch Command Center</h1>
          <p className="text-sm text-gray-500 mt-0.5">Pre-launch checklist — track readiness before going live</p>
        </div>
        <button onClick={() => qc.invalidateQueries({ queryKey: ["launch-status"] })}
          className="flex items-center gap-2 border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-sm hover:bg-gray-50">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Readiness gauge */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-800">Platform Readiness</h3>
            <p className="text-sm text-gray-500 mt-0.5">{passed} of {total} checks passed</p>
          </div>
          <div className="text-right">
            <p className={`text-4xl font-bold ${readinessColor}`}>{readiness}%</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {readiness >= 80 ? "🚀 Ready to launch!" : readiness >= 50 ? "🔧 Almost ready" : "⚠️ Not ready yet"}
            </p>
          </div>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
          <motion.div className={`h-4 rounded-full ${readinessBg}`}
            initial={{ width: 0 }} animate={{ width: `${readiness}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }} />
        </div>
      </motion.div>

      {/* Checklist by category */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse h-16" />
          ))}
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
          <Rocket className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No checklist items yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([category, catItems]: [string, any[]]) => {
            const catPassed = catItems.filter(i => i.status === "pass").length;
            const isOpen = expanded.has(category);
            return (
              <div key={category} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    <span className="font-medium text-gray-800">{category}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      catPassed === catItems.length ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {catPassed}/{catItems.length}
                    </span>
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>
                {isOpen && (
                  <div className="border-t border-gray-100">
                    {catItems.map((item: any) => {
                      const cfg = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
                      const Icon = cfg.icon;
                      return (
                        <div key={item.id} className={`flex items-center justify-between px-5 py-3 border-t first:border-t-0 border-gray-50`}>
                          <div className="flex items-center gap-3">
                            <Icon className={`w-4 h-4 flex-shrink-0 ${cfg.color}`} />
                            <span className="text-sm text-gray-700">{item.label}</span>
                            {item.notes && (
                              <span className="text-xs text-gray-400 italic">— {item.notes}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.bg} ${cfg.color}`}>
                              {cfg.label}
                            </span>
                            {/* Manual toggle */}
                            <select
                              value={item.status}
                              onChange={(e) => toggleMut.mutate({ id: item.id, status: e.target.value })}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/30"
                            >
                              <option value="pass">Pass</option>
                              <option value="fail">Fail</option>
                              <option value="pending">Pending</option>
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
