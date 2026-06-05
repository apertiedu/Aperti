import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Award, Plus, CheckCircle2, XCircle, Copy, ExternalLink,
  Search, Users, FileText, Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Certificate {
  id: number;
  student_id: number;
  student_name: string;
  title: string;
  description: string | null;
  issued_at: string;
  unique_code: string;
  verification_url: string;
  status: "active" | "revoked";
  issued_by_name: string;
}

const TEMPLATE_OPTIONS = [
  { id: "completion",  label: "Course Completion", color: "from-teal-500 to-emerald-500" },
  { id: "excellence",  label: "Academic Excellence", color: "from-amber-400 to-yellow-500" },
  { id: "merit",       label: "Merit Award",        color: "from-violet-500 to-indigo-500" },
  { id: "distinction", label: "Distinction",        color: "from-pink-500 to-rose-500" },
];

function CertificateCard({ cert, onRevoke, onCopy }: { cert: Certificate; onRevoke: () => void; onCopy: () => void }) {
  const isActive = cert.status === "active";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-card border rounded-xl p-4 space-y-3 transition-colors ${isActive ? "border-border hover:border-primary/30" : "border-border/40 opacity-60"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm">{cert.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{cert.student_name}</p>
            {cert.description && <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-1">{cert.description}</p>}
          </div>
        </div>
        <Badge className={isActive ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}>
          {isActive ? "Active" : "Revoked"}
        </Badge>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span>Issued {new Date(cert.issued_at).toLocaleDateString()}</span>
        <span>·</span>
        <span className="font-mono">{cert.unique_code}</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onCopy}
          className="flex items-center gap-1.5 text-[11px] text-primary hover:underline"
        >
          <Copy className="w-3 h-3" /> Copy verification link
        </button>
        {isActive && (
          <>
            <span className="text-border">|</span>
            <a
              href={cert.verification_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary"
            >
              <ExternalLink className="w-3 h-3" /> View
            </a>
            <span className="text-border">|</span>
            <button
              onClick={onRevoke}
              className="text-[11px] text-red-500 hover:underline"
            >
              Revoke
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}

export default function Certifications() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [showIssue, setShowIssue] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);
  const [form, setForm] = useState({
    student_account_id: "",
    title: "",
    description: "",
    template: "completion",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["certificates"],
    queryFn: async () => {
      const res = await apiFetch("/api/certificates");
      return (await res.json()).certificates as Certificate[];
    },
  });

  const issueMut = useMutation({
    mutationFn: async () => {
      // First find student by account search
      const stuRes = await apiFetch(`/api/students?q=${encodeURIComponent(form.student_account_id)}&limit=1`).catch(() => null);
      let studentId: number | null = null;
      if (stuRes?.ok) {
        const stuData = await stuRes.json();
        studentId = stuData.students?.[0]?.id ?? null;
      }

      const res = await apiFetch("/api/certificates/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId ?? parseInt(form.student_account_id),
          title: form.title,
          description: form.description,
          template: { type: form.template },
        }),
      });
      if (!res.ok) throw new Error("Failed to issue");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["certificates"] });
      setShowIssue(false);
      setForm({ student_account_id: "", title: "", description: "", template: "completion" });
      toast({ title: "Certificate issued successfully" });
    },
    onError: (err: any) => toast({ title: "Failed to issue certificate", description: err.message, variant: "destructive" }),
  });

  const revokeMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/certificates/${id}/revoke`, { method: "PUT" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["certificates"] }); toast({ title: "Certificate revoked" }); },
  });

  const handleVerify = async () => {
    if (!verifyCode.trim()) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await apiFetch(`/api/certificates/verify/${verifyCode.trim()}`);
      setVerifyResult(await res.json());
    } catch { setVerifyResult({ valid: false, error: "Verification failed" }); }
    finally { setVerifying(false); }
  };

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({ title: "Verification link copied" });
  };

  const certs = (data ?? []).filter(c => !search || c.title.toLowerCase().includes(search.toLowerCase()) || c.student_name?.toLowerCase().includes(search.toLowerCase()));
  const activeCount = certs.filter(c => c.status === "active").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Award className="w-6 h-6 text-primary" />
            Certifications
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Issue, manage, and verify student certificates.</p>
        </div>
        <Button className="gap-2" onClick={() => setShowIssue(true)}>
          <Plus className="w-4 h-4" /> Issue Certificate
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Issued",  value: data?.length ?? 0,   icon: <Award className="w-4 h-4" />,  color: "text-primary" },
          { label: "Active",        value: activeCount,           icon: <CheckCircle2 className="w-4 h-4" />, color: "text-emerald-500" },
          { label: "Revoked",       value: (data?.length ?? 0) - activeCount, icon: <XCircle className="w-4 h-4" />, color: "text-red-400" },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">{s.icon}<span className="text-xs">{s.label}</span></div>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Verify strip */}
      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-sm font-semibold mb-2 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-primary" /> Verify a Certificate
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="Enter certificate code (e.g. APT-ABCD1234-XXXXX)"
            className="font-mono text-sm"
            value={verifyCode}
            onChange={e => setVerifyCode(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleVerify()}
          />
          <Button variant="outline" onClick={handleVerify} disabled={verifying}>
            {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify"}
          </Button>
        </div>
        <AnimatePresence>
          {verifyResult && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className={`mt-3 rounded-lg px-4 py-3 text-sm ${verifyResult.valid ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-700" : "bg-red-500/10 border border-red-500/20 text-red-600"}`}
            >
              {verifyResult.valid ? (
                <>
                  <p className="font-semibold flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Valid Certificate</p>
                  <p className="text-xs mt-1">{verifyResult.certificate?.title} — Issued to {verifyResult.certificate?.student_name} on {new Date(verifyResult.certificate?.issued_at).toLocaleDateString()}</p>
                </>
              ) : (
                <p className="font-semibold flex items-center gap-2"><XCircle className="w-4 h-4" /> {verifyResult.error ?? "Certificate not found or revoked"}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Certificate List */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Search by student or certificate title…" className="pl-8 h-9 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-muted/40 rounded-xl animate-pulse" />)}</div>
        ) : certs.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-border rounded-2xl">
            <Award className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="font-medium text-muted-foreground">No certificates issued yet</p>
            <Button variant="outline" className="mt-4 gap-2" onClick={() => setShowIssue(true)}>
              <Plus className="w-4 h-4" /> Issue First Certificate
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {certs.map(cert => (
                <CertificateCard
                  key={cert.id}
                  cert={cert}
                  onRevoke={() => revokeMut.mutate(cert.id)}
                  onCopy={() => copyLink(cert.verification_url)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Issue Modal */}
      <AnimatePresence>
        {showIssue && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) setShowIssue(false); }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4"
            >
              <h2 className="font-bold text-lg flex items-center gap-2">
                <Award className="w-5 h-5 text-primary" /> Issue Certificate
              </h2>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Student ID</label>
                <Input
                  placeholder="Enter student ID number"
                  value={form.student_account_id}
                  onChange={e => setForm(f => ({ ...f, student_account_id: e.target.value }))}
                />
                <p className="text-[11px] text-muted-foreground mt-1">Enter the student's numeric ID from the student list.</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Certificate Title *</label>
                <Input
                  placeholder="e.g. A-Level Physics Completion Certificate"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Template</label>
                <div className="grid grid-cols-2 gap-2">
                  {TEMPLATE_OPTIONS.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setForm(f => ({ ...f, template: t.id }))}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-all text-left ${
                        form.template === t.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${t.color}`} />
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Description (optional)</label>
                <textarea
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none h-16 outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Additional notes or achievements…"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowIssue(false)}>Cancel</Button>
                <Button
                  className="flex-1"
                  onClick={() => issueMut.mutate()}
                  disabled={!form.title.trim() || !form.student_account_id.trim() || issueMut.isPending}
                >
                  {issueMut.isPending ? "Issuing…" : "Issue Certificate"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
