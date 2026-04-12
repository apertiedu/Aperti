import { useEffect, useRef, useState, useCallback } from "react";
import jsQR from "jsqr";
import { Camera, CameraOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QRScannerProps {
  onDetected: (code: string) => void;
  cooldownMs?: number;
  active?: boolean;
}

export default function QRScanner({ onDetected, cooldownMs = 2500, active = true }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const lastCodeRef = useRef<string>("");
  const lastTimeRef = useRef<number>(0);

  const [status, setStatus] = useState<"idle" | "requesting" | "active" | "denied" | "error">("idle");

  const scan = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(scan);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) { rafRef.current = requestAnimationFrame(scan); return; }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });

    if (code && code.data) {
      const now = Date.now();
      const isNewCode = code.data !== lastCodeRef.current || now - lastTimeRef.current > cooldownMs;
      if (isNewCode) {
        lastCodeRef.current = code.data;
        lastTimeRef.current = now;
        onDetected(code.data.trim().toUpperCase());
      }
    }

    rafRef.current = requestAnimationFrame(scan);
  }, [onDetected, cooldownMs]);

  const startCamera = useCallback(async () => {
    setStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setStatus("active");
      rafRef.current = requestAnimationFrame(scan);
    } catch (err: any) {
      if (err.name === "NotAllowedError") setStatus("denied");
      else setStatus("error");
    }
  }, [scan]);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("idle");
  }, []);

  useEffect(() => {
    if (active) startCamera();
    return () => stopCamera();
  }, [active]);

  return (
    <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden flex items-center justify-center">
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        playsInline
        muted
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Scanning overlay */}
      {status === "active" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative w-56 h-56">
            {/* Corner brackets */}
            <span className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-md" />
            <span className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-md" />
            <span className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-md" />
            <span className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-md" />
            {/* Scanning line animation */}
            <div className="absolute inset-x-0 h-0.5 bg-primary/90 animate-scan" style={{ top: "50%" }} />
          </div>
        </div>
      )}

      {/* Status overlays */}
      {status === "idle" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 text-white">
          <Camera className="h-12 w-12 opacity-60" />
          <Button onClick={startCamera} variant="secondary" className="gap-2">
            <Camera className="h-4 w-4" />
            Start Camera
          </Button>
        </div>
      )}
      {status === "requesting" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 text-white">
          <Loader2 className="h-8 w-8 animate-spin opacity-70" />
          <p className="text-sm opacity-70">Requesting camera access...</p>
        </div>
      )}
      {status === "denied" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 text-white p-6 text-center">
          <CameraOff className="h-12 w-12 text-red-400" />
          <div>
            <p className="font-semibold">Camera access denied</p>
            <p className="text-sm opacity-70 mt-1">Allow camera access in your browser settings, then try again.</p>
          </div>
          <Button onClick={startCamera} variant="secondary" size="sm">Retry</Button>
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 text-white">
          <CameraOff className="h-10 w-10 text-red-400" />
          <p className="text-sm opacity-70">Camera unavailable</p>
          <Button onClick={startCamera} variant="secondary" size="sm">Retry</Button>
        </div>
      )}

      {status === "active" && (
        <button
          onClick={stopCamera}
          className="absolute top-3 right-3 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
          title="Stop camera"
        >
          <CameraOff className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
