import { apiFetch } from "@/lib/api";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, KeyRound, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function PasswordStrength({ password }: { password: string }) {
  const score = (() => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 6) s++;
    if (password.length >= 10) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();

  const levels = [
    { label: "Too short", color: "bg-red-400", textColor: "text-red-600" },
    { label: "Weak", color: "bg-red-400", textColor: "text-red-600" },
    { label: "Fair", color: "bg-amber-400", textColor: "text-amber-600" },
    { label: "Good", color: "bg-blue-400", textColor: "text-blue-600" },
    { label: "Strong", color: "bg-emerald-400", textColor: "text-emerald-600" },
    { label: "Very Strong", color: "bg-emerald-500", textColor: "text-emerald-700" },
  ];

  if (!password) return null;
  const level = levels[Math.min(score, 5)];

  return (
    <div className="space-y-1.5 mt-2">
      <div className="flex gap-1">
        {[...Array(5)].map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i < score ? level.color : "bg-gray-200"}`} />
        ))}
      </div>
      <p className={`text-xs font-medium ${level.textColor}`}>{level.label}</p>
    </div>
  );
}

export default function ChangePasswordModal({ trigger }: { trigger: React.ReactNode }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [show, setShow] = useState({ current: false, next: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.next !== form.confirm) { setError("New passwords do not match"); return; }
    if (form.next.length < 6) { setError("New password must be at least 6 characters"); return; }
    setSaving(true);
    try {
      const res = await apiFetch("/api/auth/change-password", {
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: form.current, newPassword: form.next }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.message || "Failed"); return; }
      toast({ title: "Password changed successfully ✅" });
      setOpen(false);
      setForm({ current: "", next: "", confirm: "" });
    } catch { setError("An error occurred. Please try again."); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" />Change Password</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Current Password</Label>
            <div className="relative">
              <Input type={show.current ? "text" : "password"} value={form.current} onChange={e => setForm({ ...form, current: e.target.value })} required maxLength={500} className="pr-10" />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShow(s => ({ ...s, current: !s.current }))}>
                {show.current ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>New Password</Label>
            <div className="relative">
              <Input type={show.next ? "text" : "password"} value={form.next} onChange={e => setForm({ ...form, next: e.target.value })} required className="pr-10" />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShow(s => ({ ...s, next: !s.next }))}>
                {show.next ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <PasswordStrength password={form.next} />
          </div>

          <div className="space-y-1.5">
            <Label>Confirm New Password</Label>
            <Input type="password" value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} required maxLength={500} />
            {form.confirm && form.next !== form.confirm && <p className="text-xs text-red-500 mt-1">Passwords do not match</p>}
          </div>

          {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}

          <Button type="submit" className="w-full gap-2" disabled={saving || !form.current || !form.next || form.next !== form.confirm}>
            <Shield className="h-4 w-4" />{saving ? "Changing..." : "Change Password"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
