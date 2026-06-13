import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Building2, Settings, Trash2, Edit2, Globe } from "lucide-react";
import { fetchJSON, postJSON, putJSON } from "@/lib/api";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  suspended: "bg-red-100 text-red-700",
  trial: "bg-blue-100 text-blue-700",
  archived: "bg-gray-100 text-gray-500",
};

const ORG_TYPES = ["private_tutor", "tutoring_center", "school", "academy", "training_org", "edu_company", "custom"];

export default function OrgsPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", slug: "", type: "tutoring_center", country: "EG", language: "en", timezone: "Africa/Cairo", address: "" });
  const qc = useQueryClient();

  const { data } = useQuery({ queryKey: ["admin-orgs"], queryFn: () => fetchJSON("/api/admin/organizations?limit=100") });
  const orgs: any[] = (data as any)?.organizations || [];

  const saveMutation = useMutation({
    mutationFn: () => editing ? putJSON(`/api/admin/organizations/${editing.id}`, form) : postJSON("/api/admin/organizations", form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-orgs"] }); toast.success(editing ? "Organization updated" : "Organization created"); setShowCreate(false); setEditing(null); setForm({ name: "", slug: "", type: "tutoring_center", country: "EG", language: "en", timezone: "Africa/Cairo", address: "" }); },
    onError: () => toast.error("Save failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin/organizations/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-orgs"] }); toast.success("Organization archived"); },
    onError: () => toast.error("Delete failed"),
  });

  const openEdit = (org: any) => {
    setEditing(org);
    setForm({ name: org.name, slug: org.slug, type: org.type, country: org.country, language: org.language, timezone: org.timezone, address: org.address || "" });
    setShowCreate(true);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Organizations</h1>
          <p className="text-sm text-gray-500">{orgs.length} organizations</p>
        </div>
        <button onClick={() => { setEditing(null); setShowCreate(true); }} className="flex items-center gap-2 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors">
          <Plus className="w-4 h-4" /> Add Organization
        </button>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {orgs.map((org: any) => (
          <motion.div key={org.id} layout className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{org.name}</p>
                  <p className="text-xs text-gray-400">/{org.slug}</p>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[org.status] || "bg-gray-100 text-gray-600"}`}>{org.status}</span>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Globe className="w-3 h-3" /> {org.country} · {org.language} · {org.timezone}
              </div>
              <p className="text-xs text-gray-400 capitalize">{org.type?.replace(/_/g, " ")}</p>
            </div>

            <div className="flex gap-2">
              <button onClick={() => openEdit(org)} className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <Edit2 className="w-3 h-3" /> Edit
              </button>
              <button onClick={() => { if (confirm("Archive this organization?")) deleteMutation.mutate(org.id); }} className="p-1.5 text-red-400 border border-gray-200 rounded-lg hover:bg-red-50 hover:border-red-200 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {orgs.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No organizations yet</p>
          <button onClick={() => setShowCreate(true)} className="mt-3 text-teal-600 text-sm font-medium hover:underline">Create first organization</button>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900 mb-5">{editing ? "Edit" : "Create"} Organization</h2>
            <div className="space-y-4">
              {[
                { key: "name", label: "Organization Name", required: true },
                { key: "slug", label: "Slug (URL-safe)", required: !editing },
                { key: "address", label: "Address" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{f.label} {f.required && <span className="text-red-500">*</span>}</label>
                  <input value={(form as any)[f.key]} onChange={(e) => setForm(p => ({ ...p, [f.key]: e.target.value }))} disabled={f.key === "slug" && !!editing} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400 disabled:bg-gray-50" />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select value={form.type} onChange={(e) => setForm(p => ({ ...p, type: e.target.value }))} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400">
                  {ORG_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              {[
                { key: "country", label: "Country Code", placeholder: "EG" },
                { key: "language", label: "Language", placeholder: "en" },
                { key: "timezone", label: "Timezone", placeholder: "Africa/Cairo" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                  <input value={(form as any)[f.key]} onChange={(e) => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-teal-400" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowCreate(false); setEditing(null); }} className="flex-1 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700">Cancel</button>
              <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="flex-1 px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
                {saveMutation.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
