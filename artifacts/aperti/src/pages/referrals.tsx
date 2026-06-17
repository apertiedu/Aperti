import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, Users, Gift, Trophy, Share2, LinkIcon } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface ReferralStats {
  referrals: Array<{
    id: number;
    code: string;
    status: string;
    reward_value: number;
    created_at: string;
    activated_at: string | null;
    referred_name: string | null;
    referred_joined: string | null;
  }>;
  total: number;
  active: number;
  rewarded: number;
}

interface MyCodeData {
  code: string;
  link: string;
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-xl border border-border p-5 flex items-center gap-4"
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}18` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </motion.div>
  );
}

const STATUS_STYLES: Record<string, { label: string; class: string }> = {
  pending: { label: "Pending", class: "bg-amber-100 text-amber-700" },
  active: { label: "Active", class: "bg-teal-100 text-teal-700" },
  rewarded: { label: "Rewarded", class: "bg-green-100 text-green-700" },
};

export default function Referrals() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [applyCode, setApplyCode] = useState("");
  const [applyError, setApplyError] = useState("");

  const { data: codeData, isLoading: codeLoading } = useQuery<MyCodeData>({
    queryKey: ["referral-code"],
    queryFn: () => apiFetch("/api/referrals/my-code").then(r => r.json()),
  });

  const { data: stats, isLoading: statsLoading } = useQuery<ReferralStats>({
    queryKey: ["referral-stats"],
    queryFn: () => apiFetch("/api/referrals/stats").then(r => r.json()),
  });

  const copyMutation = useMutation({
    mutationFn: async () => {
      const link = codeData?.link ?? "";
      const full = link.startsWith("http") ? link : `${window.location.origin}/register?ref=${codeData?.code}`;
      await navigator.clipboard.writeText(full);
    },
    onSuccess: () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Copied!", description: "Referral link copied to clipboard." });
    },
  });

  const applyMutation = useMutation({
    mutationFn: async (code: string) => {
      const r = await apiFetch("/api/referrals/apply", { method: "POST", body: JSON.stringify({ code }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Failed to apply code");
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Referral applied!", description: data.message });
      setApplyCode("");
      setApplyError("");
      qc.invalidateQueries({ queryKey: ["referral-stats"] });
    },
    onError: (err: Error) => setApplyError(err.message),
  });

  const fullLink = codeData ? `${window.location.origin}/register?ref=${codeData.code}` : "";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Share2 className="w-6 h-6" style={{ color: "hsl(var(--primary))" }} />
          Referrals
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Invite friends — earn rewards when they subscribe.</p>
      </motion.div>

      {/* Your referral link */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-card rounded-xl border border-border p-6 space-y-4"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <LinkIcon className="w-4 h-4" style={{ color: "hsl(var(--primary))" }} />
          Your referral link
        </div>
        {codeLoading ? (
          <div className="h-10 rounded-xl bg-muted animate-pulse" />
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-10 rounded-xl border border-border bg-muted/50 px-3 flex items-center">
              <span className="text-sm text-muted-foreground font-mono truncate">{fullLink}</span>
            </div>
            <motion.button
              onClick={() => copyMutation.mutate()}
              className="h-10 px-4 rounded-xl text-sm font-medium text-white flex items-center gap-2 shrink-0"
              style={{ background: "hsl(var(--primary))" }}
              whileTap={{ scale: 0.97 }}
            >
              <AnimatePresence mode="wait">
                {copied ? (
                  <motion.span key="ok" initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-1.5">
                    <Check className="w-4 h-4" /> Copied
                  </motion.span>
                ) : (
                  <motion.span key="copy" className="flex items-center gap-1.5">
                    <Copy className="w-4 h-4" /> Copy
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        )}
        {codeData && (
          <p className="text-xs text-muted-foreground">
            Your code: <span className="font-mono font-bold tracking-wider text-foreground">{codeData.code}</span>
          </p>
        )}
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={Users} label="Total referrals" value={stats?.total ?? 0} color="#0D9488" />
        <StatCard icon={Gift} label="Active" value={stats?.active ?? 0} color="#6366f1" />
        <StatCard icon={Trophy} label="Rewarded" value={stats?.rewarded ?? 0} color="#f59e0b" />
      </div>

      {/* Apply a code */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-card rounded-xl border border-border p-6 space-y-3"
      >
        <p className="text-sm font-semibold text-foreground">Apply a referral code</p>
        <p className="text-xs text-muted-foreground">Enter a friend's code to credit them.</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={applyCode}
            onChange={e => { setApplyCode(e.target.value.toUpperCase().slice(0, 8)); setApplyError(""); }}
            placeholder="ABC12345"
            className="flex-1 h-10 px-3 rounded-xl border border-border text-sm bg-background text-foreground outline-none focus:border-primary transition-colors font-mono"
          />
          <button
            onClick={() => applyCode.trim() && applyMutation.mutate(applyCode.trim())}
            disabled={!applyCode.trim() || applyMutation.isPending}
            className="h-10 px-4 rounded-xl text-sm font-medium text-white disabled:opacity-50 transition-opacity"
            style={{ background: "hsl(var(--primary))" }}
          >
            {applyMutation.isPending ? "Applying…" : "Apply"}
          </button>
        </div>
        {applyError && <p className="text-xs text-red-500">{applyError}</p>}
      </motion.div>

      {/* Referral history */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card rounded-xl border border-border p-6 space-y-4"
      >
        <p className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Users className="w-4 h-4" style={{ color: "hsl(var(--primary))" }} />
          Your referrals
        </p>
        {statsLoading ? (
          <div className="space-y-2">
            {[0,1,2].map(i => <div key={i} className="h-12 rounded-xl bg-muted animate-pulse" />)}
          </div>
        ) : !stats?.referrals.length ? (
          <div className="py-8 text-center">
            <Share2 className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-sm text-muted-foreground">No referrals yet. Share your link to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {stats.referrals.map((r, i) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/30"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{r.referred_name ?? "Anonymous"}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.activated_at ? new Date(r.activated_at).toLocaleDateString() : new Date(r.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLES[r.status]?.class ?? "bg-gray-100 text-gray-600"}`}>
                  {STATUS_STYLES[r.status]?.label ?? r.status}
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
