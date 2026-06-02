import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings, Eye, Save, RotateCcw, Plus, Trash2, GripVertical, Check, X, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TEAL = "#00796B";
const token = () => localStorage.getItem("aperti_token");

async function fetchJSON(url: string, opts?: RequestInit) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...(opts?.headers as object) },
    ...opts,
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

const SECTION_TOGGLES = [
  { key: "show_pricing",       label: "Pricing Section" },
  { key: "show_marketplace",   label: "Marketplace Preview" },
  { key: "show_early_access",  label: "Early Access Form" },
  { key: "show_testimonials",  label: "Testimonials" },
  { key: "show_stats",         label: "Stats Strip" },
];

interface Settings {
  hero_headline?: string;
  hero_headline_accent?: string;
  hero_subheadline?: string;
  hero_cta_primary?: string;
  hero_cta_secondary?: string;
  trust_badges?: string[];
  show_pricing?: boolean;
  show_marketplace?: boolean;
  show_early_access?: boolean;
  show_testimonials?: boolean;
  show_stats?: boolean;
  features?: { icon: string; title: string; desc: string }[];
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/50">
        <h3 className="font-bold text-gray-800 text-sm">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function TextField({ label, value, onChange, multiline = false }: {
  label: string; value: string; onChange: (v: string) => void; multiline?: boolean;
}) {
  const cls = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#00796B]/30 focus:border-[#00796B] transition-all";
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>
      {multiline
        ? <textarea value={value} onChange={e => onChange(e.target.value)} rows={3} className={cls} />
        : <input value={value} onChange={e => onChange(e.target.value)} className={cls} />}
    </div>
  );
}

export default function LandingEditor() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dirty, setDirty] = useState(false);
  const [localSettings, setLocalSettings] = useState<Settings>({});

  const { data: settings, isLoading } = useQuery<Settings>({
    queryKey: ["landing-settings"],
    queryFn: () => fetchJSON("/api/landing-settings"),
    onSuccess: (data) => {
      if (!dirty) setLocalSettings(data);
    },
  } as any);

  const merged: Settings = { ...settings, ...localSettings };

  const setField = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setLocalSettings(p => ({ ...p, [key]: value }));
    setDirty(true);
  };

  const saveMutation = useMutation({
    mutationFn: () => fetchJSON("/api/landing-settings", {
      method: "PUT",
      body: JSON.stringify(localSettings),
    }),
    onSuccess: () => {
      toast({ title: "Landing page saved!" });
      qc.invalidateQueries({ queryKey: ["landing-settings"] });
      setDirty(false);
    },
    onError: () => toast({ title: "Save failed", variant: "destructive" }),
  });

  const resetField = () => {
    setLocalSettings({});
    setDirty(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F5F5F5" }}>
        <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: TEAL, borderTopColor: "transparent" }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#F5F5F5" }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${TEAL}15` }}>
          <Settings className="h-5 w-5" style={{ color: TEAL }} />
        </div>
        <div>
          <h1 className="font-extrabold text-gray-900">Landing Page Editor</h1>
          <p className="text-xs text-gray-400">Changes reflect live on the landing page immediately after saving.</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {dirty && (
            <span className="text-xs text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full font-medium">Unsaved changes</span>
          )}
          <button
            onClick={resetField}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
          <a href="/" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors">
            <Eye className="h-3.5 w-3.5" /> Preview <ExternalLink className="h-3 w-3" />
          </a>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!dirty || saveMutation.isPending}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-50"
            style={{ background: TEAL }}>
            <Save className="h-3.5 w-3.5" />
            {saveMutation.isPending ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 py-8 space-y-6">

        {/* Hero Copy */}
        <SectionCard title="Hero Section">
          <div className="space-y-4">
            <TextField label="Main Headline" value={merged.hero_headline ?? ""} onChange={v => setField("hero_headline", v)} />
            <TextField label="Accent Headline (teal line)" value={merged.hero_headline_accent ?? ""} onChange={v => setField("hero_headline_accent", v)} />
            <TextField label="Sub-headline" value={merged.hero_subheadline ?? ""} onChange={v => setField("hero_subheadline", v)} multiline />
            <div className="grid grid-cols-2 gap-4">
              <TextField label="Primary CTA Button" value={merged.hero_cta_primary ?? ""} onChange={v => setField("hero_cta_primary", v)} />
              <TextField label="Secondary CTA Button" value={merged.hero_cta_secondary ?? ""} onChange={v => setField("hero_cta_secondary", v)} />
            </div>
          </div>
        </SectionCard>

        {/* Trust Badges */}
        <SectionCard title="Trust Badges (below CTA buttons)">
          <div className="space-y-2">
            {(merged.trust_badges ?? []).map((badge, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={badge}
                  onChange={e => {
                    const badges = [...(merged.trust_badges ?? [])];
                    badges[i] = e.target.value;
                    setField("trust_badges", badges);
                  }}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#00796B] transition-all"
                />
                <button
                  onClick={() => {
                    const badges = (merged.trust_badges ?? []).filter((_, j) => j !== i);
                    setField("trust_badges", badges);
                  }}
                  className="text-gray-300 hover:text-red-400 transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              onClick={() => setField("trust_badges", [...(merged.trust_badges ?? []), "New badge"])}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-dashed border-gray-300 text-gray-400 hover:border-[#00796B] hover:text-[#00796B] transition-all w-full justify-center">
              <Plus className="h-3.5 w-3.5" /> Add Badge
            </button>
          </div>
        </SectionCard>

        {/* Features */}
        <SectionCard title="Feature Cards (6 slots)">
          <div className="space-y-3">
            {(merged.features ?? []).map((feat, i) => (
              <div key={i} className="grid grid-cols-3 gap-2 items-start p-3 bg-gray-50 rounded-xl">
                <input
                  value={feat.title}
                  onChange={e => {
                    const features = [...(merged.features ?? [])];
                    features[i] = { ...features[i], title: e.target.value };
                    setField("features", features);
                  }}
                  placeholder="Feature title"
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-[#00796B] transition-all"
                />
                <input
                  value={feat.desc}
                  onChange={e => {
                    const features = [...(merged.features ?? [])];
                    features[i] = { ...features[i], desc: e.target.value };
                    setField("features", features);
                  }}
                  placeholder="Description"
                  className="col-span-2 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-[#00796B] transition-all"
                />
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Section Visibility */}
        <SectionCard title="Section Visibility">
          <div className="space-y-3">
            {SECTION_TOGGLES.map(({ key, label }) => {
              const val = (merged as any)[key] !== false;
              return (
                <div key={key} className="flex items-center justify-between py-1">
                  <span className="text-sm text-gray-700 font-medium">{label}</span>
                  <button
                    onClick={() => setField(key as keyof Settings, !val as any)}
                    className={`relative w-10 h-6 rounded-full transition-all ${val ? "bg-[#00796B]" : "bg-gray-200"}`}>
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${val ? "left-5" : "left-1"}`} />
                  </button>
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* Color note */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-700">
          <strong>Note:</strong> Color palette changes (custom branding) are available in the Enterprise plan.
          The platform uses teal <code className="bg-amber-100 px-1 rounded">#00796B</code> as the primary accent throughout.
        </div>
      </div>
    </div>
  );
}
