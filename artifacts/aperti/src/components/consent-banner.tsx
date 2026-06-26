import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, X, ChevronDown, ChevronUp, Check } from "lucide-react";
import { Link } from "wouter";

const CONSENT_KEY = "aperti_consent_v2026_06";
const POLICY_VERSION = "v2026.06";

interface ConsentState {
  essential: true;
  analytics: boolean;
  marketing: boolean;
  ai_training: boolean;
  decided: boolean;
}

const DEFAULT_CONSENT: ConsentState = {
  essential: true,
  analytics: false,
  marketing: false,
  ai_training: false,
  decided: false,
};

function getStoredConsent(): ConsentState | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.decided) return parsed as ConsentState;
    return null;
  } catch {
    return null;
  }
}

function fingerprint(): string {
  try {
    return btoa(`${navigator.language}-${screen.width}x${screen.height}-${Intl.DateTimeFormat().resolvedOptions().timeZone}`).slice(0, 32);
  } catch {
    return "";
  }
}

async function recordConsent(consent: ConsentState) {
  try {
    const consents = [
      { type: "essential",    granted: true },
      { type: "analytics",   granted: consent.analytics },
      { type: "marketing",   granted: consent.marketing },
      { type: "ai_training", granted: consent.ai_training },
    ];
    await fetch("/api/compliance/consent/public", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consents, fingerprint: fingerprint() }),
    });
  } catch {}
}

function Toggle({ value, onChange, disabled }: { value: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onChange} disabled={disabled}
      aria-pressed={value}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      style={{ background: value ? "hsl(var(--primary))" : "#d1d5db" }}>
      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${value ? "left-6" : "left-1"}`} />
    </button>
  );
}

export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [consent, setConsent] = useState<ConsentState>(DEFAULT_CONSENT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const stored = getStoredConsent();
    if (!stored) {
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const save = async (finalConsent: ConsentState) => {
    setSaving(true);
    const decided = { ...finalConsent, decided: true };
    localStorage.setItem(CONSENT_KEY, JSON.stringify(decided));
    await recordConsent(decided);
    setSaving(false);
    setVisible(false);
  };

  const acceptAll = () => save({ essential: true, analytics: true, marketing: true, ai_training: true, decided: true });
  const essentialOnly = () => save({ ...DEFAULT_CONSENT, decided: true });
  const savePreferences = () => save({ ...consent, decided: true });

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="consent-banner"
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-4 left-4 right-4 z-[9999] sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Cookie and privacy preferences">
          <div className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5">
              <div className="flex items-start justify-between mb-3 gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Shield className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">Privacy preferences</p>
                    <p className="text-[10px] text-muted-foreground">{POLICY_VERSION}</p>
                  </div>
                </div>
                <button onClick={() => essentialOnly()} aria-label="Close — essential only"
                  className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 mt-0.5">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                We use cookies and similar technologies to provide our service, analyse usage, and improve Aperti.
                Essential cookies are always active.{" "}
                <Link href="/privacy" className="text-primary underline hover:opacity-80">Privacy Policy</Link>
              </p>

              <AnimatePresence>
                {expanded && (
                  <motion.div key="prefs"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden">
                    <div className="space-y-3 mb-4 border-t border-border pt-4">
                      {[
                        { key: "essential", label: "Essential", desc: "Login, security, session management", locked: true },
                        { key: "analytics", label: "Analytics", desc: "Anonymised usage to improve features" },
                        { key: "marketing", label: "Marketing", desc: "Personalised communication preferences" },
                        { key: "ai_training", label: "AI Improvement", desc: "Help improve AI features (data anonymised)" },
                      ].map(({ key, label, desc, locked }) => (
                        <div key={key} className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-foreground leading-tight">{label}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
                          </div>
                          {locked ? (
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <Check className="h-3 w-3 text-primary" />
                              <span className="text-[10px] text-primary font-semibold">Always on</span>
                            </div>
                          ) : (
                            <Toggle
                              value={consent[key as keyof ConsentState] as boolean}
                              onChange={() => setConsent(c => ({ ...c, [key]: !c[key as keyof ConsentState] }))}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button onClick={() => setExpanded(e => !e)}
                className="w-full flex items-center justify-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors mb-4">
                {expanded ? <><ChevronUp className="h-3 w-3" /> Hide preferences</> : <><ChevronDown className="h-3 w-3" /> Manage preferences</>}
              </button>

              <div className="flex gap-2">
                {expanded ? (
                  <motion.button whileTap={{ scale: 0.97 }} onClick={savePreferences} disabled={saving}
                    className="flex-1 py-2 rounded-xl bg-primary text-white text-xs font-bold disabled:opacity-60 transition-opacity">
                    {saving ? "Saving…" : "Save preferences"}
                  </motion.button>
                ) : (
                  <motion.button whileTap={{ scale: 0.97 }} onClick={essentialOnly} disabled={saving}
                    className="flex-1 py-2 rounded-xl border border-border bg-background text-foreground text-xs font-semibold hover:bg-muted/40 transition-colors">
                    Essential only
                  </motion.button>
                )}
                <motion.button whileTap={{ scale: 0.97 }} onClick={acceptAll} disabled={saving}
                  className="flex-1 py-2 rounded-xl bg-primary text-white text-xs font-bold disabled:opacity-60 transition-opacity">
                  {saving ? "…" : "Accept all"}
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function useConsentManager() {
  const getConsent = (): ConsentState | null => getStoredConsent();
  const hasConsented = (type: keyof Omit<ConsentState, "decided">): boolean => {
    const s = getStoredConsent();
    if (!s) return false;
    return !!s[type];
  };
  const resetConsent = () => {
    localStorage.removeItem(CONSENT_KEY);
    window.location.reload();
  };
  return { getConsent, hasConsented, resetConsent };
}
