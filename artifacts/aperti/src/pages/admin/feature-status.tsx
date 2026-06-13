import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Zap, ZapOff, Trash2, RefreshCw, Tag, Clock, Globe } from "lucide-react";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

type FeatureFlag = {
  id: number;
  name: string;
  description?: string;
  enabled: boolean;
  status: string;
  targetRoles?: string[] | null;
  targetPlans?: string[] | null;
  targetOrgs?: number[] | null;
  updatedAt?: string;
  createdAt?: string;
};

function CreateFlagDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [targetRoles, setTargetRoles] = useState("");
  const { toast } = useToast();

  const create = async () => {
    if (!name.trim()) return;
    await apiFetch("/api/admin/features", {
      method: "POST",
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim() || undefined,
        enabled,
        targetRoles: targetRoles.split(",").map(s => s.trim()).filter(Boolean) || null,
      }),
    });
    toast({ title: "Feature flag created", description: name });
    setOpen(false);
    setName(""); setDescription(""); setEnabled(false); setTargetRoles("");
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="h-4 w-4" />New Flag</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create Feature Flag</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div><Label>Key Name <span className="text-destructive">*</span></Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. new_dashboard" className="mt-1 font-mono" /></div>
          <div><Label>Description</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this flag control?" className="mt-1 resize-none" rows={2} /></div>
          <div><Label>Target Roles (comma-separated)</Label><Input value={targetRoles} onChange={e => setTargetRoles(e.target.value)} placeholder="student, teacher, admin" className="mt-1" /></div>
          <div className="flex items-center gap-3"><Switch checked={enabled} onCheckedChange={setEnabled} /><Label>Enable immediately</Label></div>
          <Button className="w-full" onClick={create} disabled={!name.trim()}>Create Flag</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function FeatureStatusPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: flags, isLoading, refetch } = useQuery<FeatureFlag[]>({
    queryKey: ["admin", "features"],
    queryFn: () => apiFetch("/api/admin/features"),
  });

  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      apiFetch(`/api/admin/features/${id}`, { method: "PUT", body: JSON.stringify({ enabled }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "features"] }),
    onError: () => toast({ title: "Failed to toggle flag", variant: "destructive" }),
  });

  const archive = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/admin/features/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "features"] }); toast({ title: "Flag archived" }); },
    onError: () => toast({ title: "Failed to archive flag", variant: "destructive" }),
  });

  const enabled = flags?.filter(f => f.enabled && f.status !== "archived") ?? [];
  const disabled = flags?.filter(f => !f.enabled && f.status !== "archived") ?? [];
  const archived = flags?.filter(f => f.status === "archived") ?? [];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Feature Status</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage feature flags — toggle, audit, and control feature rollout</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5"><RefreshCw className="h-3.5 w-3.5" />Refresh</Button>
          <CreateFlagDialog onCreated={() => qc.invalidateQueries({ queryKey: ["admin", "features"] })} />
        </div>
      </div>

      {/* Health score bar */}
      {!isLoading && flags && flags.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-foreground">Feature Adoption Rate</span>
            <span className="text-sm font-bold text-primary">
              {flags.filter(f => f.status !== "archived").length > 0
                ? Math.round((enabled.length / flags.filter(f => f.status !== "archived").length) * 100)
                : 0}%
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-2 rounded-full bg-primary transition-all duration-700"
              style={{ width: `${flags.filter(f => f.status !== "archived").length > 0 ? Math.round((enabled.length / flags.filter(f => f.status !== "archived").length) * 100) : 0}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            {enabled.length} of {flags.filter(f => f.status !== "archived").length} flags currently active
          </p>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Active Flags", value: enabled.length, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20", icon: <Zap className="h-4 w-4 text-emerald-500" /> },
          { label: "Disabled Flags", value: disabled.length, color: "text-muted-foreground", bg: "bg-muted/50", icon: <ZapOff className="h-4 w-4 text-muted-foreground" /> },
          { label: "Archived", value: archived.length, color: "text-muted-foreground", bg: "bg-muted/30", icon: <Trash2 className="h-4 w-4 text-muted-foreground" /> },
        ].map(({ label, value, color, bg, icon }) => (
          <Card key={label} className={`shadow-sm ${bg}`}>
            <CardContent className="p-4 flex items-center gap-3">
              {icon}
              <div><p className={`text-xl font-bold ${color}`}>{isLoading ? "…" : value}</p><p className="text-xs text-muted-foreground">{label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active flags */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4 text-emerald-500" />Active Flags</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? [...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />) :
           enabled.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">No active flags</p> :
           enabled.map(flag => <FlagRow key={flag.id} flag={flag} onToggle={toggle.mutate} onArchive={archive.mutate} />)
          }
        </CardContent>
      </Card>

      {/* Disabled flags */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><ZapOff className="h-4 w-4 text-muted-foreground" />Disabled Flags</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? [...Array(2)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />) :
           disabled.length === 0 ? <p className="text-sm text-muted-foreground py-4 text-center">No disabled flags</p> :
           disabled.map(flag => <FlagRow key={flag.id} flag={flag} onToggle={toggle.mutate} onArchive={archive.mutate} />)
          }
        </CardContent>
      </Card>

      {archived.length > 0 && (
        <Card className="shadow-sm opacity-60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><Trash2 className="h-3.5 w-3.5" />Archived ({archived.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {archived.map(flag => (
              <div key={flag.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30">
                <span className="text-xs font-mono text-muted-foreground">{flag.name}</span>
                <Badge variant="outline" className="text-[10px]">archived</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function FlagRow({ flag, onToggle, onArchive }: {
  flag: FeatureFlag;
  onToggle: (args: { id: number; enabled: boolean }) => void;
  onArchive: (id: number) => void;
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-background hover:bg-muted/30 transition-colors gap-3">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Switch checked={flag.enabled} onCheckedChange={enabled => onToggle({ id: flag.id, enabled })} />
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold text-foreground truncate">{flag.name}</p>
          {flag.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{flag.description}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {(flag.targetRoles?.length ?? 0) > 0 && (
          <div className="flex items-center gap-1">
            <Tag className="h-3 w-3 text-muted-foreground" />
            {flag.targetRoles!.slice(0, 2).map(r => (
              <Badge key={r} variant="outline" className="text-[10px] h-4">{r}</Badge>
            ))}
          </div>
        )}
        {flag.updatedAt && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 hidden md:flex">
            <Clock className="h-3 w-3" />{new Date(flag.updatedAt).toLocaleDateString()}
          </span>
        )}
        <Badge variant={flag.enabled ? "default" : "secondary"} className="text-[10px]">{flag.enabled ? "ON" : "OFF"}</Badge>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onArchive(flag.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
