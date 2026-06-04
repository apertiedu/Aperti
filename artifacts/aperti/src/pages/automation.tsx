import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Bot, Plus, Play, Pause, Trash2, Zap, Bell, FileText, AlertTriangle,
  Clock, ChevronDown, Settings, CheckCircle2, XCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type TaskType = "assignment" | "reminder" | "report" | "risk_check";
type Schedule = "every_minute" | "hourly" | "daily" | "weekly" | "monday";

interface AutoTask {
  id: number;
  teacher_id: number;
  type: TaskType;
  label: string;
  schedule: Schedule;
  parameters: Record<string, any>;
  enabled: boolean;
  last_run: string | null;
  run_count: number;
  created_at: string;
}

const TYPE_META: Record<TaskType, { label: string; icon: React.ReactNode; color: string; desc: string }> = {
  assignment: {
    label: "Auto-Generate Assignment",
    icon: <Zap className="w-4 h-4" />,
    color: "text-violet-500",
    desc: "Automatically generate and assign content to your class",
  },
  reminder: {
    label: "Student Reminder",
    icon: <Bell className="w-4 h-4" />,
    color: "text-amber-500",
    desc: "Send deadline or study reminders to all students",
  },
  report: {
    label: "Class Report",
    icon: <FileText className="w-4 h-4" />,
    color: "text-blue-500",
    desc: "Generate a class performance snapshot automatically",
  },
  risk_check: {
    label: "Risk Check",
    icon: <AlertTriangle className="w-4 h-4" />,
    color: "text-red-500",
    desc: "Scan for at-risk students and generate intervention alerts",
  },
};

const SCHEDULE_LABELS: Record<Schedule, string> = {
  every_minute: "Every minute (test)",
  hourly: "Every hour",
  daily: "Every day",
  weekly: "Every week",
  monday: "Every Monday",
};

function TaskCard({ task, onToggle, onDelete, onRunNow }: {
  task: AutoTask;
  onToggle: () => void;
  onDelete: () => void;
  onRunNow: () => void;
}) {
  const meta = TYPE_META[task.type];
  const lastRun = task.last_run
    ? new Date(task.last_run).toLocaleString()
    : "Never";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-card border border-border rounded-xl p-4 flex items-start gap-4 hover:border-primary/30 transition-colors"
    >
      <div className={`mt-0.5 ${meta.color}`}>{meta.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm text-foreground truncate">{task.label}</span>
          <Badge
            variant="secondary"
            className={`text-[10px] px-1.5 h-4 ${task.enabled ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"}`}
          >
            {task.enabled ? "Active" : "Paused"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{meta.desc}</p>
        <div className="flex items-center gap-4 mt-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {SCHEDULE_LABELS[task.schedule] ?? task.schedule}
          </span>
          <span>Last run: {lastRun}</span>
          {task.run_count > 0 && (
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              Ran {task.run_count}×
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-primary"
          title="Run now"
          onClick={onRunNow}
        >
          <Play className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={`h-7 w-7 p-0 ${task.enabled ? "text-amber-500 hover:text-amber-600" : "text-emerald-500 hover:text-emerald-600"}`}
          title={task.enabled ? "Pause" : "Enable"}
          onClick={onToggle}
        >
          {task.enabled ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          title="Delete"
          onClick={onDelete}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </motion.div>
  );
}

const DEFAULT_FORM = {
  type: "risk_check" as TaskType,
  schedule: "daily" as Schedule,
  label: "",
  message: "",
  subject: "",
  questionCount: "10",
};

export default function Automation() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(DEFAULT_FORM);

  const { data, isLoading } = useQuery({
    queryKey: ["autopilot-tasks"],
    queryFn: async () => {
      const res = await apiFetch("/api/autopilot/tasks");
      const json = await res.json();
      return json.tasks as AutoTask[];
    },
  });

  const toggleMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/autopilot/tasks/${id}/toggle`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["autopilot-tasks"] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/autopilot/tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["autopilot-tasks"] });
      toast({ title: "Task deleted" });
    },
  });

  const runNowMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/autopilot/tasks/${id}/run-now`, { method: "POST" }),
    onSuccess: async (res) => {
      const json = await res.json();
      toast({ title: json.message ?? "Task executed" });
      qc.invalidateQueries({ queryKey: ["autopilot-tasks"] });
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const parameters: Record<string, any> = {};
      if (form.type === "reminder") parameters.message = form.message;
      if (form.type === "assignment") {
        parameters.subject = form.subject;
        parameters.questionCount = parseInt(form.questionCount) || 10;
      }
      return apiFetch("/api/autopilot/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: form.type,
          schedule: form.schedule,
          label: form.label || TYPE_META[form.type].label,
          parameters,
        }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["autopilot-tasks"] });
      setShowModal(false);
      setForm(DEFAULT_FORM);
      toast({ title: "Automation task created" });
    },
    onError: () => toast({ title: "Failed to create task", variant: "destructive" }),
  });

  const tasks = data ?? [];
  const activeTasks = tasks.filter(t => t.enabled).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bot className="w-6 h-6 text-primary" />
            AutoPilot
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Automate recurring teaching tasks — assignments, reminders, reports, and risk checks.
          </p>
        </div>
        <Button onClick={() => setShowModal(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Task
        </Button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Tasks",  value: tasks.length,                                  color: "text-foreground" },
          { label: "Active",       value: activeTasks,                                    color: "text-emerald-500" },
          { label: "Paused",       value: tasks.length - activeTasks,                     color: "text-amber-500" },
          { label: "Total Runs",   value: tasks.reduce((s, t) => s + (t.run_count ?? 0), 0), color: "text-primary" },
        ].map(stat => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-3">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Task list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="h-20 bg-muted/40 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-2xl">
          <Bot className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-medium text-muted-foreground">No automation tasks yet</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Create your first task to let AutoPilot handle recurring work for you.
          </p>
          <Button variant="outline" className="mt-4 gap-2" onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4" /> Add First Task
          </Button>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-3">
            {tasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                onToggle={() => toggleMut.mutate(task.id)}
                onDelete={() => deleteMut.mutate(task.id)}
                onRunNow={() => runNowMut.mutate(task.id)}
              />
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* Add Task Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.97 }}
              className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-lg">New Automation Task</h2>
                <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              {/* Type selector */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Task Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(TYPE_META) as TaskType[]).map(type => {
                    const meta = TYPE_META[type];
                    return (
                      <button
                        key={type}
                        onClick={() => setForm(f => ({ ...f, type }))}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left ${
                          form.type === type
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border hover:border-primary/30 text-muted-foreground"
                        }`}
                      >
                        <span className={form.type === type ? "text-primary" : meta.color}>
                          {meta.icon}
                        </span>
                        <span className="text-xs leading-tight">{meta.label.split(" ").slice(0, 2).join(" ")}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Label */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Label</label>
                <Input
                  placeholder={TYPE_META[form.type].label}
                  value={form.label}
                  onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                />
              </div>

              {/* Frequency */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Frequency</label>
                <div className="relative">
                  <select
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm appearance-none pr-8"
                    value={form.schedule}
                    onChange={e => setForm(f => ({ ...f, schedule: e.target.value as Schedule }))}
                  >
                    {(Object.entries(SCHEDULE_LABELS) as [Schedule, string][]).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* Type-specific params */}
              {form.type === "reminder" && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Message</label>
                  <Input
                    placeholder="You have upcoming deadlines — please check your work."
                    value={form.message}
                    onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  />
                </div>
              )}
              {form.type === "assignment" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Subject</label>
                    <Input
                      placeholder="e.g. Chemistry"
                      value={form.subject}
                      onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Questions</label>
                    <Input
                      type="number"
                      min={1} max={50}
                      value={form.questionCount}
                      onChange={e => setForm(f => ({ ...f, questionCount: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button
                  className="flex-1"
                  onClick={() => createMut.mutate()}
                  disabled={createMut.isPending}
                >
                  {createMut.isPending ? "Creating…" : "Create Task"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
