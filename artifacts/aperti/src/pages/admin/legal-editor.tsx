/**
 * Legal Content Editor — Phase 4 Compliance & Trust Layer
 * Admin CMS for versioned legal policy content.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { motion } from "framer-motion";
import {
  FileText, Plus, History, CheckCircle2, Clock, AlertTriangle,
  ChevronDown, Save, Eye, GitBranch, RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";

const POLICY_TYPES = [
  { key: "privacy_policy",    label: "Privacy Policy",     path: "/privacy" },
  { key: "terms_of_service",  label: "Terms of Service",   path: "/terms" },
  { key: "data_retention",    label: "Data Retention",     path: "/data-retention" },
  { key: "cookie_policy",     label: "Cookie Policy",      path: "/privacy#cookies" },
] as const;

type PolicyVersion = {
  id: number;
  policy_type: string;
  version: string;
  content: string;
  summary: string;
  effective_date: string;
  is_active: boolean;
  requires_reconsent: boolean;
  created_at: string;
  created_by_name?: string;
};

type ActivePolicy = {
  id: number;
  policy_type: string;
  version: string;
  summary: string;
  effective_date: string;
  is_active: boolean;
};

function PolicyTypeTab({ type, active, onClick }: { type: typeof POLICY_TYPES[number]; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
      }`}
    >
      <FileText className="h-3.5 w-3.5" />
      {type.label}
    </button>
  );
}

function VersionHistory({ policyType }: { policyType: string }) {
  const { data: history = [], isLoading } = useQuery<PolicyVersion[]>({
    queryKey: ["legal-history", policyType],
    queryFn: () => apiFetch(`/api/admin/legal/policies/${policyType}/history`).then(r => r.json()),
    staleTime: 30_000,
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const activateMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/admin/legal/policies/${id}/activate`, { method: "PUT" }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legal-history", policyType] });
      queryClient.invalidateQueries({ queryKey: ["legal-active"] });
      toast({ title: "Policy version activated" });
    },
    onError: () => toast({ title: "Failed to activate", variant: "destructive" }),
  });

  if (isLoading) return <div className="py-4 text-sm text-muted-foreground flex items-center gap-2"><RefreshCw className="h-4 w-4 animate-spin" />Loading…</div>;

  return (
    <div className="space-y-2">
      {history.map(v => (
        <div key={v.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border bg-muted/30">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-semibold">{v.version}</span>
              {v.is_active && <Badge className="text-[10px] py-0 bg-emerald-500 text-white">Active</Badge>}
              {v.requires_reconsent && <Badge variant="outline" className="text-[10px] py-0 text-amber-600 border-amber-300">Re-consent required</Badge>}
            </div>
            <p className="text-xs text-muted-foreground truncate">{v.summary || "No summary"}</p>
            <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
              <span>Effective: {format(parseISO(v.effective_date), "dd MMM yyyy")}</span>
              <span>Created: {format(parseISO(v.created_at), "dd MMM yyyy HH:mm")}</span>
              {v.created_by_name && <span>By: {v.created_by_name}</span>}
            </div>
          </div>
          {!v.is_active && (
            <Button size="sm" variant="outline" className="text-xs flex-shrink-0"
              onClick={() => activateMutation.mutate(v.id)}
              disabled={activateMutation.isPending}>
              <CheckCircle2 className="h-3 w-3 mr-1" /> Activate
            </Button>
          )}
        </div>
      ))}
      {!history.length && (
        <p className="text-sm text-muted-foreground py-4 text-center">No version history yet.</p>
      )}
    </div>
  );
}

function NewVersionForm({ policyType, onDone }: { policyType: string; onDone: () => void }) {
  const [form, setForm] = useState({
    version: `v${new Date().getFullYear()}.${String(new Date().getMonth() + 1).padStart(2, "0")}`,
    content: "",
    summary: "",
    effective_date: new Date().toISOString().split("T")[0],
    requires_reconsent: false,
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/admin/legal/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, policy_type: policyType }),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legal-history", policyType] });
      toast({ title: "Policy version created", description: "Activate it when ready to publish." });
      onDone();
    },
    onError: () => toast({ title: "Failed to create version", variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">Version label</label>
          <input
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
            value={form.version}
            onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
            placeholder="v2026.07"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-foreground block mb-1">Effective date</label>
          <input
            type="date"
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
            value={form.effective_date}
            onChange={e => setForm(f => ({ ...f, effective_date: e.target.value }))}
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-foreground block mb-1">Change summary (shown to users)</label>
        <input
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
          value={form.summary}
          onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
          placeholder="Updated data processor list; added GDPR lawful basis table"
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-foreground block mb-1">
          Policy content
          <span className="text-muted-foreground font-normal ml-1">(Markdown or plain text — note: main rendered pages are in /src/pages/*.tsx)</span>
        </label>
        <Textarea
          rows={8}
          className="font-mono text-xs resize-y"
          value={form.content}
          onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
          placeholder="Enter policy content or paste from template…"
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="reconsent"
          checked={form.requires_reconsent}
          onChange={e => setForm(f => ({ ...f, requires_reconsent: e.target.checked }))}
          className="rounded"
        />
        <label htmlFor="reconsent" className="text-xs text-muted-foreground">
          Material change — require users to re-consent on next login
        </label>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onDone}>Cancel</Button>
        <Button
          disabled={!form.version || !form.content || !form.effective_date || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          <Save className="h-4 w-4 mr-2" />
          {createMutation.isPending ? "Creating…" : "Create draft version"}
        </Button>
      </div>
    </div>
  );
}

export default function LegalEditorPage() {
  const [activeType, setActiveType] = useState<string>("privacy_policy");
  const [showHistory, setShowHistory] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);

  const { data: activePolicies = [] } = useQuery<ActivePolicy[]>({
    queryKey: ["legal-active"],
    queryFn: () => apiFetch("/api/legal/policies").then(r => r.json()),
    staleTime: 60_000,
  });

  const { data: overview } = useQuery({
    queryKey: ["compliance-overview"],
    queryFn: () => apiFetch("/api/admin/legal/compliance-overview").then(r => r.json()),
    staleTime: 60_000,
  });

  const activeForType = activePolicies.find(p => p.policy_type === activeType);
  const currentTypeDef = POLICY_TYPES.find(t => t.key === activeType)!;

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <FileText className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-extrabold tracking-tight">Legal Content Editor</h1>
        </div>
        <p className="text-sm text-muted-foreground">Manage versioned legal policies with full audit trail.</p>
      </motion.div>

      {/* Stats row */}
      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Active policies", value: overview.policy_versions?.active ?? "–", icon: CheckCircle2, color: "text-emerald-500" },
            { label: "Total versions", value: overview.policy_versions?.total ?? "–", icon: GitBranch, color: "text-primary" },
            { label: "Pending requests", value: overview.request_breakdown?.find((r: any) => r.status === "pending")?.count ?? "0", icon: Clock, color: "text-amber-500" },
            { label: "Consent types tracked", value: overview.consent_summary?.length ?? "–", icon: Eye, color: "text-blue-500" },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`h-4 w-4 ${color}`} />
                <span className="text-[11px] text-muted-foreground">{label}</span>
              </div>
              <p className="text-2xl font-bold">{value}</p>
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-6">
        {/* Policy type tabs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" /> Policy documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-5">
              {POLICY_TYPES.map(t => (
                <PolicyTypeTab key={t.key} type={t} active={activeType === t.key}
                  onClick={() => { setActiveType(t.key); setShowHistory(false); setShowNewForm(false); }} />
              ))}
            </div>

            {/* Active version info */}
            {activeForType ? (
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 mb-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                        Active version: {activeForType.version}
                      </span>
                    </div>
                    <p className="text-xs text-emerald-700 dark:text-emerald-400">
                      Effective: {format(parseISO(activeForType.effective_date), "dd MMM yyyy")}
                      {activeForType.summary && ` · ${activeForType.summary}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <a href={currentTypeDef.path} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="text-xs">
                        <Eye className="h-3 w-3 mr-1" /> Preview
                      </Button>
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-4 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">No active version for this policy type. Create and activate one below.</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2 mb-4">
              <Button size="sm" variant="outline" onClick={() => { setShowHistory(h => !h); setShowNewForm(false); }}>
                <History className="h-3.5 w-3.5 mr-1.5" />
                <ChevronDown className={`h-3 w-3 mr-1 transition-transform ${showHistory ? "rotate-180" : ""}`} />
                Version history
              </Button>
              <Button size="sm" onClick={() => { setShowNewForm(f => !f); setShowHistory(false); }}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                New version
              </Button>
            </div>

            {showHistory && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                <VersionHistory policyType={activeType} />
              </motion.div>
            )}

            {showNewForm && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="border-t border-border pt-4 mt-4">
                <h3 className="text-sm font-bold mb-4">Create new draft version — {currentTypeDef.label}</h3>
                <NewVersionForm policyType={activeType} onDone={() => setShowNewForm(false)} />
              </motion.div>
            )}
          </CardContent>
        </Card>

        {/* Compliance overview */}
        {overview?.request_breakdown?.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> Compliance request breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {overview.request_breakdown.map((r: any) => (
                  <div key={r.status} className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg text-xs">
                    <span className="font-semibold capitalize">{r.status}</span>
                    <Badge variant="secondary">{r.count}</Badge>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <a href="/admin/compliance" className="text-xs text-primary underline hover:opacity-80">
                  View full compliance dashboard →
                </a>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
