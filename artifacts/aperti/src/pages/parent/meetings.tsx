import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Plus, Clock, CheckCircle2, XCircle, AlertCircle, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const authFetch = (url: string, opts?: RequestInit) =>
  fetch(url, { ...opts, credentials: "include", headers: { "Content-Type": "application/json", ...(opts?.headers || {}) } });

function statusConfig(status: string) {
  switch (status) {
    case "confirmed": return { color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 };
    case "canceled": return { color: "bg-red-100 text-red-700", icon: XCircle };
    default: return { color: "bg-amber-100 text-amber-700", icon: AlertCircle };
  }
}

export default function ParentMeetings() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ teacherId: "", title: "", date: "", time: "", notes: "" });

  const { data: meetings = [], isLoading } = useQuery<any[]>({
    queryKey: ["parent-meetings"],
    queryFn: () => authFetch("/api/parent/meetings").then(r => r.json()),
  });

  const { data: teachers = [] } = useQuery<any[]>({
    queryKey: ["parent-teachers"],
    queryFn: () => authFetch("/api/parent/teachers").then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: () => authFetch("/api/parent/meetings", { method: "POST", body: JSON.stringify({ ...form, teacherId: parseInt(form.teacherId) }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parent-meetings"] });
      toast({ title: "Meeting requested ✅" });
      setShowNew(false);
      setForm({ teacherId: "", title: "", date: "", time: "", notes: "" });
    },
    onError: () => toast({ title: "Failed to request meeting", variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => authFetch(`/api/parent/meetings/${id}`, { method: "PUT", body: JSON.stringify({ status: "canceled" }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["parent-meetings"] }); toast({ title: "Meeting canceled" }); },
  });

  const upcoming = meetings.filter(m => m.status !== "canceled" && new Date(m.date) >= new Date(new Date().toDateString()));
  const past = meetings.filter(m => new Date(m.date) < new Date(new Date().toDateString()) || m.status === "canceled");

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary/8">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900">Meetings</h1>
            <p className="text-sm text-gray-500">Schedule & manage teacher meetings</p>
          </div>
        </div>
        <Button onClick={() => setShowNew(true)} className="gap-2 rounded-xl text-sm text-white" className="bg-primary text-primary-foreground">
          <Plus className="h-4 w-4" /> Request Meeting
        </Button>
      </motion.div>

      {isLoading ? (
        <div className="space-y-3">{[0,1,2].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Upcoming</h2>
              <div className="space-y-3">
                {upcoming.map((m, i) => {
                  const cfg = statusConfig(m.status);
                  const StatusIcon = cfg.icon;
                  return (
                    <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                      <Card className="border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
                                <Calendar className="h-4.5 w-4.5 text-primary" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{m.title}</p>
                                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                  <User className="h-3 w-3" />{m.teacher_name}
                                </p>
                                <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                                  <Clock className="h-3 w-3" />
                                  {new Date(m.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} at {m.time}
                                </p>
                                {m.notes && <p className="text-[10px] text-gray-400 mt-1 italic">{m.notes}</p>}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2 shrink-0">
                              <Badge className={`text-[10px] rounded-full flex items-center gap-1 ${cfg.color}`}>
                                <StatusIcon className="h-3 w-3" />{m.status}
                              </Badge>
                              {m.status === "requested" && (
                                <Button variant="ghost" size="sm" className="h-6 text-[10px] text-red-500 hover:bg-red-50" onClick={() => cancelMutation.mutate(m.id)}>Cancel</Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Past</h2>
              <div className="space-y-2 opacity-70">
                {past.slice(0, 5).map((m) => (
                  <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
                    <Calendar className="h-4 w-4 text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-700 truncate">{m.title}</p>
                      <p className="text-[10px] text-gray-400">{m.teacher_name} · {new Date(m.date).toLocaleDateString("en-GB")}</p>
                    </div>
                    <Badge className={`text-[9px] rounded-full ${statusConfig(m.status).color}`}>{m.status}</Badge>
                  </div>
                ))}
              </div>
            </section>
          )}

          {!meetings.length && (
            <div className="text-center py-16">
              <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-200" />
              <p className="text-gray-400 text-sm">No meetings scheduled yet</p>
              <Button onClick={() => setShowNew(true)} className="mt-4 gap-2 rounded-xl text-white" className="bg-primary text-primary-foreground">
                <Plus className="h-4 w-4" /> Request your first meeting
              </Button>
            </div>
          )}
        </>
      )}

      {/* New Meeting Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Request a Meeting</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Teacher</label>
              <Select value={form.teacherId} onValueChange={v => setForm(f => ({ ...f, teacherId: v }))}>
                <SelectTrigger className="rounded-xl text-sm"><SelectValue placeholder="Select a teacher" /></SelectTrigger>
                <SelectContent>
                  {teachers.map((t: any) => <SelectItem key={t.id} value={String(t.id)}>{t.display_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Meeting title</label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g., Progress review" className="rounded-xl text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Date</label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="rounded-xl text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1.5 block">Time</label>
                <Input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} className="rounded-xl text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">Notes (optional)</label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="What would you like to discuss?" className="rounded-xl text-sm" />
            </div>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!form.teacherId || !form.title || !form.date || !form.time || createMutation.isPending}
              className="w-full rounded-xl text-white"
              className="bg-primary text-primary-foreground"
            >
              {createMutation.isPending ? "Requesting…" : "Request Meeting"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
