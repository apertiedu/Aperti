import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, FlaskConical, ExternalLink, Atom, Globe, Triangle } from "lucide-react";

const LAB_TYPES = [
  { value: "forge-field", label: "ForgeField™", desc: "Physics circuit & force builder", icon: <Atom className="h-5 w-5" /> },
  { value: "react-sphere", label: "ReactSphere™", desc: "Chemistry reaction simulator", icon: <FlaskConical className="h-5 w-5" /> },
  { value: "geometrix", label: "Geometrix™", desc: "Interactive geometry workspace", icon: <Triangle className="h-5 w-5" /> },
  { value: "biosphere", label: "Biosphere™", desc: "Biology ecosystem simulation", icon: <Globe className="h-5 w-5" /> },
];

interface Lab {
  id: string;
  title: string;
  type: string;
  description: string;
  config: string;
  createdAt: string;
}

export default function LabBuilder() {
  const [labs, setLabs] = useState<Lab[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", type: "forge-field", description: "", config: "" });

  const handleCreate = () => {
    const newLab: Lab = {
      id: Date.now().toString(),
      title: form.title,
      type: form.type,
      description: form.description,
      config: form.config,
      createdAt: new Date().toISOString(),
    };
    setLabs(prev => [newLab, ...prev]);
    setForm({ title: "", type: "forge-field", description: "", config: "" });
    setDialogOpen(false);
  };

  const selectedType = LAB_TYPES.find(t => t.value === form.type);

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Lab Builder<span className="text-primary">™</span></h1>
          <p className="text-muted-foreground">Configure and assign interactive SimVerse labs to your students.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />New Lab</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>Configure Lab Activity</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <Label>Lab Name</Label>
                <Input placeholder="e.g. Series & Parallel Circuits Lab" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Lab Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LAB_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>
                        <span className="font-medium">{t.label}</span>
                        <span className="text-muted-foreground ml-2 text-xs">{t.desc}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedType && (
                  <p className="text-xs text-muted-foreground">{selectedType.desc}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Instructions for Students</Label>
                <Textarea
                  placeholder="Connect a resistor and battery in series. Observe the current reading…"
                  rows={3}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Initial Configuration (JSON, optional)</Label>
                <Textarea
                  placeholder='{"components": ["battery", "resistor", "ammeter"], "targetCurrent": 0.5}'
                  rows={3}
                  className="font-mono text-xs"
                  value={form.config}
                  onChange={e => setForm(f => ({ ...f, config: e.target.value }))}
                />
              </div>
              <Button className="w-full" disabled={!form.title} onClick={handleCreate}>
                Create Lab
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {LAB_TYPES.map(lt => (
          <Card key={lt.value} className="card-hover">
            <CardContent className="p-5 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                {lt.icon}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">{lt.label}</p>
                <p className="text-xs text-muted-foreground mb-2">{lt.desc}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => window.open(`/labs/${lt.value}`, "_blank")}
                >
                  <ExternalLink className="h-3 w-3 mr-1" /> Preview Lab
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Configured Labs</h2>
        {labs.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center text-muted-foreground">
              <FlaskConical className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No labs configured yet. Create a lab to assign it to students via ContentCraft.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {labs.map(lab => {
              const lt = LAB_TYPES.find(t => t.value === lab.type);
              return (
                <motion.div key={lab.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <Card className="card-hover">
                    <CardContent className="p-4 flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        {lt?.icon ?? <FlaskConical className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-medium text-sm truncate">{lab.title}</p>
                          <Badge variant="secondary" className="text-xs shrink-0">{lt?.label ?? lab.type}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">{lab.description || "No instructions"}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`/labs/${lab.type}`, "_blank")}
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
