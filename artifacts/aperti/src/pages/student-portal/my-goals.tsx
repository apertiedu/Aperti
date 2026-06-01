import { apiFetch } from "@/lib/api";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Target, Plus, Trash2, TrendingUp, CheckCircle2,
  Calendar, BookOpen, Star, Flame, Award
} from "lucide-react";

type Goal = {
  id: number; goal_type: string; target_value: string; current_value: number;
  progress_pct: number; subject_name: string | null; deadline: string | null;
  notes: string | null; is_active: boolean; created_at: string;
};

const GOAL_TYPES = [
  { value: "attendance", label: "Attendance Rate", unit: "%", icon: Calendar, color: "from-sky-400 to-blue-500", max: 100 },
  { value: "grade",      label: "Exam Average",    unit: "%", icon: BookOpen, color: "from-violet-400 to-purple-500", max: 100 },
  { value: "streak",     label: "Flashcard Streak", unit: " days", icon: Flame, color: "from-amber-400 to-orange-500", max: 30 },
];

function getGoalConfig(type: string) {
  return GOAL_TYPES.find(g => g.value === type) ?? GOAL_TYPES[0];
}

function GoalCard({ goal, onDelete }: { goal: Goal; onDelete: () => void }) {
  const config = getGoalConfig(goal.goal_type);
  const isAchieved = goal.progress_pct >= 100;
  const GIcon = config.icon;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className={`border overflow-hidden ${isAchieved ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20" : "border-border/50"}`}>
        <div className={`h-1 bg-gradient-to-r ${config.color}`} />
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${config.color} flex items-center justify-center shadow-sm`}>
                <GIcon className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">{config.label}</p>
                {goal.subject_name && <p className="text-xs text-muted-foreground">{goal.subject_name}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isAchieved && (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs gap-1">
                  <CheckCircle2 className="h-3 w-3" />Done!
                </Badge>
              )}
              <button onClick={onDelete} className="text-muted-foreground hover:text-destructive transition-colors p-1">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span className="font-semibold text-foreground">{goal.current_value}{config.unit} / {goal.target_value}{config.unit}</span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full bg-gradient-to-r ${config.color}`}
                initial={{ width: 0 }}
                animate={{ width: `${goal.progress_pct}%` }}
                transition={{ delay: 0.2, duration: 0.7, ease: "easeOut" }}
              />
            </div>
            <div className="flex justify-between items-center">
              <span className={`text-xs font-bold ${isAchieved ? "text-emerald-600" : "text-foreground"}`}>
                {goal.progress_pct}% complete
              </span>
              {goal.deadline && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(goal.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </span>
              )}
            </div>
          </div>

          {goal.notes && <p className="text-xs text-muted-foreground italic border-t border-border/30 pt-2">{goal.notes}</p>}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function MyGoals() {
  const { toast } = useToast();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ goalType: "attendance", targetValue: "", deadline: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const load = async () => {
    setLoading(true);
    const r = await apiFetch("/api/portal/goals", { credentials: "include" });
    if (r.ok) setGoals(await r.json());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.targetValue) return;
    setSaving(true);
    const res = await apiFetch("/api/portal/goals", {
      method: "POST", 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goalType: form.goalType, targetValue: parseFloat(form.targetValue), deadline: form.deadline || null, notes: form.notes || null }),
    });
    setSaving(false);
    if (!res.ok) { toast({ title: "Error creating goal", variant: "destructive" }); return; }
    toast({ title: "Goal set!" });
    setAddOpen(false);
    setForm({ goalType: "attendance", targetValue: "", deadline: "", notes: "" });
    load();
    apiFetch("/api/portal/achievements/check", { method: "POST" });
  };

  const handleDelete = async (id: number) => {
    await apiFetch(`/api/portal/goals/${id}`, { method: "DELETE" });
    load();
  };

  const achieved = goals.filter(g => g.progress_pct >= 100);
  const active = goals.filter(g => g.progress_pct < 100);
  const config = getGoalConfig(form.goalType);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-sm">
            <Target className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">My Goals</h1>
            <p className="text-xs text-muted-foreground">Track your academic targets</p>
          </div>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 shadow-sm">
              <Plus className="h-4 w-4" />Set Goal
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Set a New Goal</DialogTitle></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label>Goal Type</Label>
                <Select value={form.goalType} onValueChange={v => set("goalType", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GOAL_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Target ({config.label})</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" value={form.targetValue} onChange={e => set("targetValue", e.target.value)}
                    placeholder={config.max === 100 ? "e.g. 85" : "e.g. 7"} min={1} max={config.max} step={1} required />
                  <span className="text-sm text-muted-foreground shrink-0">{config.unit}</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Deadline <span className="text-muted-foreground">(optional)</span></Label>
                <Input type="date" value={form.deadline} onChange={e => set("deadline", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Notes <span className="text-muted-foreground">(optional)</span></Label>
                <Input value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="e.g. For Physics final" />
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={saving} className="flex-1 bg-gradient-to-r from-amber-400 to-orange-500">
                  {saving ? "Saving..." : "Set Goal"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Active Goals", value: active.length, icon: Target, color: "text-amber-600", bg: "bg-amber-100" },
            { label: "Achieved",     value: achieved.length, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-100" },
            { label: "Total Goals",  value: goals.length,    icon: TrendingUp, color: "text-violet-600", bg: "bg-violet-100" },
          ].map(s => (
            <Card key={s.label} className="border border-border/50">
              <CardContent className="p-3 flex flex-col items-center text-center gap-1.5">
                <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center`}>
                  <s.icon className={`h-4 w-4 ${s.color}`} />
                </div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Goals list */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-28 rounded-xl skeleton" />)}</div>
      ) : goals.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
            <Target className="h-8 w-8 text-muted-foreground/30" />
          </div>
          <p className="font-semibold text-foreground mb-1">No goals set yet</p>
          <p className="text-sm text-muted-foreground mb-4">Set your first academic target to start tracking progress</p>
          <Button onClick={() => setAddOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />Set Your First Goal
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <div>
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">In Progress</h2>
              <div className="space-y-3">
                {active.map(g => <GoalCard key={g.id} goal={g} onDelete={() => handleDelete(g.id)} />)}
              </div>
            </div>
          )}
          {achieved.length > 0 && (
            <div>
              <h2 className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5" />Achieved
              </h2>
              <div className="space-y-3">
                {achieved.map(g => <GoalCard key={g.id} goal={g} onDelete={() => handleDelete(g.id)} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
