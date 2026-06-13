import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/auth";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Download, QrCode, Share2, RefreshCw, User, CalendarCheck, BookOpen } from "lucide-react";
import QRCode from "qrcode";

type StudentSummary = {
  student: {
    studentCode: string;
    studentName: string;
  };
};

async function generateQRDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    width: 600,
    margin: 3,
    color: { dark: "#0D9488", light: "#ffffff" },
    errorCorrectionLevel: "H",
  });
}

export default function MyQRPage() {
  const { user } = useAuth();
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { data: summary, isLoading } = useQuery<StudentSummary>({
    queryKey: ["student", "home-summary"],
    queryFn: () => apiFetch("/api/student/home-summary"),
    staleTime: 60_000,
  });

  const studentCode = summary?.student?.studentCode ?? "";
  const studentName = summary?.student?.studentName || user?.displayName || "Student";

  useEffect(() => {
    if (!studentCode) return;
    setGenerating(true);
    generateQRDataUrl(studentCode)
      .then(url => setQrDataUrl(url))
      .finally(() => setGenerating(false));
  }, [studentCode]);

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `${studentCode || "my-qr"}-attendance-qr.png`;
    a.click();
  };

  const handleShare = async () => {
    if (!qrDataUrl) return;
    try {
      const blob = await (await fetch(qrDataUrl)).blob();
      const file = new File([blob], `${studentCode}-qr.png`, { type: "image/png" });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "My Attendance QR Code", text: `Attendance QR for ${studentName}` });
      } else {
        handleDownload();
      }
    } catch {
      handleDownload();
    }
  };

  const handleIDCard = () => {
    const w = window.open("", "_blank");
    if (!w || !qrDataUrl) return;
    w.document.write(`
      <html>
        <head>
          <title>Student ID Card — ${studentName}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Inter', system-ui, sans-serif; background: #f0fdfa; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
            .card { width: 340px; background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.15); }
            .header { background: linear-gradient(135deg, #0D9488 0%, #0f766e 100%); padding: 24px; color: white; text-align: center; }
            .header h2 { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
            .header p { font-size: 11px; opacity: 0.8; margin-top: 2px; text-transform: uppercase; letter-spacing: 2px; }
            .body { padding: 24px; display: flex; flex-direction: column; align-items: center; gap: 16px; }
            .qr { width: 180px; height: 180px; border: 3px solid #0D9488; border-radius: 12px; padding: 8px; }
            .info { text-align: center; width: 100%; }
            .name { font-size: 20px; font-weight: 700; color: #0f172a; }
            .code { font-size: 14px; color: #0D9488; font-weight: 600; font-family: monospace; margin-top: 4px; }
            .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 12px; text-align: center; }
            .footer p { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; }
            @media print { body { background: white; } .card { box-shadow: none; } }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <h2>Aperti.</h2>
              <p>Student Identification Card</p>
            </div>
            <div class="body">
              <img src="${qrDataUrl}" class="qr" alt="QR Code" />
              <div class="info">
                <p class="name">${studentName}</p>
                <p class="code">ID: ${studentCode}</p>
              </div>
            </div>
            <div class="footer"><p>Scan QR code to record attendance</p></div>
          </div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `);
    w.document.close();
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My QR Code</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your personal attendance QR code — show this to your teacher to check in</p>
      </div>

      {/* Main QR card */}
      <Card className="shadow-sm">
        <CardContent className="p-8">
          {isLoading || generating ? (
            <div className="flex flex-col items-center gap-4">
              <Skeleton className="w-64 h-64 rounded-2xl" />
              <Skeleton className="h-5 w-40" />
            </div>
          ) : qrDataUrl ? (
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 rounded-2xl border-2 border-primary/20 bg-white shadow-inner">
                <img src={qrDataUrl} alt="Attendance QR Code" className="w-56 h-56 rounded-xl" />
              </div>
              <div className="text-center">
                <p className="font-bold text-lg text-foreground">{studentName}</p>
                <p className="font-mono text-sm text-primary mt-0.5">ID: {studentCode}</p>
              </div>
              <div className="flex gap-2 flex-wrap justify-center mt-2">
                <Button onClick={handleDownload} variant="outline" className="gap-2"><Download className="h-4 w-4" />Download PNG</Button>
                <Button onClick={handleShare} variant="outline" className="gap-2"><Share2 className="h-4 w-4" />Share</Button>
                <Button onClick={handleIDCard} className="gap-2"><User className="h-4 w-4" />Print ID Card</Button>
              </div>
              <p className="text-xs text-muted-foreground text-center max-w-sm">
                This QR code is linked to your student ID. Present it when a teacher asks to scan attendance.
              </p>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <QrCode className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Could not generate QR code. Please check your account setup.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* How it works */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2"><CardTitle className="text-base">How It Works</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: <QrCode className="h-5 w-5 text-primary" />, title: "Your Code", desc: "Each student has a unique QR code linked to their student ID number." },
              { icon: <CalendarCheck className="h-5 w-5 text-emerald-500" />, title: "Scan for Attendance", desc: "Your teacher scans your code during class to mark you as present instantly." },
              { icon: <BookOpen className="h-5 w-5 text-blue-500" />, title: "View Your Record", desc: "Your attendance records update in real time — check them in My Attendance." },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="flex flex-col items-center text-center gap-2 p-4 rounded-xl bg-muted/40">
                <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center">{icon}</div>
                <p className="font-semibold text-sm">{title}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
