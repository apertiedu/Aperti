import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Building2, Plus, Pencil, Trash2, MapPin, Users, CheckCircle, XCircle } from "lucide-react";

type Center = {
  id: number; name: string; location: string | null; capacity: number | null;
  is_active: boolean; created_at: string;
};

function CenterDialog({ center, onSave, trigger }: { center?: Center; onSave: (d: any) => Promise<void>; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: center?.name || "", location: center?.location || "", capacity: center?.capacity?.toString() || "" });
  const { toast } = useToast();
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const handleSave = async () => {
    setLoading(true);
    try { await onSave(form); setOpen(false); }
    catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
    finally { setLoading(false); }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{center ? "Edit Center" : "Add Center"}</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5"><Label>Center Name *</Label><Input placeholder="e.g. Cairo Branch" value={form.name} onChange={e => set("name", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Location / Address</Label><Input placeholder="e.g. 5 Tahrir St, Cairo" value={form.location} onChange={e => set("location", e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Capacity (students)</Label><Input type="number" placeholder="e.g. 20" value={form.capacity} onChange={e => set("capacity", e.target.value)} /></div>
          <Button className="w-full" onClick={handleSave} disabled={loading || !form.name.trim()}>
            {loading ? "Saving..." : center ? "Save Changes" : "Add Center"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function CentersPage() {
  const [centers, setCenters] = useState<Center[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try { const r = await fetch("/api/centers", { credentials: "include" }); if (r.ok) setCenters(await r.json()); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (data: any) => {
    const r = await fetch("/api/centers", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || "Failed"); }
    await load(); toast({ title: "Center added!" });
  };

  const handleEdit = (center: Center) => async (data: any) => {
    const r = await fetch(`/api/centers/${center.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || "Failed"); }
    await load(); toast({ title: "Updated!" });
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this center?")) return;
    await fetch(`/api/centers/${id}`, { method: "DELETE", credentials: "include" });
    await load(); toast({ title: "Center deleted" });
  };

  const handleToggle = async (c: Center) => {
    await fetch(`/api/centers/${c.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !c.is_active }) });
    setCenters(cs => cs.map(x => x.id === c.id ? { ...x, is_active: !x.is_active } : x));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-7 w-7 text-primary" />Centers
          </h1>
          <p className="text-muted-foreground mt-1">Manage your physical learning centers and locations.</p>
        </div>
        <CenterDialog onSave={handleCreate} trigger={<Button className="gap-2"><Plus className="h-4 w-4" />Add Center</Button>} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: "Total Centers", value: centers.length, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Active", value: centers.filter(c => c.is_active).length, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Total Capacity", value: centers.reduce((a, c) => a + (c.capacity || 0), 0), color: "text-violet-600", bg: "bg-violet-50" },
        ].map(s => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{[1,2].map(i => <div key={i} className="h-40 rounded-xl bg-muted/40 animate-pulse" />)}</div>
      ) : centers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center">
            <Building2 className="h-8 w-8 text-muted-foreground opacity-30" />
          </div>
          <p className="text-muted-foreground text-sm">No centers added yet.</p>
          <CenterDialog onSave={handleCreate} trigger={<Button className="gap-2"><Plus className="h-4 w-4" />Add Your First Center</Button>} />
        </div>
      ) : (
        <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }}>
          {centers.map(c => (
            <motion.div key={c.id} variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
              <Card className={`border-border/50 shadow-sm h-full ${!c.is_active ? "opacity-60" : ""}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{c.name}</CardTitle>
                    <Switch checked={c.is_active} onCheckedChange={() => handleToggle(c)} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {c.location && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />{c.location}
                    </div>
                  )}
                  {c.capacity && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-3.5 w-3.5 shrink-0" />Capacity: <span className="font-semibold text-foreground">{c.capacity}</span> students
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-xs">
                    {c.is_active ? <><CheckCircle className="h-3.5 w-3.5 text-emerald-500" /><span className="text-emerald-600">Active</span></>
                      : <><XCircle className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-muted-foreground">Inactive</span></>}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <CenterDialog center={c} onSave={handleEdit(c)}
                      trigger={<Button variant="outline" size="sm" className="flex-1 gap-1.5"><Pencil className="h-3.5 w-3.5" />Edit</Button>} />
                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(c.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
