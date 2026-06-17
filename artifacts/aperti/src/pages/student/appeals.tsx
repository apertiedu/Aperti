import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function StudentAppeals() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({ submission_id: "", reason: "" });

  // Get student's own submissions for the dropdown
  const { data: submissions } = useQuery({
    queryKey: ["my-submissions"],
    queryFn: async () => {
      const res = await apiFetch("/api/assessments");
      const data = await res.json();
      // Get assessments that have been submitted
      return (data.assessments ?? []).filter((a: any) => ["submitted","graded","returned"].includes(a.submission_status));
    },
  });

  const { data: appeals = [], isLoading } = useQuery<any[]>({
    queryKey: ["student-appeals"],
    queryFn: async () => {
      const res = await apiFetch("/api/appeals/my");
      const data = await res.json();
      return data.appeals ?? [];
    },
  });

  const submitMut = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/appeals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission_id: parseInt(newForm.submission_id), reason: newForm.reason }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-appeals"] });
      setShowNew(false);
      setNewForm({ submission_id: "", reason: "" });
      toast({ title: "Appeal submitted successfully" });
    },
    onError: () => toast({ title: "Failed to submit appeal", variant: "destructive" }),
  });

  const STATUS_META = {
    requested:    { label: "Pending",     color: "bg-amber-500/10 text-amber-600",   icon: Clock },
    under_review: { label: "Under Review", color: "bg-blue-500/10 text-blue-600",    icon: AlertCircle },
    resolved:     { label: "Resolved",    color: "bg-emerald-500/10 text-emerald-600", icon: CheckCircle2 },
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-primary" /> Grade Appeals
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Request a review if you believe your grade is incorrect.</p>
        </div>
        <Button className="gap-2" onClick={() => setShowNew(true)}>
          + New Appeal
        </Button>
      </div>

      {/* New appeal modal */}
      <AnimatePresence>
        {showNew && (
          <motion.div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) setShowNew(false); }}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
              <h3 className="font-bold">Request Grade Appeal</h3>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Submission ID</label>
                <input
                  type="number"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Enter submission ID (visible in your results)"
                  value={newForm.submission_id}
                  onChange={e => setNewForm(f => ({ ...f, submission_id: e.target.value }))}
                />
                <p className="text-[11px] text-muted-foreground mt-1">Find this in your exam results page.</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Reason *</label>
                <textarea
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none h-32 outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Explain why you believe your grade should be reviewed. Be specific about which questions you think were incorrectly marked and why."
                  value={newForm.reason}
                  onChange={e => setNewForm(f => ({ ...f, reason: e.target.value }))}
                />
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-xs text-amber-700">
                Appeals are reviewed by your teacher. Please be respectful and specific in your request.
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setShowNew(false)}>Cancel</Button>
                <Button className="flex-1" onClick={() => submitMut.mutate()}
                  disabled={!newForm.submission_id || !newForm.reason.trim() || submitMut.isPending}>
                  {submitMut.isPending ? "Submitting…" : "Submit Appeal"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* How it works */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
        <h3 className="font-semibold text-sm">How Appeals Work</h3>
        <div className="space-y-2">
          {[
            { icon: "1", text: "Submit your appeal with a clear explanation of why you disagree with the marking." },
            { icon: "2", text: "Your teacher reviews the appeal and your original answers." },
            { icon: "3", text: "If justified, the grade is adjusted. You'll be notified of the outcome." },
          ].map(step => (
            <div key={step.icon} className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">{step.icon}</div>
              <p className="text-sm text-muted-foreground">{step.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Appeals list — will populate once student submits */}
      {isLoading ? (
        <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-20 bg-muted/40 rounded-xl animate-pulse" />)}</div>
      ) : (
        <div className="text-center py-12 border border-dashed border-border rounded-2xl">
          <MessageSquare className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-medium text-muted-foreground">No appeals yet</p>
          <p className="text-xs text-muted-foreground mt-1">If you disagree with a grade, click "New Appeal" to start a review request.</p>
        </div>
      )}
    </div>
  );
}
