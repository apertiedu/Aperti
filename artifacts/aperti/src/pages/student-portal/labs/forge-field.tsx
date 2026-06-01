import { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw } from "lucide-react";

export default function ForgeField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [running, setRunning] = useState(false);
  const [switchClosed, setSwitchClosed] = useState(false);
  const [batteryOn, setBatteryOn] = useState(true);
  const [bulbGlows, setBulbGlows] = useState(false);
  const requestRef = useRef<number | null>(null);

  useEffect(() => {
    setBulbGlows(batteryOn && switchClosed && running);
  }, [batteryOn, switchClosed, running]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Subtle grid
      ctx.strokeStyle = "#e8e8e8";
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= W; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y <= H; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      // ── Circuit geometry ──────────────────────────────────────────────
      // Rectangular loop: TL(70,80) → TR(530,80) → BR(530,320) → BL(70,320)
      // Battery:  left wire,  center y=200  (pos terminal at y=155, neg at y=245)
      // Switch:   top wire,   center x=300  (gap from x=255 to x=345)
      // Bulb:     right wire, center y=200  (gap from y=155 to y=245)

      const TL = { x: 70, y: 80 };
      const TR = { x: 530, y: 80 };
      const BR = { x: 530, y: 320 };
      const BL = { x: 70, y: 320 };

      // Battery terminals
      const batPosY = 155;  // positive (top)
      const batNegY = 245;  // negative (bottom)
      // Switch gap (on top wire)
      const swL = 255;
      const swR = 345;
      // Bulb gap (on right wire)
      const bulbTopY = 155;
      const bulbBotY = 245;

      const wireColor = bulbGlows ? "#00796B" : "#555";
      const glowColor = "#FFD700";

      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";

      // ── Draw wires ────────────────────────────────────────────────────
      ctx.strokeStyle = wireColor;

      // Top wire: TL → swL (left of switch gap)
      ctx.beginPath(); ctx.moveTo(TL.x, TL.y); ctx.lineTo(swL, TL.y); ctx.stroke();
      // Top wire: swR → TR (right of switch gap)
      ctx.beginPath(); ctx.moveTo(swR, TL.y); ctx.lineTo(TR.x, TL.y); ctx.stroke();
      // Right wire: TR → bulbTopY
      ctx.beginPath(); ctx.moveTo(TR.x, TR.y); ctx.lineTo(TR.x, bulbTopY); ctx.stroke();
      // Right wire: bulbBotY → BR
      ctx.beginPath(); ctx.moveTo(TR.x, bulbBotY); ctx.lineTo(TR.x, BR.y); ctx.stroke();
      // Bottom wire: BR → BL
      ctx.beginPath(); ctx.moveTo(BR.x, BR.y); ctx.lineTo(BL.x, BL.y); ctx.stroke();
      // Left wire: BL → batNegY
      ctx.beginPath(); ctx.moveTo(BL.x, BL.y); ctx.lineTo(BL.x, batNegY); ctx.stroke();
      // Left wire: batPosY → TL
      ctx.beginPath(); ctx.moveTo(TL.x, batPosY); ctx.lineTo(TL.x, TL.y); ctx.stroke();

      // ── BATTERY (left side, vertical) ────────────────────────────────
      const batX = TL.x;
      const batCY = 200;
      // Body
      ctx.fillStyle = batteryOn ? "#00796B" : "#aaa";
      ctx.fillRect(batX - 18, batPosY, 36, batNegY - batPosY);
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(batX - 18, batPosY, 36, batNegY - batPosY);
      // Terminal lines (classic battery symbol)
      // Long line (positive)
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(batX - 12, batPosY + 12); ctx.lineTo(batX + 12, batPosY + 12); ctx.stroke();
      // Short line (negative)
      ctx.beginPath(); ctx.moveTo(batX - 7, batNegY - 12); ctx.lineTo(batX + 7, batNegY - 12); ctx.stroke();
      // Label
      ctx.fillStyle = "#fff";
      ctx.font = "bold 9px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("BAT", batX, batCY + 4);
      // +/- labels
      ctx.fillStyle = "#fff";
      ctx.font = "bold 10px sans-serif";
      ctx.fillText("+", batX + 22, batPosY + 16);
      ctx.fillText("−", batX + 22, batNegY - 6);

      // ── SWITCH (top wire, horizontal) ────────────────────────────────
      const swCX = (swL + swR) / 2;
      const swY = TL.y;
      // Pivot dot (left)
      ctx.fillStyle = "#333";
      ctx.beginPath(); ctx.arc(swL, swY, 4, 0, Math.PI * 2); ctx.fill();
      // Pivot dot (right)
      ctx.beginPath(); ctx.arc(swR, swY, 4, 0, Math.PI * 2); ctx.fill();
      // Lever
      ctx.strokeStyle = switchClosed ? "#00796B" : "#888";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(swL, swY);
      if (switchClosed) {
        ctx.lineTo(swR, swY); // closed = straight
      } else {
        ctx.lineTo(swR - 10, swY - 28); // open = angled up
      }
      ctx.stroke();
      // Label
      ctx.fillStyle = "#555";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(switchClosed ? "SW: closed" : "SW: open", swCX, swY - (switchClosed ? 14 : 38));

      // ── BULB (right wire, vertical) ───────────────────────────────────
      const bulbX = TR.x;
      const bulbCY = (bulbTopY + bulbBotY) / 2;
      const bulbR = 22;
      // Glow halo
      if (bulbGlows) {
        const grad = ctx.createRadialGradient(bulbX, bulbCY, 5, bulbX, bulbCY, 44);
        grad.addColorStop(0, "rgba(255,220,0,0.5)");
        grad.addColorStop(1, "rgba(255,220,0,0)");
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(bulbX, bulbCY, 44, 0, Math.PI * 2); ctx.fill();
      }
      // Bulb glass
      ctx.fillStyle = bulbGlows ? glowColor : "#ddd";
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(bulbX, bulbCY, bulbR, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      // Filament cross
      ctx.strokeStyle = bulbGlows ? "#a05000" : "#999";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bulbX - 8, bulbCY - 8); ctx.lineTo(bulbX + 8, bulbCY + 8);
      ctx.moveTo(bulbX + 8, bulbCY - 8); ctx.lineTo(bulbX - 8, bulbCY + 8);
      ctx.stroke();
      // Base cap
      ctx.fillStyle = "#888";
      ctx.fillRect(bulbX - 12, bulbCY + bulbR - 4, 24, 8);
      // Label
      ctx.fillStyle = "#555";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(bulbGlows ? "ON" : "OFF", bulbX + 34, bulbCY + 4);

      requestRef.current = requestAnimationFrame(draw);
    };

    requestRef.current = requestAnimationFrame(draw);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [batteryOn, switchClosed, bulbGlows]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="card-hover">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            ForgeField™ — Circuit Lab
          </CardTitle>
          <div className="flex flex-wrap gap-2 mt-2">
            <Button size="sm" onClick={() => setRunning(r => !r)}>
              {running ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
              {running ? "Pause" : "Run"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSwitchClosed(s => !s)}>
              Switch: {switchClosed ? "Closed ●" : "Open ○"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBatteryOn(b => !b)}>
              Battery: {batteryOn ? "ON" : "OFF"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => {
              setSwitchClosed(false);
              setBatteryOn(true);
              setRunning(false);
            }}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <canvas
            ref={canvasRef}
            width={600}
            height={400}
            className="w-full border rounded-lg bg-white"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Circuit: Battery → Switch → Bulb. Close the switch and press Run to light the bulb.
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
