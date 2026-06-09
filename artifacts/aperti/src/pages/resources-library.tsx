import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Library, Search, Filter, FileText, Video, BookOpen, Download,
  CheckCircle, Clock, Eye, Star, Upload, Plus, Grid, List,
  ExternalLink, Tag, Shield,
} from "lucide-react";

const API = "/api";
const token = () => localStorage.getItem("aperti_token");
async function fetchJSON(url: string, opts?: RequestInit) {
  const res = await fetch(`${API}${url}`, {
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...(opts?.headers ?? {}) },
    ...opts,
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

const TYPE_ICONS: Record<string, any> = {
  pdf: FileText, video: Video, worksheet: FileText, notes: BookOpen,
  presentation: FileText, link: ExternalLink, image: FileText,
};
const TYPE_COLORS: Record<string, string> = {
  pdf: "bg-red-100 text-red-700", video: "bg-purple-100 text-purple-700",
  worksheet: "bg-amber-100 text-amber-700", notes: "bg-blue-100 text-blue-700",
  presentation: "bg-orange-100 text-orange-700", link: "bg-green-100 text-green-700",
};

function ResourceCard({ resource, isAdmin, onApprove }: { resource: any; isAdmin: boolean; onApprove?: () => void }) {
  const Icon = TYPE_ICONS[resource.type] || FileText;
  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white border border-gray-100 rounded-xl p-5 hover:border-teal-200 hover:shadow-sm transition-all group">
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${TYPE_COLORS[resource.type] || "bg-gray-100 text-gray-600"}`}>
          <Icon size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-semibold text-gray-800 text-sm leading-tight">{resource.title}</h3>
            {resource.approval_status === "approved" && (
              <Shield size={14} className="text-green-500 shrink-0 mt-0.5" title="Approved" />
            )}
          </div>
          {resource.description && <p className="text-xs text-gray-500 line-clamp-2 mb-3">{resource.description}</p>}
          <div className="flex flex-wrap gap-2 mb-3">
            {resource.type && <Badge className={`text-xs ${TYPE_COLORS[resource.type] || "bg-gray-100 text-gray-600"}`}>{resource.type}</Badge>}
            {resource.subject_name && <Badge className="text-xs bg-teal-100 text-teal-700">{resource.subject_name}</Badge>}
            {resource.version > 1 && <Badge variant="outline" className="text-xs">v{resource.version}</Badge>}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-gray-400">
              {resource.author_name && <span>{resource.author_name}</span>}
              {resource.published_at && <span className="flex items-center gap-1"><Clock size={11} />{new Date(resource.published_at).toLocaleDateString()}</span>}
            </div>
            <div className="flex gap-2">
              {isAdmin && resource.approval_status !== "approved" && (
                <Button size="sm" className="h-6 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={onApprove}>
                  <CheckCircle size={11} className="mr-1" /> Approve
                </Button>
              )}
              {resource.file_url && (
                <Button size="sm" variant="outline" className="h-6 text-xs" asChild>
                  <a href={resource.file_url} target="_blank" rel="noopener noreferrer"><Download size={11} className="mr-1" /> Open</a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function ResourcesLibrary() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [approvalFilter, setApprovalFilter] = useState("approved");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const userRole = (() => { try { const t = localStorage.getItem("aperti_token"); if (!t) return "student"; const p = JSON.parse(atob(t.split(".")[1])); return p.role || "student"; } catch { return "student"; } })();
  const isAdmin = ["admin", "teacher"].includes(userRole);

  const { data: resources, isLoading } = useQuery({
    queryKey: ["resources-library", search, typeFilter, subjectFilter, approvalFilter],
    queryFn: () => {
      const p = new URLSearchParams();
      if (search) p.set("search", search);
      if (typeFilter !== "all") p.set("type", typeFilter);
      if (subjectFilter !== "all") p.set("subject", subjectFilter);
      p.set("approval", approvalFilter);
      return fetchJSON(`/resources/library?${p.toString()}`);
    },
  });

  const { data: subjects } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => fetchJSON("/subjects"),
  });

  const approveResource = useMutation({
    mutationFn: (id: number) => fetchJSON(`/resources/${id}/approve`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["resources-library"] }),
  });

  const typeCounts = (resources || []).reduce((acc: any, r: any) => { acc[r.type] = (acc[r.type] || 0) + 1; return acc; }, {});

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3"><Library className="text-teal-600" size={28} /> Resource Library</h1>
            <p className="text-gray-500 mt-1">Curated, approved educational resources for every subject</p>
          </div>
          {isAdmin && (
            <div className="flex gap-3">
              <Select value={approvalFilter} onValueChange={setApprovalFilter}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="draft">Drafts</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </motion.div>

        {/* Type chips */}
        <div className="flex gap-2 flex-wrap">
          {["all", "pdf", "video", "worksheet", "notes", "presentation"].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-4 py-2 rounded-full text-xs font-semibold border transition-all ${typeFilter === t ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-600 border-gray-200 hover:border-teal-300"}`}>
              {t === "all" ? `All (${(resources || []).length})` : `${t.charAt(0).toUpperCase() + t.slice(1)} ${typeCounts[t] ? `(${typeCounts[t]})` : ""}`}
            </button>
          ))}
        </div>

        {/* Search + filters row */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search resources..." className="pl-9 bg-white" />
          </div>
          <Select value={subjectFilter} onValueChange={setSubjectFilter}>
            <SelectTrigger className="w-44 bg-white"><SelectValue placeholder="All Subjects" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {(subjects || []).map((s: any) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex border border-gray-200 rounded-lg overflow-hidden bg-white">
            <button onClick={() => setViewMode("grid")} className={`px-3 py-2 transition-colors ${viewMode === "grid" ? "bg-teal-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}><Grid size={15} /></button>
            <button onClick={() => setViewMode("list")} className={`px-3 py-2 transition-colors ${viewMode === "list" ? "bg-teal-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}><List size={15} /></button>
          </div>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className={`grid gap-4 ${viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"}`}>
            {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
          </div>
        ) : (resources || []).length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Library size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">No resources found</p>
            <p className="text-sm mt-1">Try adjusting your filters or search terms</p>
          </div>
        ) : (
          <div className={`grid gap-4 ${viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"}`}>
            <AnimatePresence>
              {(resources || []).map((r: any) => (
                <ResourceCard key={r.id} resource={r} isAdmin={isAdmin}
                  onApprove={() => approveResource.mutate(r.id)} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
