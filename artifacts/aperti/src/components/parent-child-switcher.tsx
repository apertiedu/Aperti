import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

const authFetch = (url: string) => fetch(url, { credentials: "include" });

interface Child { linkId: number; studentId: number; name: string; studentCode: string; }

export default function ParentChildSwitcher({ selected, onSelect }: { selected: number | null; onSelect: (id: number) => void }) {
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["parent-dashboard"],
    queryFn: () => authFetch("/api/parent/dashboard").then(r => r.json()),
    staleTime: 60000,
  });

  const children: Child[] = (data?.children || []);

  if (!children.length) return null;

  const current = children.find(c => c.studentId === selected) || children[0];

  if (!selected && children.length > 0) {
    setTimeout(() => onSelect(children[0].studentId), 0);
  }

  if (children.length === 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/8 border border-primary/20 w-fit">
        <div className="w-6 h-6 rounded-full flex items-center justify-center bg-primary text-primary-foreground text-[9px] font-bold">
          {(current.name || "S").slice(0, 2).toUpperCase()}
        </div>
        <span className="text-sm font-semibold text-primary">{current.name}</span>
      </div>
    );
  }

  return (
    <div className="relative w-fit">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/8 border border-primary/20 hover:border-primary/40 transition-colors"
      >
        <div className="w-6 h-6 rounded-full flex items-center justify-center bg-primary text-primary-foreground text-[9px] font-bold">
          {(current?.name || "S").slice(0, 2).toUpperCase()}
        </div>
        <span className="text-sm font-semibold text-primary">{current?.name || "Select child"}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-primary/60 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-1 left-0 bg-card border border-border rounded-xl shadow-lg z-30 min-w-48 overflow-hidden">
          {children.map(c => (
            <button
              key={c.studentId}
              onClick={() => { onSelect(c.studentId); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors ${c.studentId === selected ? "bg-primary/8" : ""}`}
            >
              <div className="w-7 h-7 rounded-full flex items-center justify-center bg-primary text-primary-foreground text-[9px] font-bold shrink-0">
                {(c.name || "S").slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className={`text-sm font-medium ${c.studentId === selected ? "text-primary" : "text-foreground"}`}>{c.name}</p>
                <p className="text-[9px] text-muted-foreground">{c.studentCode}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
