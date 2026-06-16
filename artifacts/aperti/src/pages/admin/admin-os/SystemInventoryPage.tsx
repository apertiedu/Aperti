import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Package, Shield, Database, Cpu, Globe, CheckCircle2,
  XCircle, AlertTriangle, RefreshCw, FileCode, Layers,
  Lock, Users, BookOpen, CreditCard, Activity, Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const api = (path: string) =>
  fetch(path, { credentials: "include" }).then(r => r.json());

const FEATURE_INVENTORY = [
  { category: "Auth & Security", icon: Lock, color: "blue", items: [
    { name: "HttpOnly Cookie Auth", status: "live", desc: "JWT in aperti_token cookie" },
    { name: "TOTP / MFA", status: "live", desc: "TOTP-based 2FA for admins" },
    { name: "Role-Based Access Control", status: "live", desc: "requireRole() on all protected routes" },
    { name: "Rate Limiting", status: "live", desc: "100/15min global, 10/15min auth" },
    { name: "Device Session Tracking", status: "live", desc: "Multi-device revocation" },
    { name: "JWT Refresh Tokens", status: "pending", desc: "Short-lived access + long-lived refresh" },
  ]},
  { category: "Core Learning", icon: BookOpen, color: "teal", items: [
    { name: "Lesson Management", status: "live", desc: "Create, schedule, and deliver lessons" },
    { name: "Assessment Hub", status: "live", desc: "Exams, quizzes, auto-grading" },
    { name: "Flashcard System (SM-2)", status: "live", desc: "Spaced repetition with confidence ratings" },
    { name: "Grade Flow", status: "live", desc: "Manual and AI-assisted grading" },
    { name: "Homework Submissions", status: "live", desc: "Student submit flow with file upload" },
    { name: "Course Catalogue", status: "live", desc: "Multi-subject course management" },
    { name: "Enrolment Approval", status: "live", desc: "Teacher-gated enrolment requests" },
  ]},
  { category: "AI Features", icon: Cpu, color: "purple", items: [
    { name: "TutorCraft AI", status: "live", desc: "Session planning with fallbacks" },
    { name: "Assessment Builder AI", status: "live", desc: "Question generation from syllabus" },
    { name: "Grade AI (Marker Mind)", status: "live", desc: "AI-assisted marking with override" },
    { name: "The Mentor", status: "live", desc: "Student AI tutor with context" },
    { name: "CoreMind Chat", status: "live", desc: "Platform-wide AI assistant" },
    { name: "Content Craft", status: "live", desc: "AI lesson content generation" },
    { name: "AI Circuit Breaker", status: "live", desc: "/api/ai/health with auto-fallback" },
  ]},
  { category: "People & Roles", icon: Users, color: "orange", items: [
    { name: "Multi-tenant Organisations", status: "live", desc: "Org-scoped tenancy model" },
    { name: "Teacher Verification", status: "live", desc: "Admin-gated teacher accounts" },
    { name: "Parent Portal", status: "live", desc: "Guardian visibility into student progress" },
    { name: "Parent-Child Link", status: "live", desc: "QR + code linking flow" },
    { name: "Assistant Permissions", status: "live", desc: "Delegated teacher roles" },
    { name: "Guardian Pulse", status: "live", desc: "Parent engagement analytics" },
  ]},
  { category: "Payments & Plans", icon: CreditCard, color: "green", items: [
    { name: "Subscription Plans", status: "live", desc: "Free / Pro / School tiers" },
    { name: "InstaPay Integration", status: "live", desc: "EGP payment gateway" },
    { name: "Stripe Integration", status: "partial", desc: "Webhook signatures need hardening" },
    { name: "Dunning / Recovery", status: "partial", desc: "SubPilot retry logic" },
    { name: "Invoice Generation", status: "live", desc: "Auto PDF invoices" },
    { name: "Plan Enforcement", status: "live", desc: "usePlanLimits hook on all features" },
  ]},
  { category: "Observability", icon: Activity, color: "red", items: [
    { name: "Health Endpoint", status: "live", desc: "/api/health — DB latency, memory, tables" },
    { name: "AI Health Endpoint", status: "live", desc: "/api/ai/health — circuit breaker status" },
    { name: "Frontend Error Capture", status: "live", desc: "AIErrorBoundary → /api/errors/log" },
    { name: "Admin Error Logs", status: "live", desc: "ErrorIntelligencePage with filters" },
    { name: "Slow Query Monitor", status: "live", desc: "SlowQueriesPage in admin-os" },
    { name: "Error Alerting (Sentry)", status: "pending", desc: "DSN not yet configured" },
  ]},
];

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  live:    { label: "Live",    color: "text-green-700",  bg: "bg-green-50 border-green-200",  icon: CheckCircle2 },
  partial: { label: "Partial", color: "text-amber-700",  bg: "bg-amber-50 border-amber-200",  icon: AlertTriangle },
  pending: { label: "Pending", color: "text-gray-500",   bg: "bg-gray-50 border-gray-200",    icon: XCircle },
  mock:    { label: "Mock",    color: "text-red-600",    bg: "bg-red-50 border-red-200",      icon: XCircle },
};

const COLOR_MAP: Record<string, string> = {
  blue: "bg-blue-100 text-blue-600",
  teal: "bg-teal-100 text-teal-600",
  purple: "bg-purple-100 text-purple-600",
  orange: "bg-orange-100 text-orange-600",
  green: "bg-green-100 text-green-600",
  red: "bg-red-100 text-red-600",
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

export default function SystemInventoryPage() {
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: health, isLoading: healthLoading, refetch } = useQuery({
    queryKey: ["admin-system-health"],
    queryFn: () => api("/api/health"),
    staleTime: 30_000,
    retry: false,
  });

  const { data: aiHealth } = useQuery({
    queryKey: ["admin-ai-health"],
    queryFn: () => api("/api/ai/health"),
    staleTime: 30_000,
    retry: false,
  });

  const totalFeatures = FEATURE_INVENTORY.flatMap(c => c.items).length;
  const liveCount = FEATURE_INVENTORY.flatMap(c => c.items).filter(i => i.status === "live").length;
  const partialCount = FEATURE_INVENTORY.flatMap(c => c.items).filter(i => i.status === "partial").length;
  const pendingCount = FEATURE_INVENTORY.flatMap(c => c.items).filter(i => i.status === "pending").length;
  const livePercent = Math.round((liveCount / totalFeatures) * 100);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">System Inventory</h1>
          <p className="text-sm text-gray-500 mt-0.5">Live feature registry — {livePercent}% production-ready</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2 rounded-xl" onClick={() => refetch()}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Features", value: totalFeatures, color: "text-gray-900", bg: "bg-gray-50" },
          { label: "Live", value: liveCount, color: "text-green-700", bg: "bg-green-50" },
          { label: "Partial", value: partialCount, color: "text-amber-700", bg: "bg-amber-50" },
          { label: "Pending", value: pendingCount, color: "text-gray-500", bg: "bg-gray-50" },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4 border border-gray-100`}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{s.label}</p>
            <p className={`text-3xl font-black mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-teal-100 flex items-center justify-center">
              <Database className="h-4 w-4 text-teal-600" />
            </div>
            <h3 className="font-bold text-gray-900 text-sm">Database</h3>
          </div>
          {healthLoading ? (
            <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
          ) : (
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className="font-semibold text-green-600">{health?.database?.status ?? "ok"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Latency</span>
                <span className="font-semibold text-gray-900">{health?.database?.latency_ms ?? "—"}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tables</span>
                <span className="font-semibold text-gray-900">{health?.database?.table_count ?? "—"}</span>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-purple-100 flex items-center justify-center">
              <Cpu className="h-4 w-4 text-purple-600" />
            </div>
            <h3 className="font-bold text-gray-900 text-sm">AI System</h3>
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Status</span>
              <span className={`font-semibold ${aiHealth?.status === "ok" ? "text-green-600" : "text-amber-600"}`}>
                {aiHealth?.status ?? "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Circuit</span>
              <span className="font-semibold text-gray-900">{aiHealth?.circuit_breaker ?? "closed"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Model</span>
              <span className="font-semibold text-gray-900">{aiHealth?.model ?? "gpt-4o"}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
              <Globe className="h-4 w-4 text-blue-600" />
            </div>
            <h3 className="font-bold text-gray-900 text-sm">Runtime</h3>
          </div>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Memory</span>
              <span className="font-semibold text-gray-900">
                {health?.memory ? `${Math.round(health.memory.heapUsed / 1024 / 1024)}MB` : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Node</span>
              <span className="font-semibold text-gray-900">{health?.version ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Uptime</span>
              <span className="font-semibold text-gray-900">
                {health?.uptime ? `${Math.round(health.uptime / 60)}m` : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-widest">Feature Registry</h2>
        {FEATURE_INVENTORY.map((cat) => {
          const Icon = cat.icon;
          const isOpen = expanded === cat.category;
          const catLive = cat.items.filter(i => i.status === "live").length;
          return (
            <motion.div key={cat.category}
              className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <button
                onClick={() => setExpanded(isOpen ? null : cat.category)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${COLOR_MAP[cat.color]}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{cat.category}</p>
                    <p className="text-xs text-gray-400">{catLive}/{cat.items.length} live</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-500 rounded-full"
                      style={{ width: `${(catLive / cat.items.length) * 100}%` }}
                    />
                  </div>
                  <Zap className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : ""} text-gray-400`} />
                </div>
              </button>
              {isOpen && (
                <div className="border-t border-gray-50">
                  {cat.items.map((item, i) => (
                    <div key={item.name}
                      className={`flex items-center justify-between px-4 py-3 ${i < cat.items.length - 1 ? "border-b border-gray-50" : ""}`}>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{item.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
                      </div>
                      <StatusBadge status={item.status} />
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-4 w-4 text-teal-600" />
          <h3 className="font-bold text-gray-900 text-sm">Auth Migration Status</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          {[
            { label: "localStorage token reads", value: "0 remaining", status: "ok" },
            { label: "Authorization header constructions", value: "0 remaining", status: "ok" },
            { label: "HttpOnly cookie delivery", value: "All routes", status: "ok" },
            { label: "credentials: include on fetches", value: "All fetches", status: "ok" },
            { label: "Socket.io withCredentials", value: "true on all sockets", status: "ok" },
            { label: "JWT refresh token rotation", value: "Not yet implemented", status: "pending" },
          ].map(item => (
            <div key={item.label} className={`flex items-start gap-2 p-3 rounded-lg ${item.status === "ok" ? "bg-green-50" : "bg-amber-50"}`}>
              {item.status === "ok"
                ? <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                : <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />}
              <div>
                <p className={`font-medium text-xs ${item.status === "ok" ? "text-green-800" : "text-amber-800"}`}>{item.label}</p>
                <p className={`text-xs mt-0.5 ${item.status === "ok" ? "text-green-600" : "text-amber-600"}`}>{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center gap-2 mb-4">
          <FileCode className="h-4 w-4 text-teal-600" />
          <h3 className="font-bold text-gray-900 text-sm">Architecture Summary</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          {[
            { label: "Frontend", value: "React 19 + Vite" },
            { label: "Backend", value: "Express 5 + TypeScript" },
            { label: "Database", value: "PostgreSQL + Drizzle" },
            { label: "Auth", value: "JWT HttpOnly Cookie" },
            { label: "AI", value: "OpenAI GPT-4o" },
            { label: "Styling", value: "Tailwind CSS v4" },
            { label: "Animations", value: "Framer Motion" },
            { label: "State", value: "TanStack Query v5" },
          ].map(item => (
            <div key={item.label} className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-400 font-medium">{item.label}</p>
              <p className="font-semibold text-gray-900 mt-0.5">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
