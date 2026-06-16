import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Keyboard } from "lucide-react";

const SHORTCUTS = [
  {
    group: "Navigation",
    items: [
      { keys: ["Ctrl", "K"],     label: "Global search" },
      { keys: ["G", "D"],        label: "Go to Dashboard" },
      { keys: ["G", "C"],        label: "Go to Courses" },
      { keys: ["G", "A"],        label: "Go to Assignments" },
      { keys: ["Esc"],           label: "Close panel / dialog" },
    ],
  },
  {
    group: "ContentCraft",
    items: [
      { keys: ["/"],             label: "Open block command menu" },
      { keys: ["↑", "↓"],        label: "Navigate block menu" },
      { keys: ["↵"],             label: "Insert selected block" },
      { keys: ["Dbl-click"],     label: "Edit a block" },
    ],
  },
  {
    group: "General",
    items: [
      { keys: ["?"],             label: "Open keyboard shortcuts" },
      { keys: ["Ctrl", "S"],     label: "Save (in editors)" },
      { keys: ["Ctrl", "Z"],     label: "Undo" },
      { keys: ["Ctrl", "Enter"], label: "Submit / confirm" },
    ],
  },
];

export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === "?" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        setOpen(prev => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Keyboard shortcuts (?)"
        className="fixed bottom-5 right-5 z-40 w-9 h-9 rounded-full bg-foreground/80 hover:bg-foreground text-background flex items-center justify-center shadow-lg transition-all hover:scale-105 backdrop-blur-sm"
        aria-label="Keyboard shortcuts"
      >
        <Keyboard size={15} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="pointer-events-auto w-full max-w-lg bg-card rounded-2xl shadow-2xl overflow-hidden border border-border">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-foreground flex items-center justify-center">
                      <Keyboard size={15} className="text-background" />
                    </div>
                    <div>
                      <h2 className="font-bold text-foreground text-sm">Keyboard Shortcuts</h2>
                      <p className="text-xs text-muted-foreground">Press <kbd className="px-1 py-0.5 bg-muted rounded font-mono border border-border">?</kbd> to toggle</p>
                    </div>
                  </div>
                  <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-muted">
                    <X size={18} />
                  </button>
                </div>
                <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6 max-h-[70vh] overflow-y-auto">
                  {SHORTCUTS.map(group => (
                    <div key={group.group}>
                      <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-3">{group.group}</p>
                      <div className="space-y-2">
                        {group.items.map((item, i) => (
                          <div key={i} className="flex items-center justify-between gap-4">
                            <span className="text-xs text-muted-foreground">{item.label}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              {item.keys.map((k, ki) => (
                                <kbd key={ki} className="px-2 py-1 bg-muted border border-border rounded text-[11px] font-mono font-semibold text-foreground shadow-sm">
                                  {k}
                                </kbd>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-6 py-3 bg-muted/40 border-t border-border">
                  <p className="text-[11px] text-muted-foreground text-center">Shortcuts work when not focused on an input field</p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
