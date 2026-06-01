import { useRef, useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Pencil, Highlighter, Eraser, Type, Square, Circle,
  Undo2, Redo2, Trash2, Download, Save, Maximize2, Minimize2,
  Loader2, PenLine,
} from "lucide-react";

const TEAL = "#00796B";
const PALETTE = [
  "#121212", "#ffffff", "#00796B", "#1976D2",
  "#E53935", "#F9A825", "#7B1FA2", "#388E3C",
  "#FF6F00", "#546E7A",
];

type Tool = "pen" | "highlighter" | "eraser" | "text" | "rect" | "circle";

interface Stroke {
  id: string;
  type: "path" | "text" | "rect" | "circle";
  color: string;
  size: number;
  opacity: number;
  points?: { x: number; y: number }[];
  text?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  cx?: number;
  cy?: number;
  rx?: number;
  ry?: number;
}

const API = "/api";
const tok = () => localStorage.getItem("aperti_token") || "";

function uid() {
  return Math.random().toString(36).slice(2);
}

function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
  ctx.save();
  ctx.globalAlpha = s.opacity;
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = s.size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (s.type === "path" && s.points && s.points.length > 1) {
    ctx.beginPath();
    ctx.moveTo(s.points[0].x, s.points[0].y);
    for (let i = 1; i < s.points.length; i++) {
      const mid = { x: (s.points[i - 1].x + s.points[i].x) / 2, y: (s.points[i - 1].y + s.points[i].y) / 2 };
      ctx.quadraticCurveTo(s.points[i - 1].x, s.points[i - 1].y, mid.x, mid.y);
    }
    ctx.stroke();
  } else if (s.type === "text" && s.text && s.x !== undefined && s.y !== undefined) {
    ctx.font = `${s.size * 5}px Inter, sans-serif`;
    ctx.fillText(s.text, s.x, s.y);
  } else if (s.type === "rect" && s.x !== undefined && s.y !== undefined && s.w !== undefined && s.h !== undefined) {
    ctx.strokeRect(s.x, s.y, s.w, s.h);
  } else if (s.type === "circle" && s.cx !== undefined && s.cy !== undefined && s.rx !== undefined && s.ry !== undefined) {
    ctx.beginPath();
    ctx.ellipse(s.cx, s.cy, s.rx, s.ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function redraw(canvas: HTMLCanvasElement, strokes: Stroke[], preview?: Stroke | null) {
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  strokes.forEach(s => drawStroke(ctx, s));
  if (preview) drawStroke(ctx, preview);
}

export default function InkSpace() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#121212");
  const [size, setSize] = useState(3);
  const [fullscreen, setFullscreen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const strokes = useRef<Stroke[]>([]);
  const undone = useRef<Stroke[]>([]);
  const current = useRef<Stroke | null>(null);
  const drawing = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const [, forceUpdate] = useState(0);

  const rerender = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    redraw(c, strokes.current, current.current);
    forceUpdate(n => n + 1);
  }, []);

  // Load saved note on mount
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API}/inkspace/load`, {
          headers: { Authorization: `Bearer ${tok()}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.strokes) {
            strokes.current = data.strokes;
            rerender();
          }
        }
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  // Resize canvas when container changes
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const resize = () => {
      const saved = strokes.current;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      redraw(canvas, saved);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [fullscreen]);

  const getPos = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: ((e as React.MouseEvent).clientX - rect.left) * scaleX,
      y: ((e as React.MouseEvent).clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if ("touches" in e) e.preventDefault();
    drawing.current = true;
    undone.current = [];
    const pos = getPos(e);
    startPos.current = pos;

    if (tool === "pen" || tool === "highlighter" || tool === "eraser") {
      current.current = {
        id: uid(),
        type: "path",
        color: tool === "eraser" ? "#ffffff" : color,
        size: tool === "highlighter" ? size * 4 : size,
        opacity: tool === "highlighter" ? 0.35 : 1,
        points: [pos],
      };
    } else if (tool === "rect") {
      current.current = {
        id: uid(), type: "rect", color, size, opacity: 1,
        x: pos.x, y: pos.y, w: 0, h: 0,
      };
    } else if (tool === "circle") {
      current.current = {
        id: uid(), type: "circle", color, size, opacity: 1,
        cx: pos.x, cy: pos.y, rx: 0, ry: 0,
      };
    } else if (tool === "text") {
      const txt = prompt("Enter text:");
      if (txt) {
        const s: Stroke = { id: uid(), type: "text", color, size, opacity: 1, text: txt, x: pos.x, y: pos.y };
        strokes.current = [...strokes.current, s];
        rerender();
      }
      drawing.current = false;
    }
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current || !current.current) return;
    if ("touches" in e) e.preventDefault();
    const pos = getPos(e);

    if (current.current.type === "path") {
      current.current = {
        ...current.current,
        points: [...(current.current.points || []), pos],
      };
    } else if (current.current.type === "rect") {
      current.current = {
        ...current.current,
        w: pos.x - startPos.current.x,
        h: pos.y - startPos.current.y,
      };
    } else if (current.current.type === "circle") {
      const dx = pos.x - startPos.current.x;
      const dy = pos.y - startPos.current.y;
      current.current = {
        ...current.current,
        rx: Math.abs(dx) / 2,
        ry: Math.abs(dy) / 2,
        cx: startPos.current.x + dx / 2,
        cy: startPos.current.y + dy / 2,
      };
    }

    const c = canvasRef.current!;
    redraw(c, strokes.current, current.current);
  };

  const handlePointerUp = () => {
    if (!drawing.current || !current.current) return;
    drawing.current = false;
    strokes.current = [...strokes.current, current.current];
    current.current = null;
    rerender();
  };

  const undo = () => {
    if (strokes.current.length === 0) return;
    const last = strokes.current[strokes.current.length - 1];
    undone.current = [...undone.current, last];
    strokes.current = strokes.current.slice(0, -1);
    rerender();
  };

  const redo = () => {
    if (undone.current.length === 0) return;
    const next = undone.current[undone.current.length - 1];
    undone.current = undone.current.slice(0, -1);
    strokes.current = [...strokes.current, next];
    rerender();
  };

  const clearAll = () => {
    undone.current = [...strokes.current.reverse(), ...undone.current];
    strokes.current = [];
    rerender();
  };

  const exportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `inkspace-${Date.now()}.png`;
    a.click();
    toast({ title: "Exported to PNG" });
  };

  const save = async () => {
    setSaving(true);
    try {
      await fetch(`${API}/inkspace/save`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tok()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ strokes: strokes.current }),
      });
      toast({ title: "Saved", description: "Your notes are saved." });
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const TOOLS: { id: Tool; label: string; icon: typeof Pencil }[] = [
    { id: "pen", label: "Pen", icon: Pencil },
    { id: "highlighter", label: "Highlighter", icon: Highlighter },
    { id: "eraser", label: "Eraser", icon: Eraser },
    { id: "text", label: "Text", icon: Type },
    { id: "rect", label: "Rectangle", icon: Square },
    { id: "circle", label: "Circle", icon: Circle },
  ];

  const cursor =
    tool === "eraser" ? "cell"
    : tool === "text" ? "text"
    : "crosshair";

  return (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-50 bg-white flex flex-col"
          : "flex flex-col h-full min-h-screen bg-[#F5F5F5]"
      }
    >
      {/* Header */}
      <div className="bg-white border-b px-4 py-2.5 flex items-center gap-3 flex-wrap shrink-0">
        <div className="flex items-center gap-2 mr-2">
          <div className="h-7 w-7 rounded-lg bg-[#00796B]/10 flex items-center justify-center">
            <PenLine className="h-4 w-4 text-[#00796B]" />
          </div>
          <span className="font-semibold text-sm text-gray-900">InkSpace</span>
        </div>

        {/* Tools */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {TOOLS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                title={t.label}
                onClick={() => setTool(t.id)}
                className={`h-7 w-7 rounded-md flex items-center justify-center transition-all ${
                  tool === t.id
                    ? "bg-white shadow-sm text-[#00796B]"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-200"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            );
          })}
        </div>

        {/* Size */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Size</span>
          <input
            type="range" min={1} max={20} value={size}
            onChange={e => setSize(Number(e.target.value))}
            className="w-20 accent-[#00796B]"
          />
          <span className="text-xs text-gray-400 w-4">{size}</span>
        </div>

        {/* Color palette */}
        <div className="flex items-center gap-1">
          {PALETTE.map(c => (
            <button
              key={c}
              onClick={() => { setColor(c); if (tool === "eraser") setTool("pen"); }}
              title={c}
              className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${
                color === c && tool !== "eraser" ? "border-[#00796B] scale-110" : "border-transparent"
              }`}
              style={{
                background: c,
                boxShadow: c === "#ffffff" ? "inset 0 0 0 1px #e5e7eb" : undefined,
              }}
            />
          ))}
          <input
            type="color"
            value={color}
            onChange={e => { setColor(e.target.value); if (tool === "eraser") setTool("pen"); }}
            className="w-5 h-5 rounded-full border-2 border-dashed border-gray-300 cursor-pointer"
            title="Custom color"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 ml-auto">
          <Button variant="ghost" size="sm" onClick={undo} title="Undo" className="h-7 w-7 p-0">
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={redo} title="Redo" className="h-7 w-7 p-0">
            <Redo2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={clearAll} title="Clear all" className="h-7 w-7 p-0 text-red-400 hover:text-red-600">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <div className="w-px h-5 bg-gray-200 mx-1" />
          <Button variant="ghost" size="sm" onClick={exportPNG} title="Export PNG" className="h-7 w-7 p-0">
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost" size="sm" onClick={save} title="Save"
            disabled={saving}
            className="h-7 px-2 gap-1 text-xs text-[#00796B] hover:bg-[#00796B]/10"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </Button>
          <Button
            variant="ghost" size="sm" onClick={() => setFullscreen(f => !f)}
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            className="h-7 w-7 p-0"
          >
            {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* Canvas area */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden bg-white" style={{ minHeight: 400 }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <Loader2 className="h-6 w-6 animate-spin text-[#00796B]" />
          </div>
        )}
        <canvas
          ref={canvasRef}
          style={{ cursor, touchAction: "none", display: "block" }}
          className="w-full h-full"
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
        />
        {strokes.current.length === 0 && !loading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <Pencil className="h-10 w-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-300">Start drawing — your notes auto-save</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
