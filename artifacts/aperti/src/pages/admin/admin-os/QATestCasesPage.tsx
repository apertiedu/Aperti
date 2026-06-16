import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { FlaskConical, Play, CheckCircle, XCircle, Clock, SkipForward, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const api = (path: string, opts?: RequestInit) =>
  fetch(path, { ...opts, credentials: "include", headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) } });

const STATUS_STYLES: Record<string, { icon: any; label: string; cls: string }> = {
  pending: { icon: Clock,        label: "Pending", cls: "text-gray-500 bg-gray-50 border-gray-200" },
  passed:  { icon: CheckCircle,  label: "Passed",  cls: "text-green-700 bg-green-50 border-green-200" },
  failed:  { icon: XCircle,      label: "Failed",  cls: "text-red-700 bg-red-50 border-red-200" },
  skipped: { icon: SkipForward,  label: "Skipped", cls: "text-yellow-700 bg-yellow-50 border-yellow-200" },
};

const CATEGORIES = ["functional","role","permission","ui","api","performance","security","accessibility"];

export default function QATestCasesPage() {
  const qc = useQueryClient();
  const [expandedCat, setExpandedCat] = useState<string | null>("api");
  const [showNew, setShowNew] = useState(false);
  const [sanityResult, setSanityResult] = useState<any>(null);
  const [newForm, setNewForm] = useState({ title: "", description: "", category: "functional", linkedModule: "" });

  const { data: testCases = [], isLoading } = useQuery({
    queryKey: ["admin-test-cases"],
    queryFn: () => api("/api/admin/test-cases").then(r => r.json()),
  });

  const updateCase = useMutation({
    mutationFn: ({ id, status }: any) => api(`/api/admin/test-cases/${id}`, { method: "PUT", body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-test-cases"] }),
  });

  const createCase = useMutation({
    mutationFn: (data: any) => api("/api/admin/test-cases", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-test-cases"] }); setShowNew(false); },
  });

  const runSanity = useMutation({
    mutationFn: () => api("/api/admin/tests/run-sanity", { method: "POST" }).then(r => r.json()),
    onSuccess: (data) => { setSanityResult(data); qc.invalidateQueries({ queryKey: ["admin-test-cases"] }); qc.invalidateQueries({ queryKey: ["admin-test-runs"] }); },
  });

  const grouped = CATEGORIES.reduce<Record<string, any[]>>((acc, cat) => {
    acc[cat] = testCases.filter((tc: any) => tc.category === cat);
    return acc;
  }, {});

  const total = testCases.length;
  const passed = testCases.filter((t: any) => t.status === "passed").length;
  const failed = testCases.filter((t: any) => t.status === "failed").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FlaskConical className="w-6 h-6 text-primary" /> Test Cases
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage and execute test suites</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowNew(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Add Case
          </Button>
          <Button
            onClick={() => runSanity.mutate()}
            disabled={runSanity.isPending}
            className="bg-primary hover:bg-primary/80 gap-2"
          >
            <Play className="w-4 h-4" />
            {runSanity.isPending ? "Running…" : "Run Sanity Tests"}
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total", value: total, cls: "text-gray-900" },
          { label: "Passed", value: passed, cls: "text-green-700" },
          { label: "Failed", value: failed, cls: "text-red-700" },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="p-4 text-center">
              <p className={`text-3xl font-bold ${s.cls}`}>{s.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
          <div className="bg-green-500 h-full transition-all" style={{ width: `${(passed / total) * 100}%` }} />
          <div className="bg-red-400 h-full transition-all" style={{ width: `${(failed / total) * 100}%` }} />
        </div>
      )}

      {/* Sanity test results */}
      {sanityResult && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-primary/25 bg-primary/8 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-semibold text-foreground">Sanity Test Results</p>
                <div className="flex gap-3 text-sm">
                  <span className="text-green-700 font-medium">✓ {sanityResult.passed} passed</span>
                  <span className="text-red-700 font-medium">✗ {sanityResult.failed} failed</span>
                  <span className="text-gray-600">{sanityResult.coverage}% coverage</span>
                </div>
              </div>
              <div className="space-y-1">
                {sanityResult.results?.map((r: any) => (
                  <div key={r.id} className="flex items-center gap-3 text-xs">
                    {r.passed
                      ? <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      : <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                    <span className={r.passed ? "text-gray-700" : "text-red-700 font-medium"}>{r.name}</span>
                    <span className="ml-auto text-gray-400">HTTP {r.actualStatus}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Grouped test cases */}
      {isLoading ? (
        <div className="text-center text-sm text-gray-400 py-8">Loading test cases…</div>
      ) : (
        <div className="space-y-3">
          {CATEGORIES.map(cat => {
            const cases = grouped[cat] ?? [];
            const isOpen = expandedCat === cat;
            const catPassed = cases.filter(c => c.status === "passed").length;
            const catFailed = cases.filter(c => c.status === "failed").length;

            return (
              <Card key={cat} className="border-0 shadow-sm overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors text-left"
                  onClick={() => setExpandedCat(isOpen ? null : cat)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-900 capitalize">{cat}</span>
                    <span className="text-xs text-gray-400">{cases.length} test{cases.length !== 1 ? "s" : ""}</span>
                    {catPassed > 0 && <span className="text-xs text-green-600 font-medium">✓ {catPassed}</span>}
                    {catFailed > 0 && <span className="text-xs text-red-600 font-medium">✗ {catFailed}</span>}
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100 divide-y divide-gray-50">
                    {cases.length === 0 ? (
                      <p className="px-5 py-3 text-sm text-gray-400 italic">No test cases in this category yet.</p>
                    ) : cases.map((tc: any, i: number) => {
                      const sts = STATUS_STYLES[tc.status] ?? STATUS_STYLES.pending;
                      const Icon = sts.icon;
                      return (
                        <motion.div
                          key={tc.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.02 }}
                          className="flex items-center gap-4 px-5 py-3"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{tc.title}</p>
                            {tc.notes && <p className="text-xs text-gray-400 mt-0.5 truncate">{tc.notes}</p>}
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-green-700 hover:bg-green-50"
                              onClick={() => updateCase.mutate({ id: tc.id, status: "passed" })}
                              disabled={tc.status === "passed"}
                            >✓ Pass</Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-red-700 hover:bg-red-50"
                              onClick={() => updateCase.mutate({ id: tc.id, status: "failed" })}
                              disabled={tc.status === "failed"}
                            >✗ Fail</Button>
                          </div>
                          <Badge className={`border text-xs shrink-0 ${sts.cls}`}>
                            <Icon className="w-3 h-3 mr-1" />{sts.label}
                          </Badge>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* New test case modal */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Test Case</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input value={newForm.title} onChange={e => setNewForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Login with valid credentials" className="mt-1" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={newForm.description} onChange={e => setNewForm(p => ({ ...p, description: e.target.value }))} rows={2} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select value={newForm.category} onValueChange={v => setNewForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Module</Label>
                <Input value={newForm.linkedModule} onChange={e => setNewForm(p => ({ ...p, linkedModule: e.target.value }))} placeholder="e.g. auth" className="mt-1" />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={() => createCase.mutate(newForm)} disabled={!newForm.title || createCase.isPending} className="bg-primary hover:bg-primary/80 flex-1">
                {createCase.isPending ? "Adding…" : "Add Test Case"}
              </Button>
              <Button variant="outline" onClick={() => setShowNew(false)} className="flex-1">Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
