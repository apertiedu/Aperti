import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { fetchJSON, putJSON, postJSON } from "@/lib/api";
import { toast } from "sonner";
import {
  AlertTriangle, AlertCircle, Info, CheckCheck, Circle,
  CreditCard, Activity, Zap, Mail, Webhook, Settings,
  Bell, Eye, EyeOff, Send, Save, ChevronRight, Loader2,
} from "lucide-react";

const SEV_CONFIG: Record<string, { label: string; bg: string; border: string; text: string; icon: any }> = {
  critical: { label: "Critical", bg: "bg-rose-50",  border: "border-rose-200",  text: "text-rose-700",  icon: AlertCircle },
  warning:  { label: "Warning",  bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", icon: AlertTriangle },
  info:     { label: "Info",     bg: "bg-blue-50",  border: "border-blue-200",  text: "text-blue-700",  icon: Info },
};

const TYPE_ICONS: Record<string, any> = {
  payment_failure:       CreditCard,
  outage:                Activity,
  ai_cost_spike:         Zap,
  launch_blocker_critical: AlertCircle,
  problem_report:        AlertTriangle,
  test_alert:            Bell,
  default:               AlertTriangle,
};

function AlertCard({ alert, onRead }: { alert: any; onRead: () => void }) {
  const sev = SEV_CONFIG[alert.severity] ?? SEV_CONFIG.info;
  const SevIcon = sev.icon;
  const TypeIcon = TYPE_ICONS[alert.type] ?? TYPE_ICONS.default;
  return (
    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
      className={`rounded-xl border p-4 ${sev.bg} ${sev.border} ${alert.is_read ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-white/70 flex items-center justify-center flex-shrink-0">
          <TypeIcon className={`w-4 h-4 ${sev.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-semibold uppercase tracking-wide ${sev.text}`}>{sev.label}</span>
            <span className="text-xs text-gray-500 capitalize">· {alert.type?.replace(/_/g, " ")}</span>
            {!alert.is_read && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
          </div>
          <p className="text-sm text-gray-800 font-medium">{alert.message}</p>
          <p className="text-xs text-gray-400 mt-1">{new Date(alert.created_at).toLocaleString()}</p>
        </div>
        {!alert.is_read && (
          <button onClick={onRead}
            className="flex-shrink-0 flex items-center gap-1 text-xs text-gray-500 hover:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-white/60">
            <CheckCheck className="w-3.5 h-3.5" /> Mark read
          </button>
        )}
      </div>
    </motion.div>
  );
}

/* ─── Notification Settings Panel ───────────────────────────────────────── */
function NotificationSettings() {
  const qc = useQueryClient();
  const { data: cfg, isLoading } = useQuery({
    queryKey: ["founder-alert-config"],
    queryFn: () => fetchJSON("/api/founder/alert-config"),
  });

  const [form, setForm] = useState<any>(null);
  const [showPass, setShowPass] = useState(false);
  const initialized = !!form;

  // Sync form from server data once loaded
  if (cfg && !initialized) {
    setForm({
      email_enabled:   cfg.email_enabled  ?? false,
      email_to:        cfg.email_to        ?? "",
      smtp_host:       cfg.smtp_host       ?? "",
      smtp_port:       cfg.smtp_port       ?? 587,
      smtp_user:       cfg.smtp_user       ?? "",
      smtp_pass:       cfg.smtp_pass_hint  ?? "",
      smtp_from:       cfg.smtp_from       ?? "",
      webhook_enabled: cfg.webhook_enabled ?? false,
      webhook_url:     cfg.webhook_url     ?? "",
    });
  }

  const saveMut = useMutation({
    mutationFn: (data: any) => putJSON("/api/founder/alert-config", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["founder-alert-config"] }); toast.success("Alert settings saved"); },
    onError:   () => toast.error("Failed to save settings"),
  });

  const testMut = useMutation({
    mutationFn: () => postJSON("/api/founder/alert-config/test", {}),
    onSuccess: () => toast.success("Test alert sent — check your email/webhook"),
    onError:   () => toast.error("Test failed — check your configuration"),
  });

  const f = form ?? {};
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev: any) => ({ ...prev, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  if (isLoading || !form) {
    return <div className="py-12 text-center text-gray-400">Loading settings…</div>;
  }

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Email */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
              <Mail className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Email Alerts</p>
              <p className="text-xs text-gray-500">Send alerts via SMTP to a configured address</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={f.email_enabled} onChange={set("email_enabled")} className="sr-only peer" />
            <div className="w-10 h-5 bg-gray-200 peer-checked:bg-primary rounded-full transition-colors peer-focus:ring-2 peer-focus:ring-primary/30 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
          </label>
        </div>
        <AnimatePresence>
          {f.email_enabled && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
              <div className="px-5 py-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="SMTP Host" placeholder="smtp.gmail.com" value={f.smtp_host} onChange={set("smtp_host")} />
                  <Field label="SMTP Port" placeholder="587" value={f.smtp_port} onChange={set("smtp_port")} type="number" />
                  <Field label="SMTP Username" placeholder="you@gmail.com" value={f.smtp_user} onChange={set("smtp_user")} />
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-gray-600">SMTP Password</label>
                    <div className="relative">
                      <input
                        type={showPass ? "text" : "password"}
                        value={f.smtp_pass}
                        onChange={set("smtp_pass")}
                        placeholder="App password"
                        className="w-full pr-9 pl-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary/60 bg-white"
                      />
                      <button type="button" onClick={() => setShowPass(s => !s)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <Field label="From Address" placeholder="alerts@aperti.ai" value={f.smtp_from} onChange={set("smtp_from")} />
                  <Field label="Alert Recipient (To)" placeholder="founder@yourcompany.com" value={f.email_to} onChange={set("email_to")} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Webhook */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
              <Webhook className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Webhook Alerts</p>
              <p className="text-xs text-gray-500">POST JSON payload to Slack, Discord, or any endpoint</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={f.webhook_enabled} onChange={set("webhook_enabled")} className="sr-only peer" />
            <div className="w-10 h-5 bg-gray-200 peer-checked:bg-primary rounded-full transition-colors peer-focus:ring-2 peer-focus:ring-primary/30 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
          </label>
        </div>
        <AnimatePresence>
          {f.webhook_enabled && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
              <div className="px-5 py-4">
                <Field
                  label="Webhook URL"
                  placeholder="https://hooks.slack.com/services/… or any POST endpoint"
                  value={f.webhook_url}
                  onChange={set("webhook_url")}
                />
                <p className="text-xs text-gray-400 mt-2">
                  Payload: <code className="bg-gray-100 px-1 rounded text-[11px]">{"{ source, event, severity, message, meta, timestamp }"}</code>
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Triggers info */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Alert triggers</p>
        <div className="space-y-1.5">
          {[
            { icon: AlertCircle, color: "text-rose-600", label: "Critical launch blocker created (real-time)" },
            { icon: AlertTriangle, color: "text-amber-600", label: "New problem report submitted (real-time)" },
            { icon: CreditCard, color: "text-orange-500", label: "Payment failures (5-min background worker)" },
            { icon: Zap, color: "text-purple-500", label: "AI token cost spike (5-min background worker)" },
            { icon: Activity, color: "text-blue-500", label: "System health warnings (5-min background worker)" },
          ].map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <t.icon className={`w-3.5 h-3.5 ${t.color}`} />
              <span className="text-xs text-gray-600">{t.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => saveMut.mutate(f)}
          disabled={saveMut.isPending}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/80 transition-colors disabled:opacity-50"
        >
          {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Settings
        </button>
        <button
          onClick={() => testMut.mutate()}
          disabled={testMut.isPending || (!f.email_enabled && !f.webhook_enabled)}
          className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-40 text-gray-700"
          title={!f.email_enabled && !f.webhook_enabled ? "Enable at least one channel first" : undefined}
        >
          {testMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Send Test Alert
        </button>
      </div>
    </div>
  );
}

function Field({ label, placeholder, value, onChange, type = "text" }: any) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-600">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-primary/60 bg-white"
      />
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */
export default function FounderAlertsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"feed" | "settings">("feed");

  const { data, isLoading } = useQuery({
    queryKey: ["founder-alerts"],
    queryFn: () => fetchJSON("/api/founder/alerts"),
    refetchInterval: 30000,
  });

  const readMut = useMutation({
    mutationFn: (id: number) => putJSON(`/api/founder/alerts/${id}/read`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["founder-alerts"] }),
  });

  const readAllMut = useMutation({
    mutationFn: () => putJSON("/api/founder/alerts/read-all", {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["founder-alerts"] }),
  });

  const alerts  = data?.alerts ?? [];
  const unread  = alerts.filter((a: any) => !a.is_read);
  const critical = alerts.filter((a: any) => a.severity === "critical" && !a.is_read);
  const warnings = alerts.filter((a: any) => a.severity === "warning"  && !a.is_read);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Founder Alerts</h1>
          <p className="text-sm text-gray-500 mt-0.5">Real-time platform alerts — payments, outages, cost spikes, blockers & reports</p>
        </div>
        <div className="flex items-center gap-2">
          {tab === "feed" && unread.length > 0 && (
            <button onClick={() => readAllMut.mutate()} disabled={readAllMut.isPending}
              className="flex items-center gap-2 border border-gray-200 text-gray-600 px-3 py-2 rounded-xl text-sm hover:bg-gray-50 transition-colors">
              <CheckCheck className="w-4 h-4" /> Mark all read
            </button>
          )}
          {/* Tab switcher */}
          <div className="flex bg-gray-100 rounded-xl p-1">
            <button onClick={() => setTab("feed")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === "feed" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
              <Bell className="w-3.5 h-3.5" /> Feed
              {unread.length > 0 && <span className="bg-red-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center">{unread.length > 9 ? "9+" : unread.length}</span>}
            </button>
            <button onClick={() => setTab("settings")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === "settings" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
              <Settings className="w-3.5 h-3.5" /> Notification Settings
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {tab === "feed" ? (
          <motion.div key="feed" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-rose-50 rounded-xl border border-rose-100 p-4">
                <p className="text-2xl font-bold text-rose-700">{critical.length}</p>
                <p className="text-xs text-rose-600 mt-0.5">Critical unread</p>
              </div>
              <div className="bg-amber-50 rounded-xl border border-amber-100 p-4">
                <p className="text-2xl font-bold text-amber-700">{warnings.length}</p>
                <p className="text-xs text-amber-600 mt-0.5">Warnings unread</p>
              </div>
              <div className="bg-blue-50 rounded-xl border border-blue-100 p-4">
                <p className="text-2xl font-bold text-blue-700">{alerts.length}</p>
                <p className="text-xs text-blue-600 mt-0.5">Total alerts (50 most recent)</p>
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 animate-pulse h-20" />
                ))}
              </div>
            ) : alerts.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                <Circle className="w-10 h-10 text-green-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">All clear — no alerts</p>
                <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">
                  The background worker checks every 5 min. Critical launch blockers and problem reports fire instantly.
                </p>
                <button onClick={() => setTab("settings")}
                  className="mt-4 inline-flex items-center gap-1 text-sm text-primary font-medium hover:underline">
                  Configure notifications <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {unread.length > 0 && (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Unread ({unread.length})</h3>
                      <div className="space-y-3">
                        {unread.map((a: any) => <AlertCard key={a.id} alert={a} onRead={() => readMut.mutate(a.id)} />)}
                      </div>
                    </div>
                  )}
                  {alerts.filter((a: any) => a.is_read).length > 0 && (
                    <div className="mt-4">
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Read</h3>
                      <div className="space-y-3">
                        {alerts.filter((a: any) => a.is_read).map((a: any) => <AlertCard key={a.id} alert={a} onRead={() => {}} />)}
                      </div>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="settings" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <NotificationSettings />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
