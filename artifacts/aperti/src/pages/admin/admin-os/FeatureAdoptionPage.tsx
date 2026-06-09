import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { fetchJSON } from "@/lib/api";
import { BarChart3, Users, TrendingUp, Package, CheckCircle2, Clock } from "lucide-react";

const TEAL = "#0D9488";

const STATUS_COLORS: Record<string, string> = {
  released:   "bg-green-100 text-green-700",
  beta:       "bg-orange-100 text-orange-700",
  coming_soon:"bg-teal-100 text-teal-700",
  scheduled:  "bg-indigo-100 text-indigo-700",
  draft:      "bg-gray-100 text-gray-600",
  deprecated: "bg-red-100 text-red-600",
};

export default function FeatureAdoptionPage() {
  const { data: adoption = [], isLoading } = useQuery({
    queryKey: ["admin-feature-adoption"],
    queryFn: () => fetchJSON("/api/admin/analytics/feature-adoption"),
    refetchInterval: 60000,
  });

  const totalWaitlist = adoption.reduce((s: number, f: any) => s + (parseInt(f.waitlist_count) || 0), 0);
  const totalBeta     = adoption.reduce((s: number, f: any) => s + (parseInt(f.beta_count) || 0), 0);
  const released      = adoption.filter((f: any) => f.status === "released").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Feature Adoption</h1>
        <p className="text-sm text-gray-500 mt-0.5">Per-feature waitlist, beta enrollment, and adoption metrics</p>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Features tracked", value: adoption.length, icon: Package,      color: "text-gray-600",   bg: "bg-gray-50" },
          { label: "Released",         value: released,         icon: CheckCircle2, color: "text-green-600",  bg: "bg-green-50" },
          { label: "Waitlist signups", value: totalWaitlist,    icon: Users,        color: "text-teal-600",   bg: "bg-teal-50" },
          { label: "Beta testers",     value: totalBeta,        icon: TrendingUp,   color: "text-orange-600", bg: "bg-orange-50" },
        ].map(s => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`${s.bg} rounded-xl p-4`}>
            <s.icon className={`w-4 h-4 ${s.color} mb-2`} />
            <p className="text-2xl font-bold text-gray-900">{s.value.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Feature adoption table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-gray-400" />
          <h3 className="font-semibold text-gray-800">Per-Feature Metrics</h3>
        </div>
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[0,1,2,3,4].map(i => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)}
          </div>
        ) : adoption.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Package className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No feature adoption data yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-3 text-left">Feature</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Waitlist</th>
                  <th className="px-4 py-3 text-right">Beta Testers</th>
                  <th className="px-4 py-3 text-left">Release Date</th>
                  <th className="px-5 py-3 text-right">Interest Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {adoption.map((f: any, i: number) => {
                  const waitlist = parseInt(f.waitlist_count) || 0;
                  const beta = parseInt(f.beta_count) || 0;
                  const score = waitlist * 2 + beta * 5;
                  const maxScore = Math.max(...adoption.map((x: any) => (parseInt(x.waitlist_count)||0)*2 + (parseInt(x.beta_count)||0)*5), 1);
                  const barPct = Math.round((score / maxScore) * 100);
                  return (
                    <motion.tr key={f.feature_id || i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                      className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-gray-900 text-sm">{f.name}</p>
                        <p className="text-xs text-gray-400">{f.owner || "—"}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs text-gray-500">{f.category || "—"}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[f.status] ?? "bg-gray-100 text-gray-500"}`}>
                          {f.status?.replace(/_/g, " ").toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-sm font-semibold text-gray-900">{waitlist.toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="text-sm font-semibold text-gray-900">{beta.toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          {f.release_date ? (
                            <><Clock className="w-3 h-3" />{new Date(f.release_date).toLocaleDateString()}</>
                          ) : "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2 justify-end">
                          <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${barPct}%`, background: TEAL }} />
                          </div>
                          <span className="text-xs font-semibold text-gray-700 w-6 text-right">{score}</span>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top features by interest */}
      {adoption.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-teal-500" />Top Features by Interest
          </h3>
          <div className="space-y-3">
            {[...adoption]
              .sort((a: any, b: any) => ((parseInt(b.waitlist_count)||0)*2 + (parseInt(b.beta_count)||0)*5) - ((parseInt(a.waitlist_count)||0)*2 + (parseInt(a.beta_count)||0)*5))
              .slice(0, 5)
              .map((f: any, i: number) => {
                const score = (parseInt(f.waitlist_count)||0)*2 + (parseInt(f.beta_count)||0)*5;
                const maxScore = [...adoption].reduce((max: number, x: any) => Math.max(max, (parseInt(x.waitlist_count)||0)*2 + (parseInt(x.beta_count)||0)*5), 1);
                return (
                  <div key={f.feature_id || i} className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0" style={{ background: TEAL }}>
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-800 w-48 truncate">{f.name}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <motion.div className="h-full rounded-full" style={{ background: TEAL }}
                        initial={{ width: 0 }} animate={{ width: `${Math.round((score / maxScore) * 100)}%` }}
                        transition={{ duration: 0.8, delay: i * 0.1 }} />
                    </div>
                    <span className="text-xs text-gray-400 w-12 text-right shrink-0">{score} pts</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
