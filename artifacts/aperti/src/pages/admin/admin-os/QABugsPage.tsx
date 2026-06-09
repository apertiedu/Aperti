import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Bug, Plus, Filter, X, AlertTriangle, CheckCircle, Clock, User, ChevronDown, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const tok = () => localStorage.getItem("aperti_token") || "";
const api = (path: string, opts?: RequestInit) =>
  fetch(path, { ...opts, headers: { Authorization: `Bearer ${tok()}`, "Content-Type": "application/json", ...(opts?.headers ?? {}) } });

const SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: "Critical", color: "text-red-700",    bg: "bg-red-100 border-red-200" },
  high:     { label: "High",     color: "text-orange-700", bg: "bg-orange-100 border-orange-200" },
  medium:   { label: "Medium",   color: "text-yellow-700", bg: "bg-yellow-100 border-yellow-200" },
  low:      { label: "Low",      color: "text-blue-700",   bg: "bg-blue-100 border-blue-200" },
};

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  reported:    { label: "Reported",    icon: AlertTriangle, color: "text-gray-500" },
  triaged:     { label: "Triaged",     icon: Filter,        color: "text-blue-500" },
  in_progress: { label: "In Progress", icon: RefreshCw,     color: "text-yellow-500" },
  testing:     { label: "Testing",     icon: Clock,         color: "text-purple-500" },
  resolved:    { label: "Resolved",    icon: CheckCircle,   color: "text-green-500" },
  closed:      { label: "Closed",      icon: X,             color: "text-gray-400" },
};

const MODULES = ["auth","students","subjects","attendance","exams","assessment","liveclass","billing","ai","notifications","gradebook","homework","resources","dashboard","ui","api","other"];

export default function QABugsPage() {
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [selectedBug, setSelectedBug] = useState<any>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", stepsToReproduce: "", severity: "medium", module: "" });
  const [editStatus, setEditStatus] = useState("");

  const params = new URLSearchParams();
  if (filterStatus !== "all") params.set("status", filterStatus);
  if (filterSeverity !== "all") params.set("severity", filterSeverity);

  const { data: bugs = [], isLoading } = useQuery({
    queryKey: ["admin-bugs", filterStatus, filterSeverity],
    queryFn: () => api(`/api/admin/bugs?${params}`).then(r => r.json()),
  });

  const { data: stats } = useQuery({
    queryKey: ["admin-bug-stats"],
    queryFn: () => api("/api/admin/bugs/stats").then(r => r.json()),
  });

  const createBug = useMutation({
    mutationFn: (data: any) => api("/api/admin/bugs", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-bugs"] }); qc.invalidateQueries({ queryKey: ["admin-bug-stats"] }); setShowNew(false); setForm({ title: "", description: "", stepsToReproduce: "", severity: "medium", module: "" }); },
  });

  const updateBug = useMutation({
    mutationFn: ({ id, ...data }: any) => api(`/api/admin/bugs/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-bugs"] }); qc.invalidateQueries({ queryKey: ["admin-bug-stats"] }); setSelectedBug(null); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Bug className="w-6 h-6 text-teal-600" /> Bug Tracker
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Track and manage platform issues</p>
        </div>
        <Button onClick={() => setShowNew(true)} className="bg-teal-600 hover:bg-teal-700 gap-2">
          <Plus className="w-4 h-4" /> Report Bug
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {["critical","high","medium","low"].map(sev => {
            const c = stats.bySeverity?.find((s: any) => s.severity === sev);
            const cfg = SEVERITY_CONFIG[sev];
            return (
              <motion.div key={sev} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Card className={`border ${cfg.bg}`}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="text-2xl font-bold text-gray-900">{c?.count ?? 0}</div>
                    <Badge className={`${cfg.bg} ${cfg.color} border text-xs`}>{cfg.label}</Badge>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 flex flex-wrap gap-3">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40 h-8 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([k,v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterSeverity} onValueChange={setFilterSeverity}>
            <SelectTrigger className="w-36 h-8 text-sm"><SelectValue placeholder="Severity" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              {Object.entries(SEVERITY_CONFIG).map(([k,v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {(filterStatus !== "all" || filterSeverity !== "all") && (
            <Button variant="ghost" size="sm" onClick={() => { setFilterStatus("all"); setFilterSeverity("all"); }} className="h-8 text-gray-500">
              <X className="w-3 h-3 mr-1" /> Clear
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Bug List */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-gray-700">{bugs.length} Bug{bugs.length !== 1 ? "s" : ""} Found</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-gray-400">Loading bugs…</div>
          ) : bugs.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">No bugs found. The platform is clean! 🎉</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {bugs.map((bug: any, i: number) => {
                const sev = SEVERITY_CONFIG[bug.severity] ?? SEVERITY_CONFIG.medium;
                const sta = STATUS_CONFIG[bug.status] ?? STATUS_CONFIG.reported;
                const StaIcon = sta.icon;
                return (
                  <motion.div
                    key={bug.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => { setSelectedBug(bug); setEditStatus(bug.status); }}
                  >
                    <Badge className={`${sev.bg} ${sev.color} border text-xs shrink-0`}>{sev.label}</Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{bug.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                        {bug.module && <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{bug.module}</span>}
                        {bug.reporterName && <span>by {bug.reporterName}</span>}
                        <span>{new Date(bug.createdAt).toLocaleDateString()}</span>
                      </p>
                    </div>
                    <div className={`flex items-center gap-1.5 text-xs font-medium ${sta.color}`}>
                      <StaIcon className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">{sta.label}</span>
                    </div>
                    <ChevronDown className="w-4 h-4 text-gray-300 rotate-[-90deg]" />
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bug Detail Modal */}
      <AnimatePresence>
        {selectedBug && (
          <Dialog open onOpenChange={() => setSelectedBug(null)}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Bug className="w-4 h-4 text-teal-600" />
                  Bug #{selectedBug.id}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <p className="font-semibold text-gray-900">{selectedBug.title}</p>
                  {selectedBug.description && <p className="text-sm text-gray-600 mt-1">{selectedBug.description}</p>}
                </div>
                {selectedBug.stepsToReproduce && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Steps to Reproduce</p>
                    <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded whitespace-pre-wrap">{selectedBug.stepsToReproduce}</p>
                  </div>
                )}
                <div className="flex gap-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Severity</p>
                    <Badge className={`${SEVERITY_CONFIG[selectedBug.severity]?.bg} ${SEVERITY_CONFIG[selectedBug.severity]?.color} border`}>
                      {SEVERITY_CONFIG[selectedBug.severity]?.label}
                    </Badge>
                  </div>
                  {selectedBug.module && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Module</p>
                      <Badge variant="outline">{selectedBug.module}</Badge>
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-xs">Update Status</Label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_CONFIG).map(([k,v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={() => updateBug.mutate({ id: selectedBug.id, status: editStatus })}
                    disabled={updateBug.isPending}
                    className="bg-teal-600 hover:bg-teal-700 flex-1"
                  >
                    {updateBug.isPending ? "Saving…" : "Save Changes"}
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedBug(null)} className="flex-1">Cancel</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>

      {/* New Bug Modal */}
      <AnimatePresence>
        {showNew && (
          <Dialog open onOpenChange={() => setShowNew(false)}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Report New Bug</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Title *</Label>
                  <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Brief description" className="mt-1" />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Detailed description" rows={3} className="mt-1" />
                </div>
                <div>
                  <Label>Steps to Reproduce</Label>
                  <Textarea value={form.stepsToReproduce} onChange={e => setForm(p => ({ ...p, stepsToReproduce: e.target.value }))} placeholder="1. Go to...\n2. Click...\n3. See error" rows={3} className="mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Severity</Label>
                    <Select value={form.severity} onValueChange={v => setForm(p => ({ ...p, severity: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(SEVERITY_CONFIG).map(([k,v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Module</Label>
                    <Select value={form.module} onValueChange={v => setForm(p => ({ ...p, module: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>
                        {MODULES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={() => createBug.mutate(form)}
                    disabled={!form.title || createBug.isPending}
                    className="bg-teal-600 hover:bg-teal-700 flex-1"
                  >
                    {createBug.isPending ? "Submitting…" : "Submit Bug"}
                  </Button>
                  <Button variant="outline" onClick={() => setShowNew(false)} className="flex-1">Cancel</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </div>
  );
}
