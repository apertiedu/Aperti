/**
 * Consent Settings — Phase 4 Compliance & Trust Layer
 * Lets authenticated users manage their granular data-processing consents.
 */
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import {
  Shield, Check, AlertCircle, RefreshCw, ChevronRight,
  BarChart3, Megaphone, BrainCircuit, Lock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

const POLICY_VERSION = "v2026.06";
const CONSENT_KEY = "aperti_consent_v2026_06";

type ConsentRecord = {
  consent_type: string;
  granted: boolean;
  policy_version: string;
  granted_at: string;
};

type ConsentResponse = {
  consents: ConsentRecord[];
  policy_version: string;
};

type LocalConsent = {
  essential: boolean;
  analytics: boolean;
  marketing: boolean;
  ai_training: boolean;
  decided: boolean;
};

const CONSENT_DEFS = [
  {
    key: "essential",
    label: "Essential",
    desc: "Required for login, session management, and core security. Cannot be disabled.",
    icon: Lock,
    locked: true,
    legal_basis: "Legitimate interest",
    examples: ["Login cookies", "Session tokens", "Security events"],
  },
  {
    key: "analytics",
    label: "Analytics",
    desc: "Anonymised usage data to help us understand how features are used and improve the platform.",
    icon: BarChart3,
    locked: false,
    legal_basis: "Consent",
    examples: ["Pages visited", "Feature usage frequency", "Session duration"],
  },
  {
    key: "marketing",
    label: "Marketing communications",
    desc: "Personalised updates about new features, study tips, and platform announcements.",
    icon: Megaphone,
    locked: false,
    legal_basis: "Consent",
    examples: ["Feature announcement emails", "Study reminders", "Newsletter"],
  },
  {
    key: "ai_training",
    label: "AI model improvement",
    desc: "Allow anonymised interaction data to help train and improve Aperti's AI features. No personal data is included.",
    icon: BrainCircuit,
    locked: false,
    legal_basis: "Consent",
    examples: ["Anonymised query patterns", "Response quality ratings", "Feature usage signals"],
  },
] as const;

function Toggle({ value, onChange, disabled }: { value: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      aria-pressed={value}
      className={`relative w-12 h-6 rounded-full transition-colors duration-200 flex-shrink-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      }`}
      style={{ background: value ? "hsl(var(--primary))" : "hsl(var(--muted))" }}
    >
      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${value ? "left-7" : "left-1"}`} />
    </button>
  );
}

function getLocalConsent(): LocalConsent | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p?.decided) return p as LocalConsent;
    return null;
  } catch {
    return null;
  }
}

export default function ConsentSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Record<string, boolean>>({
    essential: true,
    analytics: false,
    marketing: false,
    ai_training: false,
  });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  // Fetch server-side consents (for authenticated users)
  const { data, isLoading, error } = useQuery<ConsentResponse>({
    queryKey: ["consent-settings"],
    queryFn: () => apiFetch("/api/compliance/consent").then(r => r.json()),
    staleTime: 60_000,
  });

  // Initialise draft from server data or localStorage
  useEffect(() => {
    if (data?.consents?.length) {
      const map: Record<string, boolean> = { essential: true };
      for (const c of data.consents) map[c.consent_type] = c.granted;
      setDraft(prev => ({ ...prev, ...map }));
    } else {
      const local = getLocalConsent();
      if (local) {
        setDraft({
          essential: true,
          analytics: local.analytics,
          marketing: local.marketing,
          ai_training: local.ai_training,
        });
      }
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/compliance/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consents: Object.entries(draft).map(([type, granted]) => ({ type, granted })),
        }),
      }).then(r => r.json()),
    onSuccess: () => {
      // Also update localStorage for the banner
      const local = getLocalConsent() ?? { essential: true, analytics: false, marketing: false, ai_training: false, decided: true };
      const updated = { ...local, ...draft, decided: true };
      localStorage.setItem(CONSENT_KEY, JSON.stringify(updated));
      queryClient.invalidateQueries({ queryKey: ["consent-settings"] });
      setDirty(false);
      toast({ title: "Preferences saved", description: "Your consent preferences have been updated." });
    },
    onError: () => toast({ title: "Failed to save", variant: "destructive" }),
  });

  const toggle = (key: string) => {
    if (key === "essential") return;
    setDraft(prev => ({ ...prev, [key]: !prev[key] }));
    setDirty(true);
  };

  const acceptAll = () => {
    setDraft({ essential: true, analytics: true, marketing: true, ai_training: true });
    setDirty(true);
  };

  const essentialOnly = () => {
    setDraft({ essential: true, analytics: false, marketing: false, ai_training: false });
    setDirty(true);
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 max-w-2xl">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Consent Preferences</h1>
            <p className="text-xs text-muted-foreground">Manage how your data is used — policy {POLICY_VERSION}</p>
          </div>
        </div>
      </motion.div>

      <div className="max-w-2xl space-y-4">
        {/* Info banner */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex gap-3">
          <AlertCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            You can update your preferences at any time. Changes take effect immediately. Essential cookies are required for the
            platform to function and cannot be disabled.{" "}
            <Link href="/privacy" className="text-primary underline hover:opacity-80">Learn more in our Privacy Policy.</Link>
          </p>
        </div>

        {/* Quick actions */}
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={acceptAll}>Accept all</Button>
          <Button size="sm" variant="ghost" onClick={essentialOnly}>Essential only</Button>
        </div>

        {/* Consent cards */}
        <div className="space-y-3">
          {isLoading && (
            <div className="flex items-center gap-2 py-8 justify-center text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" /> Loading your preferences…
            </div>
          )}
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">
              Failed to load consent data. Showing last known preferences.
            </div>
          )}
          {CONSENT_DEFS.map(({ key, label, desc, icon: Icon, locked, legal_basis, examples }) => (
            <Card key={key} className="overflow-hidden">
              <div className="p-4 flex items-start gap-4">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-foreground">{label}</span>
                    <Badge variant="outline" className="text-[9px] py-0">{legal_basis}</Badge>
                    {locked && (
                      <Badge variant="secondary" className="text-[9px] py-0">Always active</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                  <button
                    className="text-[11px] text-primary mt-1.5 flex items-center gap-0.5 hover:opacity-80 transition-opacity"
                    onClick={() => setExpanded(expanded === key ? null : key)}
                  >
                    {expanded === key ? "Hide" : "Show"} examples
                    <ChevronRight className={`h-3 w-3 transition-transform ${expanded === key ? "rotate-90" : ""}`} />
                  </button>
                  {expanded === key && (
                    <motion.ul
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-2 space-y-1"
                    >
                      {examples.map(ex => (
                        <li key={ex} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Check className="h-3 w-3 text-primary shrink-0" /> {ex}
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </div>
                <div className="shrink-0">
                  {locked ? (
                    <div className="flex items-center gap-1.5 text-xs text-primary font-semibold">
                      <Check className="h-3.5 w-3.5" /> On
                    </div>
                  ) : (
                    <Toggle
                      value={!!draft[key]}
                      onChange={() => toggle(key)}
                    />
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Save button */}
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            Last synced: {data?.consents?.[0]?.granted_at
              ? new Date(data.consents[0].granted_at).toLocaleDateString()
              : "Never"}
          </p>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!dirty || saveMutation.isPending}
          >
            {saveMutation.isPending ? "Saving…" : "Save preferences"}
          </Button>
        </div>

        {/* Policy links */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground border-t border-border pt-4">
          {[
            { href: "/privacy", label: "Privacy Policy" },
            { href: "/data-retention", label: "Data Retention" },
            { href: "/legal", label: "Legal Contact" },
            { href: "/privacy-vault", label: "PrivacyVault™" },
          ].map(({ href, label }) => (
            <Link key={href} href={href} className="hover:text-foreground transition-colors underline underline-offset-2">
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
