/**
 * PrivacyVault — Phase 4 Compliance & Trust Layer
 * Full account deletion workflow, data export, and privacy controls.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import {
  Shield, Download, Trash2, AlertTriangle, CheckCircle2,
  Clock, ChevronRight, Lock, FileJson, Eye, Settings,
  ExternalLink, ArrowLeft,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

// ── Types ─────────────────────────────────────────────────────────────────────
type DeletionStatus = {
  hasPending: boolean;
  status?: string;
  requestedAt?: string;
  gracePeriodEnds?: string;
};

// ── Step indicator ────────────────────────────────────────────────────────────
function StepDot({ n, current, done }: { n: number; current: number; done: boolean }) {
  const active = n === current;
  const completed = done || n < current;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
        completed ? "bg-primary text-primary-foreground" :
        active ? "bg-primary/20 text-primary border-2 border-primary" :
        "bg-muted text-muted-foreground"
      }`}>
        {completed ? <CheckCircle2 className="h-4 w-4" /> : n}
      </div>
    </div>
  );
}

// ── Account Deletion Workflow ─────────────────────────────────────────────────
function DeletionFlow({ onCancel }: { onCancel: () => void }) {
  const [step, setStep] = useState(1);
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");
  const { toast } = useToast();

  const CONFIRM_PHRASE = "delete my account";

  const submitMutation = useMutation({
    mutationFn: () => {
      if (confirm.trim().toLowerCase() !== CONFIRM_PHRASE) {
        return Promise.reject(new Error("Invalid confirmation phrase"));
      }
      return apiFetch("/api/user/deletion-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, confirmation: confirm.trim().toLowerCase() }),
      }).then(async r => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.error ?? "Request failed");
        }
        return r.json();
      });
    },
    onSuccess: () => {
      setStep(4);
      toast({ title: "Deletion request submitted", description: "We'll process your request within 30 days." });
    },
    onError: () => toast({ title: "Failed to submit request", variant: "destructive" }),
  });

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {[1, 2, 3].map(n => (
          <div key={n} className="flex items-center gap-2">
            <StepDot n={n} current={step} done={step === 4} />
            {n < 3 && <div className={`h-px flex-1 w-12 transition-colors ${step > n ? "bg-primary" : "bg-border"}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Reason */}
      {step === 1 && (
        <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <h3 className="text-base font-bold mb-1">Why do you want to delete your account?</h3>
          <p className="text-sm text-muted-foreground mb-4">Your feedback helps us improve. This is optional.</p>
          <Textarea
            placeholder="I'm leaving because..."
            value={reason}
            onChange={e => setReason(e.target.value)}
            className="mb-4 resize-none"
            rows={3}
          />
          <div className="flex gap-3">
            <Button variant="outline" onClick={onCancel}><ArrowLeft className="h-4 w-4 mr-2" /> Cancel</Button>
            <Button onClick={() => setStep(2)}>Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
          </div>
        </motion.div>
      )}

      {/* Step 2: Consequences */}
      {step === 2 && (
        <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <h3 className="text-base font-bold mb-1">What gets deleted?</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Once confirmed, your account enters a <strong>30-day grace period</strong> — you can cancel anytime during this window.
            After 30 days, deletion is permanent.
          </p>
          <ul className="space-y-2 mb-5 text-sm">
            {[
              { label: "Account profile & settings", when: "After 30-day grace period" },
              { label: "Academic records, grades & submissions", when: "After 30-day grace period" },
              { label: "Messages & notifications", when: "After 30-day grace period" },
              { label: "AI interaction history", when: "After 30-day grace period" },
              { label: "Payment & subscription history", when: "Retained 5 years (legal requirement)" },
              { label: "Audit logs", when: "Retained 12 months (security requirement)" },
            ].map(({ label, when }) => (
              <li key={label} className="flex items-start justify-between gap-4 py-2 border-b border-border/40 last:border-0">
                <span className="text-foreground">{label}</span>
                <span className="text-xs text-muted-foreground text-right flex-shrink-0 max-w-[160px]">{when}</span>
              </li>
            ))}
          </ul>
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4 flex gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              We recommend <Link href="/privacy-vault" className="underline font-semibold">exporting your data</Link> before proceeding.
              This cannot be undone after the grace period.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
            <Button onClick={() => setStep(3)}>I understand — continue <ChevronRight className="h-4 w-4 ml-1" /></Button>
          </div>
        </motion.div>
      )}

      {/* Step 3: Confirmation */}
      {step === 3 && (
        <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <h3 className="text-base font-bold mb-1 text-destructive">Final confirmation</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Type <strong className="text-foreground font-mono">delete my account</strong> to confirm your request.
          </p>
          <input
            type="text"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder="delete my account"
            className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background mb-4 font-mono focus:outline-none focus:ring-2 focus:ring-destructive/40"
          />
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
            <Button
              variant="destructive"
              disabled={confirm !== CONFIRM_PHRASE || submitMutation.isPending}
              onClick={() => submitMutation.mutate()}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {submitMutation.isPending ? "Submitting…" : "Submit deletion request"}
            </Button>
          </div>
        </motion.div>
      )}

      {/* Step 4: Success */}
      {step === 4 && (
        <motion.div key="step4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="text-center py-6">
          <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-7 w-7 text-primary" />
          </div>
          <h3 className="text-lg font-bold mb-2">Request submitted</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Your deletion request is in our queue. Your account enters a <strong>30-day grace period</strong> starting today.
            We'll send a confirmation to your email. Contact <a href="mailto:privacy@aperti.ai" className="text-primary underline">privacy@aperti.ai</a> to cancel.
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}

// ── Data Export Card ──────────────────────────────────────────────────────────
function ExportCard() {
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await apiFetch("/api/user/export", { method: "POST" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aperti-data-export-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({ title: "Export downloaded", description: "Your data archive has been saved." });
    } catch {
      toast({ title: "Export failed", description: "Please try again or contact support.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card className="card-hover">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Export Your Data</CardTitle>
              <CardDescription className="text-xs mt-0.5">Download a complete archive of your data</CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className="text-[10px]">Article 20 GDPR</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {[
            { icon: FileJson, label: "Profile & account info" },
            { icon: Eye, label: "Academic records & grades" },
            { icon: FileJson, label: "Homework & submissions" },
            { icon: FileJson, label: "Subscription history" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon className="h-3 w-3 text-primary shrink-0" />
              {label}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Exported as a single <strong>JSON file</strong>. Available immediately — no waiting period.
          Under GDPR Article 20 and Egyptian Law 151/2020, you have the right to receive your data in a machine-readable format.
        </p>
        <Button onClick={handleExport} disabled={exporting} className="w-full sm:w-auto">
          <Download className="h-4 w-4 mr-2" />
          {exporting ? "Preparing export…" : "Download my data"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Deletion Status Banner ────────────────────────────────────────────────────
function DeletionStatusBanner({ status }: { status: DeletionStatus }) {
  if (!status.hasPending) return null;
  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
      <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Account deletion pending</p>
        <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
          Status: <strong>{status.status}</strong>.{" "}
          {status.requestedAt && <>Requested: {new Date(status.requestedAt).toLocaleDateString()}. </>}
          To cancel, email <a href="mailto:privacy@aperti.ai" className="underline">privacy@aperti.ai</a>.
        </p>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function PrivacyVault() {
  const [showDeletion, setShowDeletion] = useState(false);

  const { data: deletionStatus } = useQuery<DeletionStatus>({
    queryKey: ["deletion-status"],
    queryFn: () =>
      apiFetch("/api/user/deletion-request-status")
        .then(r => r.json())
        .catch(() => ({ hasPending: false })),
    staleTime: 30_000,
  });

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 max-w-2xl">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              PrivacyVault<span className="text-primary">™</span>
            </h1>
            <p className="text-xs text-muted-foreground">You are in control of your data</p>
          </div>
        </div>
      </motion.div>

      <div className="max-w-2xl space-y-5">
        {/* Deletion status alert */}
        {deletionStatus && <DeletionStatusBanner status={deletionStatus} />}

        {/* Export card */}
        <ExportCard />

        {/* Consent settings */}
        <Card className="card-hover">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                <Settings className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">Privacy Preferences</CardTitle>
                <CardDescription className="text-xs mt-0.5">Manage analytics, marketing & AI consent</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-4">
              Control how we use your data for optional purposes including analytics and AI improvement.
              Essential cookies are always active and cannot be disabled.
            </p>
            <Link href="/consent-settings">
              <Button variant="outline" size="sm">
                <Settings className="h-3.5 w-3.5 mr-2" />
                Manage consent preferences
                <ExternalLink className="h-3 w-3 ml-2 opacity-60" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Legal rights */}
        <Card className="card-hover">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                <Lock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">Your Legal Rights</CardTitle>
                <CardDescription className="text-xs mt-0.5">GDPR & Egyptian Law 151/2020 rights portal</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4 text-xs">
              {[
                "Right to access (Art. 15)",
                "Right to rectification (Art. 16)",
                "Right to erasure (Art. 17)",
                "Right to portability (Art. 20)",
                "Right to object (Art. 21)",
                "Right to restriction (Art. 18)",
              ].map(r => (
                <div key={r} className="flex items-center gap-1.5 text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 text-primary shrink-0" /> {r}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/legal">
                <Button variant="outline" size="sm">Submit formal data request <ExternalLink className="h-3 w-3 ml-1.5 opacity-60" /></Button>
              </Link>
              <Link href="/privacy">
                <Button variant="ghost" size="sm">Privacy Policy</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Account deletion */}
        <Card className={`border-2 transition-colors ${showDeletion ? "border-destructive/30" : "border-border"}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <CardTitle className="text-base text-destructive">Delete Account</CardTitle>
                <CardDescription className="text-xs mt-0.5">Permanently remove your account and data</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <AnimatePresence mode="wait">
              {showDeletion ? (
                <DeletionFlow key="flow" onCancel={() => setShowDeletion(false)} />
              ) : (
                <motion.div key="prompt" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <p className="text-sm text-muted-foreground mb-4">
                    Deleting your account permanently removes your profile, academic records, and all associated data
                    after a <strong>30-day grace period</strong>. Financial and audit records are retained as required by law.
                  </p>
                  <Button
                    variant="destructive"
                    onClick={() => setShowDeletion(true)}
                    disabled={deletionStatus?.hasPending}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {deletionStatus?.hasPending ? "Deletion request pending" : "Begin account deletion"}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Policy links */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-2">
          {[
            { href: "/privacy", label: "Privacy Policy" },
            { href: "/terms", label: "Terms of Service" },
            { href: "/data-retention", label: "Data Retention" },
            { href: "/legal", label: "Legal Contact / DPO" },
            { href: "/trust", label: "Trust Center" },
          ].map(({ href, label }) => (
            <Link key={href} href={href} className="hover:text-foreground transition-colors underline underline-offset-2">
              {label}
            </Link>
          ))}
          <span className="ml-auto text-[10px]">v2026.06</span>
        </div>
      </div>
    </div>
  );
}
