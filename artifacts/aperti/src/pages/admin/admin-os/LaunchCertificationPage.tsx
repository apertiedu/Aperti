import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Rocket, CheckCircle2, XCircle, AlertTriangle, RefreshCw,
  ShieldCheck, Lock, UserPlus, CreditCard, BookOpen,
  Shield, Smartphone, Database, BarChart3, Flag, Loader2,
  ExternalLink, KeyRound, Monitor, GraduationCap, ClipboardCheck,
  FileSearch,
} from "lucide-react";
import { Link } from "wouter";

const tok = () => localStorage.getItem("aperti_token") || "";
const api = (path: string) =>
  fetch(path, { headers: { Authorization: `Bearer ${tok()}` } }).then(r => r.json());

const CHECK_META: Record<string, { icon: any; link?: string; color: string }> = {
  auth_passes:              { icon: Lock,           link: "/admin/os/security",        color: "text-blue-600"   },
  registration_passes:      { icon: UserPlus,        link: "/admin/os/users",           color: "text-purple-600" },
  password_reset_passes:    { icon: KeyRound,         link: "/admin/os/security",        color: "text-indigo-600" },
  device_management_works:  { icon: Monitor,          link: "/admin/os/user-access",     color: "text-cyan-600"   },
  enrollment_flows_tested:  { icon: GraduationCap,    link: "/admin/os/enrollments",     color: "text-orange-600" },
  assessments_graded:       { icon: ClipboardCheck,   link: "/admin/os/analytics",       color: "text-amber-600"  },
  question_extraction_valid:{ icon: FileSearch,        link: "/admin/os/content-quality", color: "text-teal-600"   },
  payments_verified:        { icon: CreditCard,        link: "/admin/os/payments",        color: "text-emerald-600"},
  mobile_approved:          { icon: Smartphone,        color: "text-pink-600"             },
  analytics_real_data:      { icon: BarChart3,         link: "/admin/os/analytics",       color: "text-violet-600" },
  security_review_passed:   { icon: Shield,            link: "/admin/os/security",        color: "text-red-600"    },
  database_integrity:       { icon: Database,          link: "/admin/os/integrity",       color: "text-slate-600"  },
};

function CheckItem({ check, index }: { check: any; index: number }) {
  const meta = CHECK_META[check.id] || { icon: ShieldCheck, color: "text-gray-600" };
  const Icon = meta.icon;

  const statusMap: Record<string, { icon: any; color: string; bg: string; border: string; label: string }> = {
    pass: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-50", border: "border-green-100", label: "Pass" },
    fail: { icon: XCircle,      color: "text-red-500",   bg: "bg-red-50",   border: "border-red-100",   label: "Fail" },
    warn: { icon: AlertTriangle,color: "text-amber-500", bg: "bg-amber-50", border: "border-amber-100", label: "Warn" },
  };
  const statusConfig = statusMap[check.status as string] || { icon: Loader2, color: "text-gray-400", bg: "bg-gray-50", border: "border-gray-100", label: "…" };

  const StatusIcon = statusConfig.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={`relative flex items-start gap-3 p-4 rounded-xl border ${statusConfig.border} ${statusConfig.bg} overflow-hidden`}
    >
      {check.status === "pass" && (
        <div className="absolute inset-0 bg-gradient-to-r from-green-50/60 to-transparent pointer-events-none" />
      )}
      <div className={`mt-0.5 p-2 rounded-lg bg-white/70 ${meta.color} flex-shrink-0`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-semibold text-gray-900">{check.label}</p>
          {meta.link && (
            <Link href={meta.link}>
              <ExternalLink className="w-3 h-3 text-gray-400 hover:text-gray-600 cursor-pointer" />
            </Link>
          )}
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">{check.detail}</p>
      </div>
      <div className={`flex items-center gap-1.5 flex-shrink-0 ${statusConfig.color}`}>
        <StatusIcon className="w-4 h-4" />
        <span className="text-xs font-semibold">{statusConfig.label}</span>
      </div>
    </motion.div>
  );
}

export default function LaunchCertificationPage() {
  const [lastRun, setLastRun] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data, isLoading, isFetching, refetch } = useQuery<any>({
    queryKey: ["launch-certification"],
    queryFn: () => api("/api/founder/launch-certification").then(d => { setLastRun(new Date().toLocaleTimeString()); return d; }),
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const checks: any[] = data?.checks || [];
  const certified: boolean = data?.certified ?? false;
  const failCount: number = data?.failCount ?? 0;
  const warnCount: number = data?.warnCount ?? 0;
  const passCount = checks.filter(c => c.status === "pass").length;

  const handleRerun = () => {
    qc.invalidateQueries({ queryKey: ["launch-certification"] });
    refetch();
  };

  const REQUIRED_12 = [
    "Authentication passes",
    "Registration passes",
    "Password reset passes",
    "Device management works",
    "Enrollment flows tested",
    "Assessments graded correctly",
    "Question extraction produces valid output",
    "Payments verified end-to-end",
    "Mobile experience approved",
    "Analytics delivering real data",
    "Security review passed",
    "Database integrity confirmed",
  ];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Rocket className="w-6 h-6 text-teal-600" />
            Launch Certification
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">All 12 systems must pass before Aperti can launch</p>
        </div>
        <button
          onClick={handleRerun}
          disabled={isFetching}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-60 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          {isFetching ? "Checking…" : "Re-run Checks"}
        </button>
      </div>

      {/* Required 12 checklist legend */}
      <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Required Gate Criteria</p>
        <div className="grid sm:grid-cols-2 gap-1.5">
          {REQUIRED_12.map((item, i) => {
            const check = checks.find(c => c.label === item || c.label.toLowerCase().includes(item.split(" ").slice(0, 2).join(" ").toLowerCase()));
            const passed = check?.status === "pass";
            const failed = check?.status === "fail";
            return (
              <div key={i} className="flex items-center gap-2 text-xs">
                {passed ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                ) : failed ? (
                  <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 flex-shrink-0" />
                )}
                <span className={passed ? "text-green-700 font-medium" : failed ? "text-red-700 font-medium" : "text-gray-500"}>
                  {item}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main certification banner */}
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-40 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-400">Running system checks…</p>
            </div>
          </motion.div>
        ) : certified ? (
          <motion.div
            key="certified"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="relative overflow-hidden rounded-2xl border-2 border-green-200 bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 p-8"
          >
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 + i * 10, x: (i % 2 === 0 ? -1 : 1) * 10 }}
                  animate={{ opacity: [0, 0.6, 0], y: -60, x: (i % 2 === 0 ? -1 : 1) * 30 }}
                  transition={{ delay: i * 0.15, duration: 2, repeat: Infinity, repeatDelay: 3 }}
                  className="absolute text-lg"
                  style={{ left: `${10 + i * 11}%`, bottom: "10px" }}
                >
                  {["✅","🚀","✨","🎉","⭐","🌟","💚","🔥"][i]}
                </motion.div>
              ))}
            </div>

            <div className="relative text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 260, damping: 20 }}
                className="w-20 h-20 rounded-2xl bg-green-100 border-2 border-green-200 flex items-center justify-center mx-auto mb-5"
              >
                <Rocket className="w-10 h-10 text-green-600" />
              </motion.div>
              <motion.h2
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-3xl font-black text-green-800 mb-2"
              >
                Aperti is Certified for Launch 🚀
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-base text-green-700 font-medium"
              >
                All 12 systems passed. Platform is production-ready.
              </motion.p>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="flex items-center justify-center gap-6 mt-5 text-sm text-green-700"
              >
                <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-500" />{passCount}/12 passed</span>
                {warnCount > 0 && <span className="flex items-center gap-1.5 text-amber-600"><AlertTriangle className="w-4 h-4" />{warnCount} warning{warnCount !== 1 ? "s" : ""}</span>}
              </motion.div>
              {lastRun && (
                <p className="text-xs text-green-600/70 mt-3">Last checked at {lastRun}</p>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="blocked"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border-2 border-red-200 bg-red-50 p-6"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <XCircle className="w-7 h-7 text-red-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-red-800">Launch Blocked 🔴</h2>
                <p className="text-sm text-red-600 mt-0.5">
                  {failCount} check{failCount !== 1 ? "s" : ""} failing.{" "}
                  {warnCount > 0 && `${warnCount} warning${warnCount !== 1 ? "s" : ""}. `}
                  Every red item is a critical blocker — resolve before launch.
                </p>
              </div>
            </div>
            {checks.filter(c => c.status === "fail").length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-red-700 mb-2">Critical Blockers 🔴</p>
                <div className="flex flex-wrap gap-2">
                  {checks.filter(c => c.status === "fail").map(c => (
                    <span key={c.id} className="flex items-center gap-1.5 text-xs font-medium bg-red-100 text-red-700 px-2.5 py-1 rounded-full">
                      <XCircle className="w-3 h-3" />
                      {c.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {checks.filter(c => c.status === "warn").length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-amber-700 mb-2">Warnings 🟠</p>
                <div className="flex flex-wrap gap-2">
                  {checks.filter(c => c.status === "warn").map(c => (
                    <span key={c.id} className="flex items-center gap-1.5 text-xs font-medium bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">
                      <AlertTriangle className="w-3 h-3" />
                      {c.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress bar */}
      {!isLoading && checks.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Certification Progress</p>
            <p className="text-sm font-bold text-gray-700">{passCount} / {checks.length}</p>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(passCount / checks.length) * 100}%` }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className={`h-full rounded-full ${certified ? "bg-green-500" : passCount > checks.length * 0.7 ? "bg-amber-500" : "bg-red-500"}`}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-[10px] text-gray-400">
            <span>0%</span>
            <span className={`font-semibold ${certified ? "text-green-600" : "text-gray-500"}`}>
              {Math.round((passCount / checks.length) * 100)}% complete
            </span>
            <span>100%</span>
          </div>
        </div>
      )}

      {/* Checklist grid */}
      {!isLoading && checks.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400 px-1">System Checks — Live from Database</p>
          <div className="grid sm:grid-cols-2 gap-2.5">
            {checks.map((check: any, i: number) => (
              <CheckItem key={check.id} check={check} index={i} />
            ))}
          </div>
        </div>
      )}

      {!isLoading && checks.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Rocket className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No check data yet. Click Re-run to start.</p>
        </div>
      )}

      {/* Footer note */}
      {!isLoading && (
        <div className="text-center text-xs text-gray-400 pb-2">
          All checks query live database · Auto-refresh every 60s · {lastRun ? `Last run: ${lastRun}` : "Click Re-run to start"}
        </div>
      )}
    </div>
  );
}
