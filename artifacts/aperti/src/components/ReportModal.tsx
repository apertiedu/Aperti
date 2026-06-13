import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Flag, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const REPORT_REASONS = [
  "Inappropriate content",
  "Harassment or bullying",
  "Spam or misinformation",
  "Offensive language",
  "Other",
];



interface ReportModalProps {
  open: boolean;
  onClose: () => void;
  targetType: "message" | "post" | "review" | "user" | "group";
  targetId: string | number;
}

export function ReportModal({ open, onClose, targetType, targetId }: ReportModalProps) {
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!reason) {
      toast({ title: "Please select a reason", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/safety/report", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId: String(targetId), reason, description }),
      });
      if (!res.ok) throw new Error();
      setSubmitted(true);
    } catch {
      toast({ title: "Failed to submit report", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setReason("");
    setDescription("");
    setSubmitted(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md" aria-label="Report content dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Flag className="h-4 w-4 text-destructive" aria-hidden="true" />
            Report Content
          </DialogTitle>
        </DialogHeader>

        {submitted ? (
          <div className="py-6 text-center" role="status" aria-live="polite">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-3" aria-hidden="true" />
            <p className="font-semibold mb-1">Report submitted</p>
            <p className="text-sm text-muted-foreground mb-4">
              Our team will review this shortly. Thank you for keeping the community safe.
            </p>
            <Button onClick={handleClose} aria-label="Close report dialog">Done</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-3" id="report-reason-label">
                What's wrong with this content?
              </p>
              <RadioGroup
                value={reason}
                onValueChange={setReason}
                aria-labelledby="report-reason-label"
              >
                {REPORT_REASONS.map((r) => (
                  <div key={r} className="flex items-center gap-2.5 py-0.5">
                    <RadioGroupItem value={r} id={`reason-${r.replace(/\s+/g, "-")}`} />
                    <Label
                      htmlFor={`reason-${r.replace(/\s+/g, "-")}`}
                      className="text-sm cursor-pointer"
                    >
                      {r}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <div>
              <Label htmlFor="report-extra" className="text-sm font-medium">
                Additional details <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                id="report-extra"
                placeholder="Provide more context if needed…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="mt-1.5 resize-none text-sm"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                onClick={handleClose}
                className="flex-1"
                aria-label="Cancel report"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!reason || loading}
                className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                aria-label="Submit report"
              >
                {loading ? "Submitting…" : "Submit Report"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
