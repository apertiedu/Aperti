import { useRef, useEffect, useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Minus, Eraser, Trash2, PenLine } from "lucide-react";
import type { DrawEvent } from "@/hooks/use-live-class";

const COLORS = ["#000000", "#ffffff", "#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899"];

interface Props {
  canDraw: boolean;
  remoteEvents: DrawEvent[];
  clearTrigger: number;
  onDraw: (evt: DrawEvent) => void;
  onClear: () => void;
  className?: string;
}

function applyEvent(ctx: CanvasRenderingContext2D, w: number, h: number, evt: DrawEvent) {
  ctx.beginPath();
  ctx.moveTo(evt.lastX * w, evt.lastY * h);
  ctx.lineTo(evt.x * w, evt.y * h);
  ctx.strokeStyle = evt.tool === "eraser" ? "#1a1a2e" : evt.color;
  ctx.lineWidth = evt.tool === "eraser" ? evt.size * 3 : evt.size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
}

export default function Whiteboard({ canDraw, remoteEvents, clearTrigger, onDraw, onClear, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const processedCount = useRef(0);

  const [color, setColor] = useState("#000000");
  const [size, setSize] = useState(3);
  const [tool, setTool] = useState<"pen" | "eraser">("pen");

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    processedCount.current = 0;
  }, []);

  useEffect(() => { clearCanvas(); }, [clearCanvas]);
  useEffect(() => { clearCanvas(); }, [clearTrigger, clearCanvas]);

  // Apply only NEW remote events
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const newEvents = remoteEvents.slice(processedCount.current);
    newEvents.forEach(evt => applyEvent(ctx, canvas.width, canvas.height, evt));
    processedCount.current = remoteEvents.length;
  }, [remoteEvents]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    };
  };

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!canDraw) return;
    drawing.current = true;
    lastPos.current = getPos(e);
  }, [canDraw]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current || !canDraw) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e);
    const evt: DrawEvent = {
      tool, color, size,
      lastX: lastPos.current.x,
      lastY: lastPos.current.y,
      x: pos.x,
      y: pos.y,
    };
    applyEvent(ctx, canvas.width, canvas.height, evt);
    onDraw(evt);
    lastPos.current = pos;
  }, [canDraw, tool, color, size, onDraw]);

  const stopDraw = useCallback(() => { drawing.current = false; }, []);

  return (
    <div className={`flex flex-col ${className ?? ""}`}>
      {canDraw && (
        <div className="flex items-center gap-2 p-2 bg-card border-b flex-wrap">
          <Button
            variant={tool === "pen" ? "default" : "outline"}
            size="sm"
            onClick={() => setTool("pen")}
            className="h-7 px-2"
          >
            <PenLine className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={tool === "eraser" ? "default" : "outline"}
            size="sm"
            onClick={() => setTool("eraser")}
            className="h-7 px-2"
          >
            <Eraser className="h-3.5 w-3.5" />
          </Button>
          <div className="flex items-center gap-1">
            <Minus className="h-3 w-3 text-muted-foreground" />
            <input
              type="range" min={1} max={16} value={size}
              onChange={e => setSize(Number(e.target.value))}
              className="w-20 accent-primary"
            />
          </div>
          <div className="flex gap-1">
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => { setColor(c); setTool("pen"); }}
                className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${color === c && tool === "pen" ? "border-primary scale-110" : "border-transparent"}`}
                style={{ background: c }}
              />
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-7 px-2 ml-auto text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={1280}
        height={720}
        className={`flex-1 w-full h-full object-contain ${canDraw ? "cursor-crosshair" : "cursor-default"}`}
        style={{ background: "#1a1a2e" }}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={stopDraw}
        onMouseLeave={stopDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={stopDraw}
      />
    </div>
  );
}
