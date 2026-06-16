import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { CreditCard, AlertTriangle, ChevronRight, Zap, Users } from "lucide-react";
import { Link } from "wouter";
import { apiFetch } from "@/lib/api";

interface PlanStatus {
  planName: string;
  status: string;
  renewalDate: string | null;
  studentLimit: number | null;
  studentCount: number;
  storageUsedMb: number;
  storageLimitMb: number | null;
  daysUntilRenewal: number | null;
  isNearLimit: boolean;
  isTrial: boolean;
}

export default function PlanStatusStrip() {
  const { data, isLoading } = useQuery<PlanStatus>({
    queryKey: ["plan-status-strip"],
    queryFn: () => apiFetch("/api/subscriptions/status").then(r => r.ok ? r.json() : null),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  if (isLoading || !data) return null;

  const studentPct = data.studentLimit ? (data.studentCount / data.studentLimit) * 100 : 0;
  const nearStudentLimit = data.studentLimit && studentPct >= 80;
  const expiryWarning = data.daysUntilRenewal !== null && data.daysUntilRenewal <= 14;

  if (!nearStudentLimit && !expiryWarning && !data.isTrial) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8, height: 0 }}
        animate={{ opacity: 1, y: 0, height: "auto" }}
        exit={{ opacity: 0, y: -8, height: 0 }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden"
      >
        <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 mb-4 ${
          expiryWarning ? "bg-amber-50 border-amber-200" :
          nearStudentLimit ? "bg-blue-50 border-blue-200" :
          "bg-primary/5 border-primary/15"
        }`}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
            expiryWarning ? "bg-amber-100" : nearStudentLimit ? "bg-blue-100" : "bg-primary/10"
          }`}>
            {expiryWarning
              ? <AlertTriangle className="w-4 h-4 text-amber-600" />
              : nearStudentLimit
              ? <Users className="w-4 h-4 text-blue-600" />
              : <Zap className="w-4 h-4 text-primary" />
            }
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-semibold ${
                expiryWarning ? "text-amber-800" : nearStudentLimit ? "text-blue-800" : "text-primary"
              }`}>
                {data.planName}
              </span>
              {data.isTrial && (
                <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">TRIAL</span>
              )}
            </div>
            <p className={`text-xs mt-0.5 ${
              expiryWarning ? "text-amber-700" : nearStudentLimit ? "text-blue-700" : "text-primary/80"
            }`}>
              {expiryWarning
                ? `Renews in ${data.daysUntilRenewal} days — don't lose access`
                : nearStudentLimit
                ? `${data.studentCount} / ${data.studentLimit} students used — consider upgrading`
                : `${data.studentCount} students active`
              }
            </p>
            {nearStudentLimit && data.studentLimit && (
              <div className="h-1 bg-blue-100 rounded-full mt-1.5 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-blue-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(studentPct, 100)}%` }}
                  transition={{ duration: 0.8 }}
                />
              </div>
            )}
          </div>

          <Link href="/my-subscription">
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg cursor-pointer flex-shrink-0 ${
                expiryWarning
                  ? "bg-amber-500 text-white hover:bg-amber-600"
                  : nearStudentLimit
                  ? "bg-blue-500 text-white hover:bg-blue-600"
                  : "bg-primary text-primary-foreground hover:opacity-90"
              }`}
            >
              <CreditCard className="w-3 h-3" />
              Upgrade
              <ChevronRight className="w-3 h-3" />
            </motion.div>
          </Link>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
