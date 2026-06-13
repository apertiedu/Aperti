import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Calculator, Triangle, Circle, Square, Compass, Ruler,
  RotateCcw, Download, ChevronRight, Play, BookOpen, Star, Layers,
  GitBranch, Maximize, Grid,
} from "lucide-react";

const API = "/api";
async function fetchJSON(url: string, opts?: RequestInit) {
  const res = await fetch(`${API}${url}`, {
    headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) },
    ...opts,
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

const MODULE_ICONS: Record<string, any> = {
  "shapes-2d": Square, "shapes-3d": Layers, "transformations": RotateCcw,
  "vectors": GitBranch, "trigonometry": Calculator, "circle-theorems": Circle,
  "construction": Compass, "loci": Grid,
};

// Interactive 2D canvas-based geometry board
function GeometryCanvas({ module, tools }: { module: any; tools: string[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeTool, setActiveTool] = useState(tools[0] || "ruler");
  const [shapes, setShapes] = useState<any[]>([]);
  const [drawingMode, setDrawingMode] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [showGrid, setShowGrid] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= canvas.width; x += 20) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y <= canvas.height; y += 20) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }
    }

    // Draw axes
    ctx.strokeStyle = "#9ca3af"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(canvas.width / 2, 0); ctx.lineTo(canvas.width / 2, canvas.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, canvas.height / 2); ctx.lineTo(canvas.width, canvas.height / 2); ctx.stroke();

    // Draw shapes
    shapes.forEach(shape => {
      ctx.strokeStyle = "#0d9488"; ctx.fillStyle = "rgba(13,148,136,0.1)"; ctx.lineWidth = 2;
      if (shape.type === "line") {
        ctx.beginPath(); ctx.moveTo(shape.x1, shape.y1); ctx.lineTo(shape.x2, shape.y2); ctx.stroke();
      } else if (shape.type === "circle") {
        const r = Math.sqrt((shape.x2-shape.x1)**2+(shape.y2-shape.y1)**2);
        ctx.beginPath(); ctx.arc(shape.x1, shape.y1, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      } else if (shape.type === "rect") {
        ctx.beginPath(); ctx.rect(shape.x1, shape.y1, shape.x2-shape.x1, shape.y2-shape.y1); ctx.fill(); ctx.stroke();
      }
    });
  }, [shapes, showGrid]);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setStartPoint({ x, y });
    setDrawingMode(true);
  };

  const handleCanvasMouseUp = (e: React.MouseEvent) => {
    if (!startPoint || !drawingMode) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x2 = e.clientX - rect.left;
    const y2 = e.clientY - rect.top;
    const shapeType = activeTool === "compass" ? "circle" : activeTool === "ruler" ? "line" : "rect";
    setShapes(prev => [...prev, { type: shapeType, x1: startPoint.x, y1: startPoint.y, x2, y2 }]);
    setStartPoint(null);
    setDrawingMode(false);
  };

  const clearCanvas = () => setShapes([]);

  const saveSession = useMutation({
    mutationFn: () => fetchJSON("/geometrix/sessions", { method: "POST", body: JSON.stringify({ module: module.id, tool: activeTool, data: { shapes } }) }),
    onSuccess: () => {},
  });

  const TOOL_ICONS: Record<string, any> = { ruler: Ruler, compass: Compass, protractor: Calculator, grid: Grid, rotate: RotateCcw, reflect: GitBranch };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {tools.map(t => {
          const Icon = TOOL_ICONS[t] || Calculator;
          return (
            <button key={t} onClick={() => setActiveTool(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 border transition-all ${activeTool === t ? "bg-teal-600 text-white border-teal-600" : "bg-white text-gray-600 border-gray-200 hover:border-teal-300"}`}>
              <Icon size={12} /> {t}
            </button>
          );
        })}
        <div className="ml-auto flex gap-2">
          <button onClick={() => setShowGrid(!showGrid)} className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${showGrid ? "bg-gray-100 border-gray-300" : "bg-white border-gray-200"}`}>
            <Grid size={12} />
          </button>
          <button onClick={clearCanvas} className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 bg-white hover:bg-red-50 hover:border-red-300 transition-all">
            <RotateCcw size={12} />
          </button>
          <Button size="sm" className="h-7 text-xs bg-teal-600 hover:bg-teal-700 text-white" onClick={() => saveSession.mutate()}>Save</Button>
        </div>
      </div>
      <div className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden cursor-crosshair">
        <canvas ref={canvasRef} width={700} height={420} className="w-full"
          onMouseDown={handleCanvasMouseDown} onMouseUp={handleCanvasMouseUp} />
      </div>
      <p className="text-xs text-gray-400 text-center">
        {activeTool === "ruler" ? "Click and drag to draw a line" :
         activeTool === "compass" ? "Click and drag to draw a circle" :
         "Click and drag to draw a shape"}
      </p>
    </div>
  );
}

export default function SimverseGeometrix() {
  const [, navigate] = useLocation();
  const [activeModule, setActiveModule] = useState<any>(null);

  const { data: modules, isLoading } = useQuery({
    queryKey: ["geometrix-modules"],
    queryFn: () => fetchJSON("/geometrix/modules"),
  });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/simverse/labs")}><ArrowLeft size={16} /></Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3"><Calculator className="text-teal-600" size={28} /> Geometrix</h1>
            <p className="text-gray-500 mt-1">Interactive geometry labs — from basic shapes to advanced constructions</p>
          </div>
          <Badge className="bg-purple-100 text-purple-700 border-purple-200">Mathematics</Badge>
        </motion.div>

        <AnimatePresence mode="wait">
          {activeModule ? (
            <motion.div key="module" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => setActiveModule(null)}><ArrowLeft size={16} /></Button>
                <div>
                  <h2 className="font-bold text-gray-800">{activeModule.name}</h2>
                  <p className="text-xs text-gray-500">{activeModule.description}</p>
                </div>
              </div>
              <GeometryCanvas module={activeModule} tools={activeModule.tools || ["ruler", "compass"]} />
            </motion.div>
          ) : (
            <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {Array(8).fill(0).map((_, i) => <div key={i} className="h-48 bg-gray-200 animate-pulse rounded-2xl" />)}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {(modules || []).map((mod: any, i: number) => {
                    const Icon = MODULE_ICONS[mod.id] || Calculator;
                    return (
                      <motion.div key={mod.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                        whileHover={{ y: -4, boxShadow: "0 8px 25px rgba(0,0,0,0.1)" }}
                        className="bg-white border border-gray-100 rounded-2xl p-5 cursor-pointer hover:border-purple-300 transition-all"
                        onClick={() => setActiveModule(mod)}>
                        <div className="w-12 h-12 bg-purple-100 text-purple-700 rounded-xl flex items-center justify-center mb-4">
                          <Icon size={22} />
                        </div>
                        <h3 className="font-bold text-gray-800 mb-1 text-sm">{mod.name}</h3>
                        <p className="text-xs text-gray-500 leading-relaxed mb-4">{mod.description}</p>
                        <div className="flex flex-wrap gap-1 mb-3">
                          {(mod.tools || []).slice(0, 3).map((t: string) => (
                            <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                          ))}
                          {(mod.tools || []).length > 3 && <Badge variant="outline" className="text-xs">+{mod.tools.length - 3}</Badge>}
                        </div>
                        <Button size="sm" className="w-full h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white">
                          <Play size={12} className="mr-1" /> Open Lab
                        </Button>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
