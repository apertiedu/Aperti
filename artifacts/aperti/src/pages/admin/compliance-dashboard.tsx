import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { motion } from "framer-motion";
import {
  Shield, Trash2, Download, Clock, CheckCircle2, XCircle, AlertTriangle,
  RefreshCw, Database, FileText, Users, BarChart3, Eye,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";

const POLICY_VERSION = "v2026.06";

type ComplianceRequest = {
  id: number;
  userId: number;
  type: string;
  status: "pending" | "in_review" | "completed" | "rejected";
  requestedAt: string;
  completedAt: string | null;
  notes: string | null;
  username: string | null;
  displayName: string | null;
  email: string | null;
};

type ConsentStat = {
  consent_type: string;
  granted_count: string;
  denied_count: string;
  last_recorded: string;
};

type BackupLog = {
  id: number;
  type: string;
  status: string;
  fileUrl: string | null;
  createdAt: string;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  pending:   { label: "Pending",   color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",   icon: Clock },
  in_review: { label: "In Review", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",       icon: Eye },
  completed: { label: "Completed", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: CheckCircle2 },
  rejected:  { label: "Rejected",  color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",            icon: XCircle },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.color}`}>
      <Icon className="h-3 w-3" /> {cfg.label}
    </span>
  );
}

export default function ComplianceDashboard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"requests" | "consent" | "backups" | "checklist">("requests");
  const [selectedRequest, setSelectedRequest] = useState<ComplianceRequest | null>(null);
  const [noteText, setNoteText] = useState("");

  const requestsQ = useQuery<ComplianceRequest[]>({
    queryKey: ["admin-compliance-requests"],
    queryFn: () => apiFetch("/api/admin/compliance/requests").then(r => r.json()),
    refetchInterval: 30000,
  });

  const consentQ = useQuery<{ stats: ConsentStat[]; recent: any[]; policy_version: string }>({
    queryKey: ["admin-compliance-consent"],
    queryFn: () => apiFetch("/api/admin/compliance/consent-stats").then(r => r.json()),
    enabled: activeTab === "consent",
  });

  const backupsQ = useQuery<BackupLog[]>({
    queryKey: ["admin-compliance-backups"],
    queryFn: () => apiFetch("/api/admin/compliance/backups").then(r => r.json()),
    enabled: activeTab === "backups",
  });

  const updateRequest = useMutation({
    mutationFn: ({ id, status, notes }: { id: number; status: string; notes?: string }) =>
      apiFetch(`/api/admin/compliance/requests/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes }),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-compliance-requests"] });
      setSelectedRequest(null);
      setNoteText("");
      toast({ title: "Request updated" });
    },
  });

  const triggerBackup = useMutation({
    mutationFn: () => apiFetch("/api/admin/compliance/backups", { method: "POST" }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-compliance-backups"] });
      toast({ title: "Backup triggered", description: "Backup will complete in ~30 seconds." });
    },
  });

  const requests = requestsQ.data ?? [];
  const pending = requests.filter(r => r.status === "pending");
  const inReview = requests.filter(r => r.status === "in_review");
  const completed = requests.filter(r => r.status === "completed");

  const CHECKLIST = [
    { id: "privacy_policy",     label: "Privacy Policy published at /privacy",        done: true  },
    { id: "terms",              label: "Terms of Service published at /terms",          done: true  },
    { id: "data_retention",     label: "Data Retention Policy published at /data-retention", done: true },
    { id: "legal_contact",      label: "Legal/DPO contact page at /legal",             done: true  },
    { id: "trust_center",       label: "Trust Center published at /trust",             done: true  },
    { id: "consent_banner",     label: "Consent banner shown to new visitors",         done: true  },
    { id: "consent_recording",  label: "Consent records stored in database",           done: true  },
    { id: "data_export",        label: "Self-service data export (Settings)",          done: true  },
    { id: "deletion_workflow",  label: "Account deletion request workflow (Settings)", done: true  },
    { id: "deletion_admin",     label: "Admin can review and action deletion requests",done: true  },
    { id: "policy_versioning",  label: "Policy version displayed on all legal pages",  done: true  },
    { id: "footer_links",       label: "Footer links to all legal pages",              done: true  },
    { id: "dpo_email",          label: "DPO email address configured (privacy@aperti.ai)", done: true },
    { id: "retention_schedule", label: "Automated retention review scheduled (monthly)", done: false },
    { id: "dpa_registration",   label: "Registered with Egyptian PDPC if required",   done: false },
    { id: "dpia",               label: "Data Protection Impact Assessment (DPIA) completed", done: false },
    { id: "legal_review",       label: "Policies reviewed by qualified Egyptian attorney", done: false },
  ];

  const TABS = [
    { id: "requests",  label: "Requests", icon: FileText,  count: pending.length || undefined },
    { id: "consent",   label: "Consent",  icon: Shield,    count: undefined },
    { id: "backups",   label: "Backups",  icon: Database,  count: undefined },
    { id: "checklist", label: "Checklist",icon: CheckCircle2, count: undefined },
  ] as const;

  const stagger = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
  const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="page-transition space-y-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Compliance Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            GDPR-ready compliance management — Policy {POLICY_VERSION}
          </p>
        </div>
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
          {POLICY_VERSION}
        </span>
      </div>

      {/* KPI Strip */}
      <motion.div variants={stagger} initial="hidden" animate="show"
        className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: Clock,        label: "Pending",   value: pending.length,   color: "text-amber-600"   },
          { icon: Eye,          label: "In Review", value: inReview.length,  color: "text-blue-600"    },
          { icon: CheckCircle2, label: "Completed", value: completed.length, color: "text-emerald-600" },
          { icon: Users,        label: "Total",     value: requests.length,  color: "text-foreground"  },
        ].map(({ icon: Icon, label, value, color }) => (
          <motion.div key={label} variants={fadeUp}
            className="bg-card border border-border rounded-xl p-4 shadow-sm">
            <Icon className={`h-4 w-4 mb-2 ${color}`} />
            <p className="text-2xl font-bold text-foreground">{requestsQ.isLoading ? "—" : value}</p>
            <p className="text-xs text-muted-foreground">{label} requests</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/40 p-1 rounded-xl w-fit">
        {TABS.map(({ id, label, icon: Icon, count }) => (
          <button key={id} onClick={() => setActiveTab(id as typeof activeTab)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}>
            <Icon className="h-3.5 w-3.5" />
            {label}
            {count !== undefined && count > 0 && (
              <span className="text-[10px] font-bold bg-primary text-white px-1.5 py-0.5 rounded-full ml-1">
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Requests Tab */}
      {activeTab === "requests" && (
        <div className="space-y-4">
          {pending.length > 0 && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span className="font-medium">{pending.length} pending request{pending.length > 1 ? "s" : ""} require attention.</span>
            </div>
          )}

          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            {requestsQ.isLoading ? (
              <div className="py-16 text-center text-muted-foreground text-sm">Loading…</div>
            ) : requests.length === 0 ? (
              <div className="py-16 text-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
                <p className="text-sm font-semibold text-foreground">No compliance requests</p>
                <p className="text-xs text-muted-foreground mt-1">All clear — no pending actions.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {requests.map(req => (
                  <div key={req.id} className="px-5 py-4 flex items-start gap-4 hover:bg-muted/20 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">
                          {req.displayName || req.username || `User #${req.userId}`}
                        </span>
                        <Badge variant="outline" className="text-[10px]">{req.type}</Badge>
                        <StatusBadge status={req.status} />
                      </div>
                      <p className="text-xs text-muted-foreground">{req.email || "No email"}</p>
                      {req.notes && <p className="text-xs text-muted-foreground mt-1 italic">"{req.notes}"</p>}
                      <p className="text-[10px] text-muted-foreground mt-1.5">
                        Submitted: {req.requestedAt ? format(parseISO(req.requestedAt), "dd MMM yyyy, HH:mm") : "—"}
                        {req.completedAt && ` · Completed: ${format(parseISO(req.completedAt), "dd MMM yyyy")}`}
                      </p>
                    </div>
                    {req.status !== "completed" && req.status !== "rejected" && (
                      <div className="flex gap-2 flex-shrink-0">
                        <Button size="sm" variant="outline"
                          onClick={() => { setSelectedRequest(req); setNoteText(req.notes ?? ""); }}>
                          Review
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {selectedRequest && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
              <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-foreground">Review Request #{selectedRequest.id}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {selectedRequest.displayName} · {selectedRequest.type}
                    </p>
                  </div>
                  <StatusBadge status={selectedRequest.status} />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
                    Internal note
                  </label>
                  <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background resize-none outline-none focus:border-primary/60"
                    rows={3} placeholder="Add a note about the action taken…" />
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline"
                    onClick={() => updateRequest.mutate({ id: selectedRequest.id, status: "in_review", notes: noteText })}>
                    Mark In Review
                  </Button>
                  <Button size="sm"
                    onClick={() => updateRequest.mutate({ id: selectedRequest.id, status: "completed", notes: noteText })}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    Mark Completed
                  </Button>
                  <Button size="sm" variant="destructive"
                    onClick={() => updateRequest.mutate({ id: selectedRequest.id, status: "rejected", notes: noteText })}>
                    Reject
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedRequest(null)}>Cancel</Button>
                </div>
              </motion.div>
            </div>
          )}
        </div>
      )}

      {/* Consent Tab */}
      {activeTab === "consent" && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-sm text-foreground">Consent Statistics</h3>
              <span className="text-xs text-muted-foreground">{consentQ.data?.policy_version ?? POLICY_VERSION}</span>
            </div>
            {consentQ.isLoading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
            ) : (
              <div className="divide-y divide-border">
                {(consentQ.data?.stats ?? []).map(stat => {
                  const total = parseInt(stat.granted_count) + parseInt(stat.denied_count);
                  const rate = total > 0 ? Math.round((parseInt(stat.granted_count) / total) * 100) : 0;
                  return (
                    <div key={stat.consent_type} className="px-5 py-4 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground capitalize">
                          {stat.consent_type.replace("_", " ")}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {stat.granted_count} granted · {stat.denied_count} denied
                        </p>
                        <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all duration-700"
                            style={{ width: `${rate}%` }} />
                        </div>
                      </div>
                      <span className="text-lg font-bold text-foreground flex-shrink-0">{rate}%</span>
                    </div>
                  );
                })}
                {(consentQ.data?.stats ?? []).length === 0 && (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    No consent records yet. Records appear when visitors interact with the consent banner.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Backups Tab */}
      {activeTab === "backups" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => triggerBackup.mutate()} disabled={triggerBackup.isPending}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${triggerBackup.isPending ? "animate-spin" : ""}`} />
              Trigger Manual Backup
            </Button>
          </div>
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            {backupsQ.isLoading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
            ) : (
              <div className="divide-y divide-border">
                {(backupsQ.data ?? []).map(b => (
                  <div key={b.id} className="px-5 py-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-foreground capitalize">{b.type} backup</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {b.createdAt ? format(parseISO(b.createdAt), "dd MMM yyyy HH:mm") : "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={b.status} />
                      {b.fileUrl && (
                        <a href={b.fileUrl} className="text-xs text-primary underline hover:opacity-80">Download</a>
                      )}
                    </div>
                  </div>
                ))}
                {(backupsQ.data ?? []).length === 0 && (
                  <div className="py-12 text-center text-sm text-muted-foreground">No backups yet.</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Checklist Tab */}
      {activeTab === "checklist" && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-sm text-foreground">Compliance Checklist</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {CHECKLIST.filter(i => i.done).length} of {CHECKLIST.length} items complete
              </p>
              <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-700"
                  style={{ width: `${Math.round((CHECKLIST.filter(i => i.done).length / CHECKLIST.length) * 100)}%` }} />
              </div>
            </div>
            <div className="divide-y divide-border">
              {CHECKLIST.map(item => (
                <div key={item.id} className="px-5 py-3.5 flex items-center gap-3">
                  {item.done ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  )}
                  <span className={`text-sm ${item.done ? "text-foreground" : "text-muted-foreground"}`}>
                    {item.label}
                  </span>
                  {!item.done && (
                    <span className="ml-auto text-[10px] font-bold text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full flex-shrink-0">
                      Action required
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
            <p className="text-xs text-amber-800 dark:text-amber-400 font-medium mb-1">Outstanding Legal Review Items</p>
            <ul className="space-y-1">
              {CHECKLIST.filter(i => !i.done).map(item => (
                <li key={item.id} className="text-xs text-amber-700 dark:text-amber-500 flex items-start gap-1.5">
                  <span className="mt-0.5">•</span> {item.label}
                </li>
              ))}
            </ul>
            <p className="text-xs text-amber-700 dark:text-amber-500 mt-3">
              These items should be addressed before accepting payments or processing data from EU/UK residents.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
