import { useLocation } from "wouter";
import { FlaskConical, ArrowLeft, Beaker, Atom, Dna, Triangle } from "lucide-react";
import { Button } from "@/components/ui/button";

const LAB_META: Record<string, { name: string; desc: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string }> = {
  "forge-field":   { name: "ForgeField",   desc: "Electromagnetic field simulator — visualise field lines, forces, and interactions in real time.", icon: Atom,        color: "hsl(var(--primary))" },
  "react-sphere":  { name: "ReactSphere",  desc: "Chemical reaction sandbox — build molecules, run virtual reactions, and observe energy changes.", icon: Beaker,       color: "#7C3AED" },
  "geometrix":     { name: "Geometrix",    desc: "3-D geometry explorer — construct, transform, and measure geometric solids interactively.",      icon: Triangle,     color: "#D97706" },
  "biosphere":     { name: "BioSphere",    desc: "Ecosystem simulation — model populations, food webs, and environmental pressures over time.",     icon: Dna,          color: "#059669" },
  "lab-builder":   { name: "Lab Builder",  desc: "Design and deploy your own virtual lab experiments for students.",                               icon: FlaskConical,  color: "hsl(var(--primary))" },
  "simverse":      { name: "SimVerse",     desc: "The full suite of interactive science simulations — labs, experiments, and 3-D models.",         icon: FlaskConical,  color: "hsl(var(--primary))" },
};

function slug(path: string) {
  const parts = path.replace(/^\/+/, "").split("/");
  return parts[parts.length - 1] || parts[0] || "";
}

export default function LabsComingSoon() {
  const [location, navigate] = useLocation();
  const key = slug(location);
  const meta = LAB_META[key] ?? {
    name: "Interactive Lab",
    desc: "Hands-on virtual experiments are on the way.",
    icon: FlaskConical,
    color: "hsl(var(--primary))",
  };
  const Icon = meta.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-primary/80/30 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg"
          style={{ background: meta.color + "18", border: `2px solid ${meta.color}30` }}
        >
          <Icon className="w-9 h-9" style={{ color: meta.color }} />
        </div>

        <div
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full mb-4"
          style={{ background: meta.color + "15", color: meta.color, border: `1px solid ${meta.color}30` }}
        >
          Coming Soon
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">{meta.name}</h1>
        <p className="text-sm text-gray-500 leading-relaxed mb-8">{meta.desc}</p>

        <div className="bg-card rounded-xl border border-border shadow-sm p-5 text-left mb-8 space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">What to expect</p>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2"><span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />Real-time interactive simulations built for IGCSE learners</li>
            <li className="flex items-start gap-2"><span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />Progress tracking and auto-marked lab reports</li>
            <li className="flex items-start gap-2"><span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />Linked directly to your syllabus and question bank</li>
          </ul>
        </div>

        <Button
          variant="outline"
          className="gap-2"
          onClick={() => navigate(-1 as any)}
        >
          <ArrowLeft className="w-4 h-4" />
          Go back
        </Button>
      </div>
    </div>
  );
}
