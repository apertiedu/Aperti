import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Award, Plus, CheckCircle2, XCircle, Copy, ExternalLink,
  Search, Shield, Eye,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TEMPLATES = [
  { id: "completion",  label: "Completion",  gradient: "from-teal-400 to-emerald-500" },
  { id: "excellence",  label: "Excellence",  gradient: "from-amber-400 to-yellow-500" },
  { id: "merit",       label: "Merit",       gradient: "from-violet-500 to-purple-600" },
  { id: "distinction", label: "Distinction", gradient: "from-pink-500 to-rose-600" },
  { id: "participation", label: "Participation", gradient: "from-sky-400 to-blue-500" },
];

export default function AdminCertificates() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [showIssue, setShowIssue] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);
  const [form, setForm] = useState({ student_id: "", title: "", description: "", template: "completion" });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-certs"],
    queryFn: async () => {
      const res = await apiFetch("/api/certificates");
      return (await res.json()).certificates ?? [];
    },
  });

  const issueMut = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/certificates/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: parseInt(form.student_id),
          title: form.title, description: form.description,
          template: { type: form.template, gradient: TEMPLATES.find(t => t.id === form.template)?.gradient },
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-certs"] });
      setShowIssue(false);
      setForm({ student_id: "", title: "", description: "", template: "completion" });
      toast({ title: "Certificate issued" });
    },
    onError: (err: any) => toast({ title: err.message ?? "Failed", variant: "destructive" }),
  });

  const revokeMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/certificates/${id}/revoke`, { method: "PUT" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-certs"] }); toast({ title: "Revoked" }); },
  });

  const handleVerify = async () => {
    if (!verifyCode.trim()) return;
    setVerifying(true); setVerifyResult(null);
    try {
      const res = await apiFetch(`/api/certificates/verify/${verifyCode.trim()}`);
      setVerifyResult(await res.json());
    } catch { setVerifyResult({ valid: false, error: "Verification failed" }); }
    finally { setVerifying(false); }
  };

  const certs = (data ?? []).filter((c: any) =>
    !search || c.title?.toLowerCase().includes(search.toLowerCase()) || c.student_name?.toLowerCase().includes(search.toLowerCase())
  );
  const activeCount = (data ?? []).filter((c: any) => c.status === "active").length;

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {showIssue && (
          <motion.div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) setShowIssue(false); }}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
              <h3 className="font-bold text-lg flex items-center gap-2"><Award className="w-5 h-5 text-primary" />Issue Certificate</h3>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Student ID *</label>
                <Input placeholder="Numeric student ID" value={form.student_id} onChange={e => setForm(f => ({ ...f, student_id: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Title *</label>
                <Input placeholder="e.g. IGCSE Biology Distinction Award" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Template</label>
                <div className="grid grid-cols-3 gap-2">
                  {TEMPLATES.map(t => (
                    <button key={t.id} onClick={() => setForm(f => ({ ...f, template: t.id }))}
                      className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all ${form.template === t.id ? "border-primary" : "border-border"}`}>
                      <div className={`w-full h-6 rounded bg-gradient-to-r ${t.gradient}`} />
                      <span className="text-[10px] font-medium">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Description</label>
                <textarea className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none h-16 outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Additional notes…" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowIssue(false)}>Cancel</Button>
                <Button className="flex-1" onClick={() => issueMut.mutate()} disabled={!form.student_id || !form.title.trim() || issueMut.isPending}>
                  {issueMut.isPending ? "Issuing…" : "Issue Certificate"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Award className="w-6 h-6 text-primary" />Certificate Admin</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Issue, manage, and verify all certificates.</p>
        </div>
        <Button className="gap-2" onClick={() => setShowIssue(true)}><Plus className="w-4 h-4" />Issue Certificate</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Issued", value: data?.length ?? 0, color: "text-primary" },
          { label: "Active", value: activeCount, color: "text-emerald-500" },
          { label: "Revoked", value: (data?.length ?? 0) - activeCount, color: "text-red-400" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-3">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Verify */}
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-sm font-semibold mb-2 flex items-center gap-2"><Shield className="w-4 h-4 text-primary" />Verify Certificate</p>
        <div className="flex gap-2">
          <Input placeholder="APT-XXXX-YYYY" className="font-mono text-sm"
            value={verifyCode} onChange={e => setVerifyCode(e.target.value)} onKeyDown={e => e.key === "Enter" && handleVerify()} />
          <Button variant="outline" onClick={handleVerify} disabled={verifying}>{verifying ? "Checking…" : "Verify"}</Button>
        </div>
        {verifyResult && (
          <div className={`mt-3 rounded-lg px-4 py-3 text-sm ${verifyResult.valid ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-700" : "bg-red-500/10 border border-red-500/20 text-red-600"}`}>
            {verifyResult.valid
              ? <><CheckCircle2 className="w-4 h-4 inline mr-1" /><strong>{verifyResult.certificate?.title}</strong> — issued to {verifyResult.certificate?.student_name}</>
              : <><XCircle className="w-4 h-4 inline mr-1" />{verifyResult.error ?? "Invalid"}</>}
          </div>
        )}
      </div>

      {/* List */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Search certificates…" className="pl-8 h-9 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted/40 rounded-xl animate-pulse" />)}</div>
      ) : certs.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-2xl">
          <Award className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">No certificates issued yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {certs.map((c: any) => (
            <div key={c.id} className={`bg-card border rounded-xl p-4 flex items-center gap-4 ${c.status === "revoked" ? "opacity-60 border-border/40" : "border-border"}`}>
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${TEMPLATES.find(t => t.id === c.template?.type)?.gradient ?? "from-teal-400 to-emerald-500"} flex items-center justify-center shrink-0`}>
                <Award className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{c.title}</p>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                  <span>{c.student_name}</span><span>·</span>
                  <span className="font-mono">{c.unique_code}</span><span>·</span>
                  <span>{new Date(c.issued_at).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge className={c.status === "active" ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}>{c.status}</Badge>
                <button onClick={() => { navigator.clipboard.writeText(c.verification_url); toast({ title: "Link copied" }); }}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted">
                  <Copy className="w-3.5 h-3.5" />
                </button>
                {c.status === "active" && (
                  <button onClick={() => revokeMut.mutate(c.id)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10">
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
