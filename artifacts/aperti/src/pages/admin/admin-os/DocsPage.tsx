import { useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, CheckCircle, Clock, Settings, Database, Shield, Zap, Activity, Server, Monitor, Package, GitBranch, Smartphone } from "lucide-react";

const MODULES = [
  { name: "Authentication & Sessions", status: "stable", icon: Shield, version: "10.0", lastUpdated: "Phase 10", description: "JWT-based auth with MFA support, login history tracking, brute-force protection via rate limiting. Session management via PostgreSQL." },
  { name: "Database Layer", status: "stable", icon: Database, version: "10.0", lastUpdated: "Phase 10", description: "PostgreSQL with Drizzle ORM. Connection pooling, automated migrations, performance indexes on all high-traffic columns." },
  { name: "Caching System", status: "stable", icon: Zap, version: "10.0", lastUpdated: "Phase 10", description: "In-memory cache with Redis upgrade path. TTL-based invalidation. Cache helpers: getOrSet, invalidatePattern." },
  { name: "Job Queue", status: "stable", icon: Package, version: "10.0", lastUpdated: "Phase 10", description: "Background job processing for email, AI tasks, reports, and notifications. Admin dashboard at /admin/os/queue." },
  { name: "API Security", status: "stable", icon: Shield, version: "10.0", lastUpdated: "Phase 10", description: "Helmet.js security headers, global rate limiting (200 req/min), login limiter (10/min), CORS, 10MB payload limits." },
  { name: "Monitoring & Metrics", status: "stable", icon: Activity, version: "10.0", lastUpdated: "Phase 10", description: "Prometheus metrics at /metrics, API latency tracking in api_metrics table, system health checks at /api/health." },
  { name: "File Storage", status: "stable", icon: Server, version: "10.0", lastUpdated: "Phase 10", description: "Local disk storage with CDN_URL prefix support. File uploads up to 10MB. Images stored in /uploads." },
  { name: "Backup System", status: "stable", icon: Database, version: "10.0", lastUpdated: "Phase 10", description: "Automated pg_dump backups via node-cron (daily at 02:00 UTC). Stored in /backups, logged in backup_logs table." },
  { name: "Performance Tracking", status: "stable", icon: Monitor, version: "10.0", lastUpdated: "Phase 10", description: "Every API request logged to api_metrics. View dashboard at /admin/os/performance. P95 latency, error rates, slow queries." },
  { name: "Teacher OS", status: "stable", icon: BookOpen, version: "17.0", lastUpdated: "Phase 17", description: "Full teacher dashboard, gradebook, lesson planning, attendance, homework, exams, ContentCraft, CourseBuilder, and AI-powered insights. Responsive on mobile." },
  { name: "Student OS", status: "stable", icon: BookOpen, version: "17.0", lastUpdated: "Phase 17", description: "Study stream, Ascend gamification, SimVerse labs, Trial Vault, Flashcard 3.0, mentor AI, focus coaching, mobile dashboards, and offline sync." },
  { name: "Parent OS", status: "stable", icon: BookOpen, version: "17.0", lastUpdated: "Phase 17", description: "Guardian dashboard, attendance alerts, progress reports, meeting scheduling, real-time notifications, and mobile home view." },
  { name: "Admin OS", status: "stable", icon: Settings, version: "18.0", lastUpdated: "Phase 18", description: "Multi-tenant management, user CRUD, subscriptions, analytics, audit logs, feature flags, compliance, AI usage dashboard, launch audit, and governance." },
  { name: "AI Engine (Coremind)", status: "stable", icon: Zap, version: "8.0", lastUpdated: "Phase 8", description: "OpenAI-powered tutoring, homework feedback, syllabus generation, exam analysis, and adaptive learning paths." },
  { name: "Mobile Ecosystem", status: "stable", icon: Monitor, version: "17.0", lastUpdated: "Phase 17", description: "PWA with offline support, push notifications (VAPID), mobile bottom nav, camera upload, low-bandwidth mode, and role-specific mobile dashboards." },
  { name: "Version Control", status: "stable", icon: GitBranch, version: "10.0", lastUpdated: "Phase 10", description: "entity_versions table tracks changes to assessments, question_bank, and courses with full data snapshots." },
  { name: "Enterprise Governance", status: "stable", icon: CheckCircle, version: "18.0", lastUpdated: "Phase 18", description: "Advanced audit logging with severity, AI usage tracking, internationalization framework (currencies/languages), legal compliance (data export, deletion), and launch audit checklist." },
];

const ENV_VARS = [
  { key: "DATABASE_URL", desc: "PostgreSQL connection string", required: true },
  { key: "SESSION_SECRET", desc: "Express session secret (min 32 chars)", required: true },
  { key: "JWT_SECRET", desc: "JWT signing key (min 32 chars)", required: true },
  { key: "OPENAI_API_KEY", desc: "OpenAI API key for AI features", required: false },
  { key: "REDIS_URL", desc: "Redis connection URL (optional — uses memory cache if absent)", required: false },
  { key: "CDN_URL", desc: "CDN base URL for file uploads (optional)", required: false },
  { key: "MFA_ENCRYPTION_KEY", desc: "32-char key for encrypting MFA secrets", required: false },
  { key: "PORT", desc: "API server port (default: 3001)", required: false },
  { key: "VAPID_PUBLIC_KEY", desc: "VAPID public key for push notifications (auto-generated if absent)", required: false },
  { key: "VAPID_PRIVATE_KEY", desc: "VAPID private key for push notifications (auto-generated if absent)", required: false },
];

const statusBadge: Record<string, string> = {
  stable: "bg-green-100 text-green-700",
  beta: "bg-blue-100 text-blue-700",
  planned: "bg-gray-100 text-gray-600",
};

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState<"modules" | "env" | "api" | "deploy">("modules");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Documentation</h1>
        <p className="text-sm text-gray-500 mt-0.5">Internal reference for Aperti modules, configuration, and deployment</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {(["modules", "env", "api", "deploy"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setActiveSection(s)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all capitalize ${activeSection === s ? "bg-white text-teal-700 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
          >
            {s === "env" ? "Environment" : s === "api" ? "API Reference" : s}
          </button>
        ))}
      </div>

      {/* Modules */}
      {activeSection === "modules" && (
        <div className="grid gap-4">
          {MODULES.map((mod, i) => (
            <motion.div key={mod.name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-teal-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <mod.icon className="w-5 h-5 text-teal-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{mod.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge[mod.status]}`}>{mod.status}</span>
                      <span className="text-xs text-gray-400">v{mod.version}</span>
                    </div>
                    <p className="text-sm text-gray-600">{mod.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-400 flex-shrink-0">
                  <Clock className="w-3 h-3" /> {mod.lastUpdated}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Environment Variables */}
      {activeSection === "env" && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <strong>Security reminder:</strong> Never commit environment variables to source control. Use Replit Secrets or a .env file (gitignored) for local development.
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  {["Variable", "Description", "Required"].map((h) => (
                    <th key={h} className="px-6 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {ENV_VARS.map((v) => (
                  <tr key={v.key} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-mono text-teal-700 text-xs">{v.key}</td>
                    <td className="px-6 py-3 text-gray-600">{v.desc}</td>
                    <td className="px-6 py-3">
                      {v.required
                        ? <span className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle className="w-3 h-3" /> Required</span>
                        : <span className="text-gray-400 text-xs">Optional</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* API Reference */}
      {activeSection === "api" && (
        <div className="space-y-4">
          {[
            { group: "Authentication", prefix: "/auth", endpoints: [
              { method: "POST", path: "/login", desc: "Login with username/password. Rate limited to 10/min." },
              { method: "POST", path: "/register", desc: "Register a new teacher/student/parent account." },
              { method: "GET", path: "/me", desc: "Get current authenticated user info." },
              { method: "POST", path: "/logout", desc: "Logout and remove device session." },
            ]},
            { group: "MFA", prefix: "/api/auth/mfa", endpoints: [
              { method: "POST", path: "/setup", desc: "Generate TOTP secret and QR URI." },
              { method: "POST", path: "/verify", desc: "Verify TOTP code and enable MFA." },
              { method: "POST", path: "/disable", desc: "Disable MFA with verification." },
              { method: "GET", path: "/status", desc: "Check if MFA is enabled for current user." },
            ]},
            { group: "Admin — Queue", prefix: "/api/admin/queue", endpoints: [
              { method: "GET", path: "/stats", desc: "Queue statistics (waiting/active/completed/failed)." },
              { method: "GET", path: "/jobs", desc: "List recent jobs (limit param supported)." },
              { method: "POST", path: "/test", desc: "Enqueue a test notification job." },
            ]},
            { group: "Admin — Performance", prefix: "/api/admin/performance", endpoints: [
              { method: "GET", path: "/metrics", desc: "API performance metrics (last 1h). Endpoint latencies, error rates, timeline." },
              { method: "GET", path: "/health-summary", desc: "DB size, process uptime, top tables." },
            ]},
            { group: "System", prefix: "", endpoints: [
              { method: "GET", path: "/api/health", desc: "Public health check (DB, Redis, uptime, version)." },
              { method: "GET", path: "/metrics", desc: "Prometheus metrics for scraping." },
            ]},
          ].map((group) => (
            <div key={group.group} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                <h3 className="font-semibold text-gray-900">{group.group}</h3>
                <p className="text-xs text-gray-400 font-mono">{group.prefix}</p>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-50">
                  {group.endpoints.map((ep) => (
                    <tr key={ep.path} className="hover:bg-gray-50">
                      <td className="px-6 py-3 w-16">
                        <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded ${ep.method === "GET" ? "bg-blue-100 text-blue-700" : ep.method === "POST" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {ep.method}
                        </span>
                      </td>
                      <td className="px-6 py-3 font-mono text-xs text-gray-700">{group.prefix}{ep.path}</td>
                      <td className="px-6 py-3 text-gray-600">{ep.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Deployment */}
      {activeSection === "deploy" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Deployment Guide</h2>
            {[
              { step: "1", title: "Environment Variables", content: "Set all required environment variables (DATABASE_URL, SESSION_SECRET, JWT_SECRET) in Replit Secrets or your host's config panel." },
              { step: "2", title: "Database Setup", content: "Run `pnpm --filter @workspace/db run push` to apply all schema migrations. The API server also runs Phase 10 migrations automatically on startup." },
              { step: "3", title: "Build", content: "Run `pnpm run build` to compile the API server (esbuild) and frontend (Vite). Output: artifacts/api-server/dist and artifacts/aperti/dist." },
              { step: "4", title: "Start Services", content: "API runs on PORT (default 3001). Frontend Vite dev server on PORT=5000. In production, serve the built frontend via nginx or express static." },
              { step: "5", title: "Health Check", content: "Verify at GET /api/health — should return `{ status: 'ok', db: 'connected' }`. Set this as your load balancer health check URL." },
              { step: "6", title: "Backups", content: "Backups run automatically daily at 02:00 UTC via node-cron. Ensure pg_dump is available in your production environment." },
            ].map((item) => (
              <div key={item.step} className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center flex-shrink-0 text-sm font-bold">{item.step}</div>
                <div>
                  <h3 className="font-semibold text-gray-900">{item.title}</h3>
                  <p className="text-sm text-gray-600 mt-0.5">{item.content}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
