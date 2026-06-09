import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { fetchJSON, putJSON, postJSON } from "@/lib/api";
import { toast } from "sonner";
import { Palette, Image, Monitor, Save, Plus, Edit2 } from "lucide-react";

export default function DemoBrandingPage() {
  const qc = useQueryClient();
  const [brandingForm, setBrandingForm] = useState({
    logo_url: "", favicon_url: "", primary_color: "#0D9488",
    typography_prefs: JSON.stringify({ heading: "Inter", body: "Inter" }, null, 2),
    seasonal_theme: JSON.stringify({}, null, 2),
  });
  const [demoForm, setDemoForm] = useState({ type: "guided_tour", title: "", content: "{}", is_active: true });
  const [showDemoModal, setShowDemoModal] = useState(false);

  const { data: branding } = useQuery({ queryKey: ["admin-branding"], queryFn: () => fetchJSON("/api/admin/branding") });
  const { data: demos = [] } = useQuery({ queryKey: ["admin-demos"], queryFn: () => fetchJSON("/api/admin/demos") });

  useEffect(() => {
    if (branding) {
      setBrandingForm({
        logo_url: branding.logo_url || "",
        favicon_url: branding.favicon_url || "",
        primary_color: branding.primary_color || "#0D9488",
        typography_prefs: JSON.stringify(branding.typography_prefs || { heading: "Inter", body: "Inter" }, null, 2),
        seasonal_theme: JSON.stringify(branding.seasonal_theme || {}, null, 2),
      });
    }
  }, [branding]);

  const saveBrandingMutation = useMutation({
    mutationFn: () => {
      let tp, st;
      try { tp = JSON.parse(brandingForm.typography_prefs); } catch { tp = {}; }
      try { st = JSON.parse(brandingForm.seasonal_theme); } catch { st = {}; }
      return putJSON("/api/admin/branding", { ...brandingForm, typography_prefs: tp, seasonal_theme: st });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-branding"] }); toast.success("Branding saved"); },
    onError: () => toast.error("Save failed"),
  });

  const saveDemoMutation = useMutation({
    mutationFn: () => {
      let content;
      try { content = JSON.parse(demoForm.content); } catch { content = {}; }
      return postJSON("/api/admin/demos", { ...demoForm, content });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-demos"] }); toast.success("Demo saved"); setShowDemoModal(false); setDemoForm({ type: "guided_tour", title: "", content: "{}", is_active: true }); },
    onError: () => toast.error("Save failed"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Demo & Branding</h1>
        <p className="text-sm text-gray-500 mt-0.5">Customize platform appearance and interactive demos</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Branding Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Palette className="w-5 h-5 text-teal-600" />
            <h2 className="font-semibold text-gray-900">Branding Settings</h2>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Logo URL</label>
              <input value={brandingForm.logo_url} onChange={(e) => setBrandingForm({ ...brandingForm, logo_url: e.target.value })} placeholder="https://..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              {brandingForm.logo_url && <img src={brandingForm.logo_url} alt="Logo preview" className="mt-2 h-10 object-contain rounded border border-gray-100 p-1" onError={() => {}} />}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Favicon URL</label>
              <input value={brandingForm.favicon_url} onChange={(e) => setBrandingForm({ ...brandingForm, favicon_url: e.target.value })} placeholder="https://..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Primary Color</label>
              <div className="flex gap-3 items-center">
                <input type="color" value={brandingForm.primary_color} onChange={(e) => setBrandingForm({ ...brandingForm, primary_color: e.target.value })} className="w-12 h-10 rounded-lg border border-gray-200 cursor-pointer" />
                <input value={brandingForm.primary_color} onChange={(e) => setBrandingForm({ ...brandingForm, primary_color: e.target.value })} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Typography Preferences (JSON)</label>
              <textarea value={brandingForm.typography_prefs} onChange={(e) => setBrandingForm({ ...brandingForm, typography_prefs: e.target.value })} rows={4} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Seasonal Theme (JSON, optional)</label>
              <textarea value={brandingForm.seasonal_theme} onChange={(e) => setBrandingForm({ ...brandingForm, seasonal_theme: e.target.value })} rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
            </div>

            {/* Live preview */}
            <div className="p-3 rounded-lg border border-gray-100" style={{ backgroundColor: brandingForm.primary_color + "15" }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-md" style={{ backgroundColor: brandingForm.primary_color }} />
                <p className="text-sm font-medium" style={{ color: brandingForm.primary_color }}>Aperti.</p>
              </div>
              <button className="text-xs text-white px-3 py-1.5 rounded-lg font-medium" style={{ backgroundColor: brandingForm.primary_color }}>
                Preview Button
              </button>
            </div>

            <button onClick={() => saveBrandingMutation.mutate()} disabled={saveBrandingMutation.isPending} className="w-full flex items-center justify-center gap-2 bg-teal-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-50">
              <Save className="w-4 h-4" /> {saveBrandingMutation.isPending ? "Saving..." : "Save Branding"}
            </button>
          </div>
        </div>

        {/* Demo Configurations */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Monitor className="w-5 h-5 text-teal-600" />
              <h2 className="font-semibold text-gray-900">Demo Configurations</h2>
            </div>
            <button onClick={() => setShowDemoModal(true)} className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-700 font-medium transition-colors">
              <Plus className="w-3 h-3" /> Add Demo
            </button>
          </div>
          <div className="p-5 space-y-3">
            {demos.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <Monitor className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No demo configurations yet</p>
              </div>
            )}
            {demos.map((demo: any) => (
              <div key={demo.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg">
                <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center">
                  <Monitor className="w-4 h-4 text-teal-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{demo.title || demo.type}</p>
                  <p className="text-xs text-gray-400">{demo.type}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${demo.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {demo.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Demo Modal */}
      {showDemoModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <h3 className="font-bold text-gray-900 mb-4">Add Demo Configuration</h3>
            <div className="space-y-4">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Title</label><input value={demoForm.title} onChange={(e) => setDemoForm({ ...demoForm, title: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" /></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                <select value={demoForm.type} onChange={(e) => setDemoForm({ ...demoForm, type: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                  <option value="guided_tour">Guided Tour</option>
                  <option value="sandbox">Sandbox</option>
                  <option value="video">Video</option>
                  <option value="preview">Preview</option>
                </select>
              </div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Content (JSON)</label>
                <textarea value={demoForm.content} onChange={(e) => setDemoForm({ ...demoForm, content: e.target.value })} rows={5} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowDemoModal(false)} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={() => saveDemoMutation.mutate()} disabled={saveDemoMutation.isPending} className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
                {saveDemoMutation.isPending ? "Saving..." : "Save Demo"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
