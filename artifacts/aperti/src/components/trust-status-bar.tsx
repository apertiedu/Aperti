import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { motion } from "framer-motion";
import { ShieldCheck, Clock, AlertTriangle, Zap } from "lucide-react";

async function fetchSubStatus() {
  const res = await apiFetch("/api/dashboard/subscription-status");
  if (!res.ok) return null;
  return res.json();
}

export default function TrustStatusBar() {
  const { data } = useQuery({ queryKey: ["subscription-status"], queryFn: fetchSubStatus, staleTime: 5 * 60 * 1000 });

  if (!data?.plan) return null;

  const { plan, status, daysLeft, studentLimit } = data;
  const isExpiringSoon = daysLeft !== null && daysLeft <= 14;
  const isTrial = status === "trial";

  const bgColor = isExpiringSoon
    ? "bg-amber-50 border-amber-200"
    : isTrial
      ? "bg-blue-50 border-blue-200"
      : "bg-emerald-50 border-emerald-200";
  const textColor = isExpiringSoon ? "text-amber-700" : isTrial ? "text-blue-700" : "text-emerald-700";
  const Icon = isExpiringSoon ? AlertTriangle : isTrial ? Zap : ShieldCheck;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className={`flex items-center gap-2.5 px-4 py-2 rounded-xl border text-xs font-semibold ${bgColor} ${textColor} mb-4`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{plan}</span>
      <span className="opacity-40">·</span>
      {daysLeft !== null ? (
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {daysLeft > 0 ? `${daysLeft} day${daysLeft !== 1 ? "s" : ""} remaining` : "Expires today"}
        </span>
      ) : (
        <span>Active</span>
      )}
      {studentLimit !== null && (
        <>
          <span className="opacity-40">·</span>
          <span>Up to {studentLimit} students</span>
        </>
      )}
      {isExpiringSoon && (
        <a href="/billing" className="ml-auto underline underline-offset-2 opacity-80 hover:opacity-100 transition-opacity">
          Renew now
        </a>
      )}
    </motion.div>
  );
}
