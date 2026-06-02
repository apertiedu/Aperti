import React, { useRef, useEffect, useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Pencil, Highlighter, Eraser, Type, Undo2, Redo2, Trash2,
  Download, Save, Maximize2, Minimize2, Loader2, PenLine,
  Shapes, Upload, ChevronLeft, ChevronRight, Minus,
  MoveRight, Square, Circle as CircleIcon, Triangle, Star,
  Diamond, Hexagon, ZoomIn, ZoomOut,
  BookOpen, Plus, ChevronDown, ChevronRight as ChevronRightIcon, FileText,
  FolderOpen, Folder, MoreHorizontal, X,
} from "lucide-react";

const TEAL = "#00796B";
const PALETTE = [
  "#121212", "#374151", "#9CA3AF", "#FFFFFF",
  "#00796B", "#1976D2", "#388E3C", "#7B1FA2",
  "#E53935", "#F9A825", "#FF6F00", "#0288D1",
];

type Tool =
  | "pen" | "highlighter" | "eraser" | "text"
  | "line" | "arrow" | "rect" | "circle"
  | "triangle" | "rtriangle" | "diamond"
  | "star5" | "pentagon" | "hexagon"
  | "process" | "terminal";

interface Stroke {
  id: string;
  type: Tool | "image";
  color: string;
  size: number;
  opacity: number;
  points?: { x: number; y: number }[];
  text?: string;
  x?: number; y?: number; w?: number; h?: number;
  cx?: number; cy?: number; rx?: number; ry?: number;
  x1?: number; y1?: number; x2?: number; y2?: number;
  imageData?: string;
}

const uid = () => Math.random().toString(36).slice(2, 9);
const API = "";
const tok = () => localStorage.getItem("aperti_token") || "";

function regularPolygon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, sides: number, offset = -Math.PI / 2) {
  for (let i = 0; i <= sides; i++) {
    const a = (i * 2 * Math.PI) / sides + offset;
    i === 0 ? ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
            : ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
}

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, outerR: number, innerR: number, points: number) {
  for (let i = 0; i <= points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = (i * Math.PI) / points - Math.PI / 2;
    i === 0 ? ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
            : ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  ctx.closePath();
}

function arrowHead(ctx: CanvasRenderingContext2D, x2: number, y2: number, angle: number, size: number) {
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - size * Math.cos(angle - Math.PI / 6), y2 - size * Math.sin(angle - Math.PI / 6));
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - size * Math.cos(angle + Math.PI / 6), y2 - size * Math.sin(angle + Math.PI / 6));
}

function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, imgCache: Map<string, HTMLImageElement>) {
  ctx.save();
  ctx.globalAlpha = s.opacity;
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = s.size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const t = s.type;

  if (t === "pen" || t === "highlighter" || t === "eraser") {
    const pts = s.points || [];
    if (pts.length < 2) { ctx.restore(); return; }
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const mid = { x: (pts[i - 1].x + pts[i].x) / 2, y: (pts[i - 1].y + pts[i].y) / 2 };
      ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, mid.x, mid.y);
    }
    ctx.stroke();

  } else if (t === "text" && s.text && s.x != null && s.y != null) {
    ctx.font = `${s.size * 5}px Inter, sans-serif`;
    ctx.fillText(s.text, s.x, s.y);

  } else if (t === "line" && s.x1 != null) {
    ctx.beginPath();
    ctx.moveTo(s.x1!, s.y1!); ctx.lineTo(s.x2!, s.y2!);
    ctx.stroke();

  } else if (t === "arrow" && s.x1 != null) {
    const angle = Math.atan2(s.y2! - s.y1!, s.x2! - s.x1!);
    ctx.beginPath();
    ctx.moveTo(s.x1!, s.y1!); ctx.lineTo(s.x2!, s.y2!);
    arrowHead(ctx, s.x2!, s.y2!, angle, Math.max(12, s.size * 4));
    ctx.stroke();

  } else if (t === "rect" && s.x != null) {
    ctx.beginPath();
    ctx.strokeRect(s.x!, s.y!, s.w!, s.h!);

  } else if (t === "process" && s.x != null) {
    const r = 8;
    ctx.beginPath();
    ctx.roundRect(s.x!, s.y!, s.w!, s.h!, r);
    ctx.stroke();

  } else if (t === "terminal" && s.x != null) {
    const cx = s.x! + s.w! / 2, cy = s.y! + s.h! / 2;
    const rx = Math.abs(s.w!) / 2, ry = Math.abs(s.h!) / 2;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();

  } else if (t === "circle" && s.cx != null) {
    ctx.beginPath(); ctx.ellipse(s.cx!, s.cy!, s.rx!, s.ry!, 0, 0, Math.PI * 2); ctx.stroke();

  } else if (t === "triangle" && s.x != null) {
    const x = s.x!, y = s.y!, w = s.w!, h = s.h!;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath();
    ctx.stroke();

  } else if (t === "rtriangle" && s.x != null) {
    ctx.beginPath();
    ctx.moveTo(s.x!, s.y! + s.h!); ctx.lineTo(s.x!, s.y!); ctx.lineTo(s.x! + s.w!, s.y! + s.h!); ctx.closePath();
    ctx.stroke();

  } else if (t === "diamond" && s.x != null) {
    const cx = s.x! + s.w! / 2, cy = s.y! + s.h! / 2;
    ctx.beginPath();
    ctx.moveTo(cx, s.y!); ctx.lineTo(s.x! + s.w!, cy);
    ctx.lineTo(cx, s.y! + s.h!); ctx.lineTo(s.x!, cy); ctx.closePath();
    ctx.stroke();

  } else if (t === "pentagon" && s.x != null) {
    const cx = s.x! + s.w! / 2, cy = s.y! + s.h! / 2;
    const r = Math.min(Math.abs(s.w!), Math.abs(s.h!)) / 2;
    ctx.beginPath(); regularPolygon(ctx, cx, cy, r, 5); ctx.stroke();

  } else if (t === "hexagon" && s.x != null) {
    const cx = s.x! + s.w! / 2, cy = s.y! + s.h! / 2;
    const r = Math.min(Math.abs(s.w!), Math.abs(s.h!)) / 2;
    ctx.beginPath(); regularPolygon(ctx, cx, cy, r, 6, 0); ctx.stroke();

  } else if (t === "star5" && s.x != null) {
    const cx = s.x! + s.w! / 2, cy = s.y! + s.h! / 2;
    const outerR = Math.min(Math.abs(s.w!), Math.abs(s.h!)) / 2;
    ctx.beginPath(); star(ctx, cx, cy, outerR, outerR * 0.42, 5); ctx.stroke();

  } else if (t === "image" && s.imageData && s.x != null) {
    const cached = imgCache.get(s.id);
    if (cached) ctx.drawImage(cached, s.x!, s.y!, s.w!, s.h!);
  }

  ctx.restore();
}

function redraw(canvas: HTMLCanvasElement, strokes: Stroke[], imgCache: Map<string, HTMLImageElement>, preview?: Stroke | null) {
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  strokes.forEach(s => drawStroke(ctx, s, imgCache));
  if (preview) drawStroke(ctx, preview, imgCache);
}

const SHAPE_LIBRARY: { group: string; items: { id: Tool; label: string; icon: React.ReactNode }[] }[] = [
  {
    group: "Lines",
    items: [
      { id: "line", label: "Line", icon: <Minus className="h-4 w-4" /> },
      { id: "arrow", label: "Arrow", icon: <MoveRight className="h-4 w-4" /> },
    ],
  },
  {
    group: "Basic",
    items: [
      { id: "rect", label: "Rectangle", icon: <Square className="h-4 w-4" /> },
      { id: "circle", label: "Ellipse", icon: <CircleIcon className="h-4 w-4" /> },
    ],
  },
  {
    group: "Polygons",
    items: [
      { id: "triangle", label: "Triangle", icon: <Triangle className="h-4 w-4" /> },
      { id: "rtriangle", label: "Right △", icon: <span className="text-[10px] font-bold">R△</span> },
      { id: "diamond", label: "Diamond", icon: <Diamond className="h-4 w-4" /> },
      { id: "pentagon", label: "Pentagon", icon: <span className="text-[10px] font-bold">5▪</span> },
      { id: "hexagon", label: "Hexagon", icon: <Hexagon className="h-4 w-4" /> },
      { id: "star5", label: "Star", icon: <Star className="h-4 w-4" /> },
    ],
  },
  {
    group: "Flowchart",
    items: [
      { id: "process", label: "Process", icon: <span className="text-[9px] font-bold border border-current rounded px-0.5">P</span> },
      { id: "diamond", label: "Decision", icon: <Diamond className="h-4 w-4" /> },
      { id: "terminal", label: "Terminal", icon: <span className="text-[9px] font-bold border border-current rounded-full px-0.5">T</span> },
    ],
  },
];

const isLineTool = (t: Tool) => t === "line" || t === "arrow";
const isBoxTool = (t: Tool) => !["pen","highlighter","eraser","text","line","arrow"].includes(t);
const isPathTool = (t: Tool) => ["pen","highlighter","eraser"].includes(t);

interface Notebook { id: number; title: string; cover_color: string; created_at: string; }
interface NotebookPage { id: number; notebook_id: number; title: string; page_number: number; updated_at: string; }

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
  const [shapePanelOpen, setShapePanelOpen] = useState(false);
  const [notebookPanelOpen, setNotebookPanelOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  const [textInput, setTextInput] = useState<{ x: number; y: number; value: string } | null>(null);

  // Notebooks state
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [pages, setPages] = useState<Record<number, NotebookPage[]>>({});
  const [expandedNotebook, setExpandedNotebook] = useState<number | null>(null);
  const [activePageId, setActivePageId] = useState<number | null>(null);
  const [activePageTitle, setActivePageTitle] = useState<string | null>(null);
  const [newNotebookTitle, setNewNotebookTitle] = useState("");
  const [creatingNotebook, setCreatingNotebook] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState<Record<number, string>>({});
  const [creatingPage, setCreatingPage] = useState<number | null>(null);

  const loadNotebooks = useCallback(async () => {
    try {
      const res = await fetch("/api/notebooks", { headers: { Authorization: `Bearer ${tok()}` } });
      if (res.ok) setNotebooks(await res.json());
    } catch {}
  }, []);

  const loadPages = useCallback(async (notebookId: number) => {
    try {
      const res = await fetch(`/api/notebooks/${notebookId}/pages`, { headers: { Authorization: `Bearer ${tok()}` } });
      if (res.ok) {
        const data = await res.json();
        setPages(prev => ({ ...prev, [notebookId]: data }));
      }
    } catch {}
  }, []);

  useEffect(() => { if (notebookPanelOpen) loadNotebooks(); }, [notebookPanelOpen, loadNotebooks]);

  const handleToggleNotebook = async (id: number) => {
    if (expandedNotebook === id) { setExpandedNotebook(null); return; }
    setExpandedNotebook(id);
    if (!pages[id]) await loadPages(id);
  };

  const handleLoadPage = async (page: NotebookPage) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/notebooks/pages/${page.id}`, { headers: { Authorization: `Bearer ${tok()}` } });
      if (res.ok) {
        const data = await res.json();
        const content = data.content ? (typeof data.content === "string" ? JSON.parse(data.content) : data.content) : [];
        strokes.current = Array.isArray(content) ? content : [];
        undone.current = [];
        rerender();
        setActivePageId(page.id);
        setActivePageTitle(page.title);
        toast({ title: `Loaded: ${page.title}` });
      }
    } catch { toast({ title: "Failed to load page", variant: "destructive" }); }
    finally { setLoading(false); }
  };

  const handleCreateNotebook = async () => {
    const title = newNotebookTitle.trim() || "Untitled Notebook";
    try {
      const res = await fetch("/api/notebooks", {
        method: "POST",
        headers: { Authorization: `Bearer ${tok()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ title, coverColor: TEAL }),
      });
      if (res.ok) {
        await loadNotebooks();
        setNewNotebookTitle("");
        setCreatingNotebook(false);
      }
    } catch {}
  };

  const handleCreatePage = async (notebookId: number) => {
    const title = (newPageTitle[notebookId] || "").trim() || "New Page";
    try {
      const res = await fetch(`/api/notebooks/${notebookId}/pages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tok()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (res.ok) {
        await loadPages(notebookId);
        setNewPageTitle(prev => ({ ...prev, [notebookId]: "" }));
        setCreatingPage(null);
      }
    } catch {}
  };

  const handleDeletePage = async (pageId: number, notebookId: number) => {
    try {
      await fetch(`/api/notebooks/pages/${pageId}`, { method: "DELETE", headers: { Authorization: `Bearer ${tok()}` } });
      if (activePageId === pageId) { setActivePageId(null); setActivePageTitle(null); }
      await loadPages(notebookId);
    } catch {}
  };

  const strokes = useRef<Stroke[]>([]);
  const undone = useRef<Stroke[]>([]);
  const current = useRef<Stroke | null>(null);
  const drawing = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const imgCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const [, forceUpdate] = useState(0);

  const rerender = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    redraw(c, strokes.current, imgCache.current, current.current);
    forceUpdate(n => n + 1);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/inkspace/load`, { headers: { Authorization: `Bearer ${tok()}` } });
        if (res.ok) {
          const data = await res.json();
          if (data.strokes?.length) { strokes.current = data.strokes; rerender(); }
        }
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current, container = containerRef.current;
    if (!canvas || !container) return;
    const resize = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      redraw(canvas, strokes.current, imgCache.current);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [fullscreen, shapePanelOpen, notebookPanelOpen]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const src = "touches" in e ? e.touches[0] : e as React.MouseEvent;
    return { x: (src.clientX - rect.left) * scaleX, y: (src.clientY - rect.top) * scaleY };
  };

  const getScreenPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const src = "touches" in e ? e.touches[0] : e as React.MouseEvent;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    if ("touches" in e) e.preventDefault();
    if (textInput) return;
    drawing.current = true;
    undone.current = [];
    const pos = getPos(e);
    startPos.current = pos;

    if (tool === "text") {
      const sp = getScreenPos(e);
      setTextInput({ x: sp.x, y: sp.y, value: "" });
      drawing.current = false;
      return;
    }

    if (isPathTool(tool)) {
      current.current = {
        id: uid(), type: tool,
        color: tool === "eraser" ? "#FFFFFF" : color,
        size: tool === "highlighter" ? size * 4 : size,
        opacity: tool === "highlighter" ? 0.35 : 1,
        points: [pos],
      };
    } else if (isLineTool(tool)) {
      current.current = {
        id: uid(), type: tool, color, size, opacity: 1,
        x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y,
      };
    } else if (tool === "circle") {
      current.current = {
        id: uid(), type: "circle", color, size, opacity: 1,
        cx: pos.x, cy: pos.y, rx: 0, ry: 0,
      };
    } else if (isBoxTool(tool)) {
      current.current = {
        id: uid(), type: tool, color, size, opacity: 1,
        x: pos.x, y: pos.y, w: 0, h: 0,
      };
    }
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current || !current.current) return;
    if ("touches" in e) e.preventDefault();
    const pos = getPos(e);

    if (isPathTool(tool) && current.current.points) {
      current.current = { ...current.current, points: [...current.current.points, pos] };
    } else if (isLineTool(tool)) {
      current.current = { ...current.current, x2: pos.x, y2: pos.y };
    } else if (tool === "circle") {
      const dx = pos.x - startPos.current.x, dy = pos.y - startPos.current.y;
      current.current = {
        ...current.current, rx: Math.abs(dx) / 2, ry: Math.abs(dy) / 2,
        cx: startPos.current.x + dx / 2, cy: startPos.current.y + dy / 2,
      };
    } else if (isBoxTool(tool)) {
      current.current = {
        ...current.current,
        w: pos.x - startPos.current.x,
        h: pos.y - startPos.current.y,
      };
    }
    redraw(canvasRef.current!, strokes.current, imgCache.current, current.current);
  };

  const handlePointerUp = () => {
    if (!drawing.current || !current.current) return;
    drawing.current = false;
    strokes.current = [...strokes.current, current.current];
    current.current = null;
    rerender();
  };

  const commitText = () => {
    if (!textInput || !textInput.value.trim()) { setTextInput(null); return; }
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height;
    const s: Stroke = {
      id: uid(), type: "text", color, size, opacity: 1,
      text: textInput.value,
      x: textInput.x * scaleX, y: textInput.y * scaleY + size * 5,
    };
    strokes.current = [...strokes.current, s];
    setTextInput(null);
    rerender();
  };

  const importImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const dataURL = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current!;
        const maxW = canvas.width * 0.6, maxH = canvas.height * 0.6;
        const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
        const w = img.width * ratio, h = img.height * ratio;
        const id = uid();
        imgCache.current.set(id, img);
        const s: Stroke = {
          id, type: "image", color: "#000", size: 1, opacity: 1,
          imageData: dataURL,
          x: (canvas.width - w) / 2, y: (canvas.height - h) / 2,
          w, h,
        };
        strokes.current = [...strokes.current, s];
        rerender();
        toast({ title: "Image imported ✅" });
      };
      img.src = dataURL;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const undo = () => {
    if (!strokes.current.length) return;
    undone.current = [...undone.current, strokes.current[strokes.current.length - 1]];
    strokes.current = strokes.current.slice(0, -1);
    rerender();
  };
  const redo = () => {
    if (!undone.current.length) return;
    strokes.current = [...strokes.current, undone.current[undone.current.length - 1]];
    undone.current = undone.current.slice(0, -1);
    rerender();
  };
  const clearAll = () => {
    undone.current = [...strokes.current.slice().reverse(), ...undone.current];
    strokes.current = [];
    rerender();
  };
  const exportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `inkspace-${Date.now()}.png`;
    a.click();
    toast({ title: "Exported PNG ✅" });
  };
  const save = async () => {
    setSaving(true);
    const payload = strokes.current.map(s => s.type === "image" ? { ...s, imageData: undefined } : s);
    try {
      if (activePageId) {
        await fetch(`/api/notebooks/pages/${activePageId}`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${tok()}`, "Content-Type": "application/json" },
          body: JSON.stringify({ content: JSON.stringify(payload) }),
        });
        toast({ title: `Saved to "${activePageTitle}" ✅` });
      } else {
        await fetch(`/api/inkspace/save`, {
          method: "POST",
          headers: { Authorization: `Bearer ${tok()}`, "Content-Type": "application/json" },
          body: JSON.stringify({ strokes: payload }),
        });
        toast({ title: "Saved ✅" });
      }
    } catch { toast({ title: "Save failed", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const cursor = tool === "eraser" ? "cell" : tool === "text" ? "text" : "crosshair";

  const BASIC_TOOLS = [
    { id: "pen" as Tool, label: "Pen", icon: <Pencil className="h-3.5 w-3.5" /> },
    { id: "highlighter" as Tool, label: "Highlighter", icon: <Highlighter className="h-3.5 w-3.5" /> },
    { id: "eraser" as Tool, label: "Eraser", icon: <Eraser className="h-3.5 w-3.5" /> },
    { id: "text" as Tool, label: "Text", icon: <Type className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className={fullscreen ? "fixed inset-0 z-50 bg-white flex flex-col" : "flex flex-col bg-[#F5F5F5]"} style={fullscreen ? {} : { height: "calc(100vh - 48px)" }}>

      {/* ── TOOLBAR ── */}
      <div className="bg-white border-b px-3 py-2 flex items-center gap-2 flex-wrap shrink-0 shadow-sm">
        <div className="flex items-center gap-1.5 mr-1">
          <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: `${TEAL}15` }}>
            <PenLine className="h-4 w-4" style={{ color: TEAL }} />
          </div>
          <span className="font-bold text-sm text-gray-900 hidden sm:block">InkSpace</span>
        </div>

        {/* Basic tools */}
        <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
          {BASIC_TOOLS.map(t => (
            <button key={t.id} title={t.label} onClick={() => setTool(t.id)}
              className={`h-7 w-7 rounded-md flex items-center justify-center transition-all ${
                tool === t.id ? "bg-white shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
              style={tool === t.id ? { color: TEAL } : {}}>
              {t.icon}
            </button>
          ))}
        </div>

        {/* Shapes toggle */}
        <button
          onClick={() => { setShapePanelOpen(o => !o); setNotebookPanelOpen(false); }}
          title="Shape Library"
          className={`h-7 px-2 rounded-lg flex items-center gap-1 text-xs font-medium transition-all ${
            shapePanelOpen ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
          style={shapePanelOpen ? { background: TEAL } : {}}>
          <Shapes className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Shapes</span>
        </button>

        {/* Notebooks toggle */}
        <button
          onClick={() => { setNotebookPanelOpen(o => !o); setShapePanelOpen(false); }}
          title="Notebooks"
          className={`h-7 px-2 rounded-lg flex items-center gap-1 text-xs font-medium transition-all ${
            notebookPanelOpen ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
          style={notebookPanelOpen ? { background: TEAL } : {}}>
          <BookOpen className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Notebooks</span>
        </button>

        {/* Active page indicator */}
        {activePageTitle && (
          <div className="flex items-center gap-1.5 px-2 h-7 bg-[#00796B]/10 rounded-lg">
            <FileText className="h-3 w-3 text-[#00796B]" />
            <span className="text-xs font-medium text-[#00796B] max-w-[120px] truncate">{activePageTitle}</span>
            <button onClick={() => { setActivePageId(null); setActivePageTitle(null); strokes.current = []; undone.current = []; rerender(); }} className="text-[#00796B]/60 hover:text-[#00796B] ml-0.5">
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Size */}
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <span>Size</span>
          <input type="range" min={1} max={20} value={size}
            onChange={e => setSize(Number(e.target.value))}
            className="w-16 accent-[#00796B]" />
          <span className="w-4 tabular-nums">{size}</span>
        </div>

        {/* Palette */}
        <div className="flex items-center gap-0.5 flex-wrap">
          {PALETTE.map(c => (
            <button key={c} onClick={() => { setColor(c); if (tool === "eraser") setTool("pen"); }}
              className={`w-4 h-4 rounded-full border-2 transition-transform hover:scale-110 ${color === c && tool !== "eraser" ? "border-[#00796B] scale-110" : "border-transparent"}`}
              style={{ background: c, boxShadow: c === "#FFFFFF" ? "inset 0 0 0 1px #E5E7EB" : undefined }} />
          ))}
          <input type="color" value={color} title="Custom color"
            onChange={e => { setColor(e.target.value); if (tool === "eraser") setTool("pen"); }}
            className="w-4 h-4 rounded-full border-2 border-dashed border-gray-300 cursor-pointer bg-transparent" />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 ml-auto">
          <button onClick={undo} title="Undo" className="h-7 w-7 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800">
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={redo} title="Redo" className="h-7 w-7 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800">
            <Redo2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={clearAll} title="Clear all" className="h-7 w-7 flex items-center justify-center rounded-md text-red-400 hover:bg-red-50 hover:text-red-600">
            <Trash2 className="h-3.5 w-3.5" />
          </button>

          <div className="w-px h-5 bg-gray-200 mx-1" />

          {/* Image import */}
          <label title="Import Image (PNG/JPG)" className="h-7 w-7 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800 cursor-pointer">
            <Upload className="h-3.5 w-3.5" />
            <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp" className="hidden" onChange={importImage} />
          </label>

          {/* PDF annotation coming soon */}
          <div className="relative group">
            <button disabled className="h-7 px-1.5 flex items-center gap-1 text-xs rounded-md text-gray-300 cursor-not-allowed">
              <span>PDF</span>
              <Badge className="text-[8px] px-1 py-0 rounded-full bg-amber-100 text-amber-700 border-0 ml-0.5">Soon</Badge>
            </button>
          </div>

          <div className="w-px h-5 bg-gray-200 mx-1" />

          <button onClick={exportPNG} title="Export PNG" className="h-7 w-7 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800">
            <Download className="h-3.5 w-3.5" />
          </button>
          <button onClick={save} disabled={saving} title="Save"
            className="h-7 px-2 flex items-center gap-1 text-xs font-semibold rounded-md hover:bg-[#00796B]/10 transition-colors"
            style={{ color: TEAL }}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Save</span>
          </button>
          <button onClick={() => setFullscreen(f => !f)} title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            className="h-7 w-7 flex items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-800">
            {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* ── BODY: notebook panel + shape panel + canvas ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Notebooks panel */}
        <AnimatePresence>
          {notebookPanelOpen && (
            <motion.div
              key="notebook-panel"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 220, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden shrink-0 bg-white border-r border-gray-100 flex flex-col"
            >
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Notebooks</span>
                <button
                  onClick={() => setCreatingNotebook(true)}
                  className="h-5 w-5 flex items-center justify-center rounded text-gray-400 hover:text-[#00796B] hover:bg-[#00796B]/10 transition-colors"
                  title="New notebook"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {/* New notebook form */}
                {creatingNotebook && (
                  <div className="flex gap-1 mb-2">
                    <Input
                      autoFocus
                      value={newNotebookTitle}
                      onChange={e => setNewNotebookTitle(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleCreateNotebook(); if (e.key === "Escape") setCreatingNotebook(false); }}
                      placeholder="Notebook name…"
                      className="h-7 text-xs flex-1"
                    />
                    <button onClick={handleCreateNotebook} className="h-7 w-7 flex items-center justify-center rounded bg-[#00796B] text-white">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setCreatingNotebook(false)} className="h-7 w-7 flex items-center justify-center rounded text-gray-400 hover:bg-gray-100">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {notebooks.length === 0 && !creatingNotebook && (
                  <div className="py-8 text-center">
                    <BookOpen className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                    <p className="text-xs text-gray-400">No notebooks yet</p>
                    <button onClick={() => setCreatingNotebook(true)} className="mt-2 text-xs text-[#00796B] hover:underline">Create one</button>
                  </div>
                )}

                {notebooks.map(nb => (
                  <div key={nb.id}>
                    <button
                      onClick={() => handleToggleNotebook(nb.id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors text-left group"
                    >
                      {expandedNotebook === nb.id
                        ? <FolderOpen className="h-3.5 w-3.5 shrink-0" style={{ color: nb.cover_color || TEAL }} />
                        : <Folder className="h-3.5 w-3.5 shrink-0" style={{ color: nb.cover_color || TEAL }} />
                      }
                      <span className="text-xs font-medium text-gray-700 flex-1 truncate">{nb.title}</span>
                      {expandedNotebook === nb.id
                        ? <ChevronDown className="h-3 w-3 text-gray-400 shrink-0" />
                        : <ChevronRightIcon className="h-3 w-3 text-gray-400 shrink-0" />
                      }
                    </button>

                    {expandedNotebook === nb.id && (
                      <div className="ml-4 mt-0.5 space-y-0.5 border-l border-gray-100 pl-2">
                        {(pages[nb.id] || []).map(pg => (
                          <div key={pg.id} className={`group flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer transition-colors ${activePageId === pg.id ? "bg-[#00796B]/10 text-[#00796B]" : "hover:bg-gray-50 text-gray-600"}`}>
                            <FileText className="h-3 w-3 shrink-0" />
                            <span
                              className="text-xs flex-1 truncate"
                              onClick={() => handleLoadPage(pg)}
                            >{pg.title}</span>
                            <button
                              onClick={() => handleDeletePage(pg.id, nb.id)}
                              className="opacity-0 group-hover:opacity-100 h-4 w-4 flex items-center justify-center rounded text-red-300 hover:text-red-500 transition-opacity"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        ))}

                        {/* New page form */}
                        {creatingPage === nb.id ? (
                          <div className="flex gap-1 pt-1">
                            <Input
                              autoFocus
                              value={newPageTitle[nb.id] || ""}
                              onChange={e => setNewPageTitle(prev => ({ ...prev, [nb.id]: e.target.value }))}
                              onKeyDown={e => { if (e.key === "Enter") handleCreatePage(nb.id); if (e.key === "Escape") setCreatingPage(null); }}
                              placeholder="Page name…"
                              className="h-6 text-xs flex-1"
                            />
                            <button onClick={() => handleCreatePage(nb.id)} className="h-6 w-6 flex items-center justify-center rounded bg-[#00796B] text-white">
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setCreatingPage(nb.id)}
                            className="w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-gray-400 hover:text-[#00796B] hover:bg-[#00796B]/5 transition-colors"
                          >
                            <Plus className="h-3 w-3" />
                            <span className="text-xs">New page</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Shape panel */}
        <AnimatePresence>
          {shapePanelOpen && (
            <motion.div
              key="shape-panel"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 168, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden shrink-0 bg-white border-r border-gray-100 flex flex-col"
            >
              <div className="p-3 space-y-3 overflow-y-auto flex-1">
                {SHAPE_LIBRARY.map(group => (
                  <div key={group.group}>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">{group.group}</p>
                    <div className="grid grid-cols-3 gap-1">
                      {group.items.map(item => (
                        <button
                          key={`${group.group}-${item.id}`}
                          onClick={() => setTool(item.id)}
                          className={`flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] font-medium transition-all border ${
                            tool === item.id
                              ? "border-[#00796B] bg-[#00796B]/8 text-[#00796B]"
                              : "border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                          }`}
                          style={tool === item.id ? { color: TEAL, background: `${TEAL}10` } : {}}
                        >
                          {item.icon}
                          <span className="leading-none text-center">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Coming soon section */}
                <div>
                  <p className="text-[10px] font-bold text-gray-300 uppercase tracking-wide mb-1.5">Coming Soon</p>
                  {["Lasso Select", "PDF Annotate", "Handwriting OCR", "Smart Connectors"].map(name => (
                    <div key={name} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-gray-50 mb-1">
                      <span className="text-[10px] text-gray-400">{name}</span>
                      <Badge className="text-[8px] px-1 py-0 bg-amber-50 text-amber-600 border-0 rounded-full">Soon</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Canvas area */}
        <div ref={containerRef} className="flex-1 relative overflow-hidden bg-white">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: TEAL }} />
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

          {/* Floating text input */}
          {textInput && (
            <input
              autoFocus
              value={textInput.value}
              onChange={e => setTextInput({ ...textInput, value: e.target.value })}
              onKeyDown={e => { if (e.key === "Enter") commitText(); if (e.key === "Escape") setTextInput(null); }}
              onBlur={commitText}
              placeholder="Type and press Enter…"
              className="absolute border-2 rounded px-2 py-1 text-sm outline-none shadow-lg bg-white/95"
              style={{
                left: textInput.x, top: textInput.y - 8,
                borderColor: TEAL, color, minWidth: 120,
                fontSize: `${Math.max(12, size * 5)}px`,
              }}
            />
          )}

          {strokes.current.length === 0 && !loading && !textInput && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <PenLine className="h-12 w-12 text-gray-100 mx-auto mb-3" />
                <p className="text-sm text-gray-300 font-medium">Start drawing</p>
                <p className="text-xs text-gray-200 mt-1">Use the toolbar above · import images · save your work</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
