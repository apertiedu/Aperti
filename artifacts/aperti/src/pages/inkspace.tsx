import { useState, useRef } from "react";
import { motion } from "framer-motion";
import CanvasDraw from "react-canvas-draw";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pencil, Eraser, RotateCcw, Download, Grid3X3 } from "lucide-react";

export default function InkSpace() {
  const canvasRef = useRef<CanvasDraw>(null);
  const [brushColor, setBrushColor] = useState("#000000");
  const [brushRadius, setBrushRadius] = useState(3);
  const [showGrid, setShowGrid] = useState(false);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");

  const colors = ["#000000", "#00796B", "#E53935", "#1E88E5", "#F9A825"];

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
        <h1 className="text-3xl font-bold">InkSpace<span className="text-primary"></span></h1>
        <p className="text-muted-foreground">Your digital notebook. Write, draw, think.</p>
      </motion.div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-card border rounded-xl">
        <Button variant={tool === "pen" ? "default" : "outline"} size="sm" onClick={() => setTool("pen")}>
          <Pencil className="h-4 w-4 mr-1" /> Pen
        </Button>
        <Button variant={tool === "eraser" ? "default" : "outline"} size="sm" onClick={() => setTool("eraser")}>
          <Eraser className="h-4 w-4 mr-1" /> Eraser
        </Button>
        <div className="flex gap-1">
          {colors.map(c => (
            <button key={c} className="w-6 h-6 rounded-full border-2 border-border" style={{ backgroundColor: c }} onClick={() => { setBrushColor(c); setTool("pen"); }} />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Size</span>
          <Slider className="w-24" value={[brushRadius]} min={1} max={20} onValueChange={([v]) => setBrushRadius(v)} />
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowGrid(!showGrid)}>
          <Grid3X3 className="h-4 w-4 mr-1" /> {showGrid ? "Hide Grid" : "Show Grid"}
        </Button>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => canvasRef.current?.undo()}>
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => canvasRef.current?.clear()}>Clear</Button>
        <Button variant="outline" size="sm" onClick={() => {
          const data = canvasRef.current?.getDataURL();
          if (data) {
            const a = document.createElement("a"); a.href = data; a.download = "inkspace.png"; a.click();
          }
        }}>
          <Download className="h-4 w-4" />
        </Button>
      </div>

      {/* Canvas */}
      <Card className="card-hover overflow-hidden">
        <CardContent className="p-0 relative">
          {showGrid && (
            <div className="absolute inset-0 pointer-events-none" style={{
              backgroundImage: "repeating-linear-gradient(0deg, #e0e0e0, #e0e0e0 1px, transparent 1px, transparent 20px), repeating-linear-gradient(90deg, #e0e0e0, #e0e0e0 1px, transparent 1px, transparent 20px)",
              zIndex: 1,
            }} />
          )}
          <CanvasDraw
            ref={canvasRef}
            brushColor={tool === "eraser" ? "#FFFFFF" : brushColor}
            brushRadius={brushRadius}
            canvasWidth={window.innerWidth - 64}
            canvasHeight={500}
            hideGrid
            className="w-full"
          />
        </CardContent>
      </Card>
    </div>
  );
}
