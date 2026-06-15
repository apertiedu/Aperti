import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { fetchJSON } from "@/lib/api";
import { toast } from "sonner";
import {
  Save, Eye, RotateCcw, Globe, LayoutTemplate, Star, BarChart3,
  CheckSquare, Type, Megaphone, Layers, Plus, Trash2, GripVertical,
} from "lucide-react";

const INPUT = "w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 bg-white transition-colors";
const LABEL = "block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide";

const SECTION_TABS = [
  { id: "hero",     label: "Hero",         icon: Megaphone },
  { id: "features", label: "Features",     icon: Layers },
  { id: "trust",    label: "Trust Badges", icon: Star },
  { id: "stats",    label: "Statistics",   icon: BarChart3 },
  { id: "footer",   label: "Footer",       icon: LayoutTemplate },
  { id: "visibility",label: "Visibility",  icon: CheckSquare },
] as const;

type Tab = typeof SECTION_TABS[number]["id"];

const ICON_OPTIONS = [
  "BarChart3","BookOpen","Brain","CheckSquare","MessageSquare","Zap","Shield","Globe",
  "Users","Star","Award","TrendingUp","Layers","FileText","Cpu","Clock",
];

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0 cursor-pointer group">
      <span className="text-sm text-gray-700 font-medium group-hover:text-gray-900 transition-colors">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${value ? "bg-teal-500" : "bg-gray-200"}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${value ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </label>
  );
}

export default function LandingSettingsEditorPage() {
  const [tab, setTab] = useState<Tab>("hero");
  const [form, setForm] = useState<Record<string, any>>({});
  const [dirty, setDirty] = useState(false);

  const { data: settings, isLoading } = useQuery<Record<string, any>>({
    queryKey: ["landing-settings"],
    queryFn: () => fetchJSON("/api/landing-settings"),
  });

  useEffect(() => {
    if (settings) { setForm(settings); setDirty(false); }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await fetch("/api/landing-settings", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Save failed");
      return res.json();
    },
    onSuccess: () => { toast.success("Landing page updated — changes are live"); setDirty(false); },
    onError: () => toast.error("Failed to save settings"),
  });

  function set(key: string, value: any) {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  }

  function setFeature(index: number, field: string, value: string) {
    const features = [...(form.features || [])];
    features[index] = { ...features[index], [field]: value };
    set("features", features);
  }

  function addFeature() {
    set("features", [...(form.features || []), { icon: "Star", title: "", desc: "" }]);
  }

  function removeFeature(index: number) {
    const features = [...(form.features || [])];
    features.splice(index, 1);
    set("features", features);
  }

  function setBadge(index: number, value: string) {
    const badges = [...(form.trust_badges || [])];
    badges[index] = value;
    set("trust_badges", badges);
  }

  function addBadge() {
    set("trust_badges", [...(form.trust_badges || []), ""]);
  }

  function removeBadge(index: number) {
    const badges = [...(form.trust_badges || [])];
    badges.splice(index, 1);
    set("trust_badges", badges);
  }

  if (isLoading) return (
    <div className="space-y-4">
      {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Landing Page Editor</h1>
          <p className="text-sm text-gray-500 mt-0.5">Edit all landing page content without writing code — changes go live instantly</p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50 transition-colors"
          >
            <Eye className="w-4 h-4" /> Preview
          </a>
          <button
            onClick={() => { setForm(settings || {}); setDirty(false); }}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-xl hover:bg-gray-50 transition-colors"
            disabled={!dirty}
          >
            <RotateCcw className="w-4 h-4" /> Reset
          </button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => saveMutation.mutate(form)}
            disabled={!dirty || saveMutation.isPending}
            className="flex items-center gap-2 px-5 py-2 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            {saveMutation.isPending ? "Saving…" : "Save Changes"}
          </motion.button>
        </div>
      </div>

      {dirty && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3 text-sm text-amber-800">
          <Globe className="w-4 h-4 text-amber-600 flex-shrink-0" />
          You have unsaved changes. Click "Save Changes" to publish them to the live landing page.
        </motion.div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {SECTION_TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-all ${tab === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}
        className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">

        {/* ── Hero ── */}
        {tab === "hero" && (
          <>
            <Section title="Main Headline" desc="The primary headline shown at the top of the hero section">
              <div>
                <label className={LABEL}>Headline (Part 1)</label>
                <input className={INPUT} value={form.hero_headline || ""} onChange={(e) => set("hero_headline", e.target.value)} placeholder="Run your entire teaching operation" />
              </div>
              <div>
                <label className={LABEL}>Headline Accent (Part 2 — highlighted in teal)</label>
                <input className={INPUT} value={form.hero_headline_accent || ""} onChange={(e) => set("hero_headline_accent", e.target.value)} placeholder="from one screen." />
              </div>
              <div>
                <label className={LABEL}>Subheadline</label>
                <textarea className={`${INPUT} resize-none`} rows={3} value={form.hero_subheadline || ""} onChange={(e) => set("hero_subheadline", e.target.value)} placeholder="Supporting description text below the headline..." />
              </div>
            </Section>

            <Section title="Call-to-Action Buttons" desc="The two buttons in the hero section">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>Primary CTA Text</label>
                  <input className={INPUT} value={form.hero_cta_primary || ""} onChange={(e) => set("hero_cta_primary", e.target.value)} placeholder="Get Started Free" />
                </div>
                <div>
                  <label className={LABEL}>Secondary CTA Text</label>
                  <input className={INPUT} value={form.hero_cta_secondary || ""} onChange={(e) => set("hero_cta_secondary", e.target.value)} placeholder="See How It Works" />
                </div>
              </div>
            </Section>

            <Section title="Statistics Bar" desc="The key numbers displayed below the hero">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={LABEL}>Stat 1 Label</label>
                  <input className={INPUT} value={form.stat1_label || ""} onChange={(e) => set("stat1_label", e.target.value)} placeholder="Students Enrolled" />
                </div>
                <div>
                  <label className={LABEL}>Stat 2 Label</label>
                  <input className={INPUT} value={form.stat2_label || ""} onChange={(e) => set("stat2_label", e.target.value)} placeholder="Active Teachers" />
                </div>
                <div>
                  <label className={LABEL}>Stat 3 Label</label>
                  <input className={INPUT} value={form.stat3_label || ""} onChange={(e) => set("stat3_label", e.target.value)} placeholder="Subjects Covered" />
                </div>
                <div>
                  <label className={LABEL}>Stat 4 Label</label>
                  <input className={INPUT} value={form.stat4_label || ""} onChange={(e) => set("stat4_label", e.target.value)} placeholder="Avg. Grade Improvement" />
                </div>
              </div>
            </Section>
          </>
        )}

        {/* ── Features ── */}
        {tab === "features" && (
          <Section title="Feature Cards" desc="The feature cards shown in the features section of the landing page">
            <div className="space-y-4">
              {(form.features || []).map((feat: any, i: number) => (
                <motion.div key={i} layout className="border border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <GripVertical className="w-4 h-4 text-gray-300" />
                      Feature {i + 1}
                    </div>
                    <button onClick={() => removeFeature(i)} className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className={LABEL}>Icon Name</label>
                      <select
                        className={INPUT}
                        value={feat.icon || "Star"}
                        onChange={(e) => setFeature(i, "icon", e.target.value)}
                      >
                        {ICON_OPTIONS.map((ico) => <option key={ico} value={ico}>{ico}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={LABEL}>Title</label>
                      <input className={INPUT} value={feat.title || ""} onChange={(e) => setFeature(i, "title", e.target.value)} placeholder="Feature Name" />
                    </div>
                    <div className="col-span-1">
                      <label className={LABEL}>Tag/Subtitle</label>
                      <input className={INPUT} value={feat.tag || ""} onChange={(e) => setFeature(i, "tag", e.target.value)} placeholder="e.g. AI-powered" />
                    </div>
                  </div>
                  <div>
                    <label className={LABEL}>Description</label>
                    <textarea className={`${INPUT} resize-none`} rows={2} value={feat.desc || ""} onChange={(e) => setFeature(i, "desc", e.target.value)} placeholder="Feature description..." />
                  </div>
                </motion.div>
              ))}
              <button
                onClick={addFeature}
                className="flex items-center gap-2 w-full px-4 py-3 border-2 border-dashed border-gray-200 text-gray-500 text-sm rounded-xl hover:border-teal-400 hover:text-teal-600 transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Feature Card
              </button>
            </div>
          </Section>
        )}

        {/* ── Trust ── */}
        {tab === "trust" && (
          <Section title="Trust Badges" desc="Short trust indicators shown below the hero (e.g. 'GDPR-compliant', 'No lock-in')">
            <div className="space-y-2">
              {(form.trust_badges || []).map((badge: string, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    className={INPUT}
                    value={badge}
                    onChange={(e) => setBadge(i, e.target.value)}
                    placeholder={`Trust badge ${i + 1}`}
                  />
                  <button onClick={() => removeBadge(i)} className="p-2 text-gray-400 hover:text-red-500 rounded transition-colors flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={addBadge}
                className="flex items-center gap-2 w-full px-4 py-3 border-2 border-dashed border-gray-200 text-gray-500 text-sm rounded-xl hover:border-teal-400 hover:text-teal-600 transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Trust Badge
              </button>
            </div>
          </Section>
        )}

        {/* ── Stats ── */}
        {tab === "stats" && (
          <Section title="Marketing Statistics" desc="Custom statistics shown on the landing page (separate from live platform stats)">
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: "stat_students_label", placeholder: "Students label" },
                { key: "stat_students_value", placeholder: "e.g. 2,400+" },
                { key: "stat_teachers_label", placeholder: "Teachers label" },
                { key: "stat_teachers_value", placeholder: "e.g. 180+" },
                { key: "stat_subjects_label", placeholder: "Subjects label" },
                { key: "stat_subjects_value", placeholder: "e.g. 40+" },
                { key: "stat_extra_label",    placeholder: "Custom stat label" },
                { key: "stat_extra_value",    placeholder: "e.g. 98% satisfaction" },
              ].map(({ key, placeholder }) => (
                <div key={key}>
                  <label className={LABEL}>{key.replace(/_/g," ").replace("stat ","").replace(" label"," Label").replace(" value"," Value")}</label>
                  <input className={INPUT} value={form[key] || ""} onChange={(e) => set(key, e.target.value)} placeholder={placeholder} />
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* ── Footer ── */}
        {tab === "footer" && (
          <Section title="Footer Content" desc="Text and links shown in the site footer">
            <div>
              <label className={LABEL}>Footer Tagline</label>
              <input className={INPUT} value={form.footer_tagline || ""} onChange={(e) => set("footer_tagline", e.target.value)} placeholder="The intelligent educational platform for modern classrooms." />
            </div>
            <div>
              <label className={LABEL}>Copyright Text</label>
              <input className={INPUT} value={form.footer_copyright || ""} onChange={(e) => set("footer_copyright", e.target.value)} placeholder="© 2025 Aperti. All rights reserved." />
            </div>
            <div>
              <label className={LABEL}>Contact Email</label>
              <input className={INPUT} value={form.footer_email || ""} onChange={(e) => set("footer_email", e.target.value)} placeholder="support@aperti.app" />
            </div>
            <div>
              <label className={LABEL}>Social Link — X/Twitter</label>
              <input className={INPUT} value={form.footer_twitter || ""} onChange={(e) => set("footer_twitter", e.target.value)} placeholder="https://twitter.com/apertiapp" />
            </div>
            <div>
              <label className={LABEL}>Social Link — LinkedIn</label>
              <input className={INPUT} value={form.footer_linkedin || ""} onChange={(e) => set("footer_linkedin", e.target.value)} placeholder="https://linkedin.com/company/aperti" />
            </div>
          </Section>
        )}

        {/* ── Visibility ── */}
        {tab === "visibility" && (
          <Section title="Section Visibility" desc="Show or hide entire sections of the landing page without deleting content">
            <div className="divide-y divide-gray-100">
              <Toggle value={form.show_stats ?? true} onChange={(v) => set("show_stats", v)} label="Statistics / Metrics Bar" />
              <Toggle value={form.show_pricing ?? true} onChange={(v) => set("show_pricing", v)} label="Pricing Section" />
              <Toggle value={form.show_testimonials ?? true} onChange={(v) => set("show_testimonials", v)} label="Testimonials Section" />
              <Toggle value={form.show_marketplace ?? true} onChange={(v) => set("show_marketplace", v)} label="Marketplace / Course Gallery" />
              <Toggle value={form.show_early_access ?? true} onChange={(v) => set("show_early_access", v)} label="Early Access / Waitlist Form" />
              <Toggle value={form.show_faq ?? true} onChange={(v) => set("show_faq", v)} label="FAQ Section" />
              <Toggle value={form.show_roadmap ?? false} onChange={(v) => set("show_roadmap", v)} label="Roadmap Section" />
              <Toggle value={form.show_videos ?? false} onChange={(v) => set("show_videos", v)} label="Video / Demo Section" />
            </div>
          </Section>
        )}
      </motion.div>
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="pb-3 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}
