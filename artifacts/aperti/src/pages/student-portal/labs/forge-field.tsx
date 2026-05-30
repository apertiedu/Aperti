import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Pause, RotateCcw } from "lucide-react";

// Simple circuit model
interface Component {
  id: string;
  type: "battery" | "bulb" | "switch" | "resistor" | "wire";
  x: number;
  y: number;
  connectedTo?: string[];
  on?: boolean;
}

const initialComponents: Component[] = [
  { id: "bat", type: "battery", x: 100, y: 150 },
  { id: "bulb1", type: "bulb", x: 300, y: 150 },
  { id: "sw1", type: "switch", x: 200, y: 250 },
];

export default function ForgeField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [components, setComponents] = useState<Component[]>(initialComponents);
  const [running, setRunning] = useState(false);
  const [switchClosed, setSwitchClosed] = useState(false);
  const [batteryOn, setBatteryOn] = useState(true);
  const [bulbGlows, setBulbGlows] = useState(false);
  const requestRef = useRef<number>();

  // Simulate circuit logic
  useEffect(() => {
    if (batteryOn && switchClosed && running) {
      setBulbGlows(true);
    } else {
      setBulbGlows(false);
    }
  }, [batteryOn, switchClosed, running]);

  // Canvas drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Draw grid
      ctx.strokeStyle = "#e0e0e0";
      ctx.lineWidth = 0.5;
      for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }

      // Draw connections (simplified)
      ctx.strokeStyle = "#666";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(100, 150); ctx.lineTo(200, 150); ctx.lineTo(200, 250); // battery to switch
      ctx.moveTo(200, 250); ctx.lineTo(300, 250); ctx.lineTo(300, 150); // switch to bulb
      ctx.stroke();

      // Draw components
      components.forEach(c => {
        ctx.fillStyle = c.type === "battery" ? (batteryOn ? "#00796B" : "#999") :
                        c.type === "bulb" ? (bulbGlows ? "#FFD700" : "#ccc") :
                        c.type === "switch" ? (switchClosed ? "#00796B" : "#999") : "#666";
        ctx.beginPath();
        if (c.type === "battery") {
          ctx.rect(c.x-20, c.y-15, 40, 30);
        } else if (c.type === "bulb") {
          ctx.arc(c.x, c.y, 15, 0, Math.PI*2);
        } else if (c.type === "switch") {
          ctx.rect(c.x-15, c.y-10, 30, 20);
        }
        ctx.fill();
        ctx.strokeStyle = "#333";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.font = "10px sans-serif";
        ctx.fillText(c.type, c.x-15, c.y+4);
      });
      requestRef.current = requestAnimationFrame(draw);
    };
    requestRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(requestRef.current!);
  }, [components, batteryOn, switchClosed, bulbGlows]);

  return (
    <Card className="card-hover">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">ForgeField™ — Circuit Lab</CardTitle>
        <div className="flex gap-3 mt-2">
          <Button size="sm" onClick={() => setRunning(!running)}>
            {running ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
            {running ? "Pause" : "Run"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSwitchClosed(!switchClosed)}>
            Toggle Switch ({switchClosed ? "Closed" : "Open"})
          </Button>
          <Button size="sm" variant="outline" onClick={() => setBatteryOn(!batteryOn)}>
            Battery {batteryOn ? "ON" : "OFF"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => {
            // reset all
            setComponents(initialComponents);
            setSwitchClosed(false);
            setBatteryOn(true);
            setRunning(false);
          }}><RotateCcw className="h-4 w-4" /></Button>
        </div>
      </CardHeader>
      <CardContent>
        <canvas ref={canvasRef} width={600} height={400} className="w-full border rounded-lg bg-white" />
        <p className="text-xs text-muted-foreground mt-2">Tip: Flip the switch and run to light the bulb.</p>
      </CardContent>
    </Card>
  );
}
