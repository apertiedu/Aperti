import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/auth";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Download, QrCode, Share2, Printer, CalendarCheck, BookOpen, Shield } from "lucide-react";
import QRCode from "qrcode";

type StudentSummary = {
  student: {
    studentCode: string;
    studentName: string;
  };
};

async function generateQRDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    width: 700,
    margin: 2,
    color: { dark: "#0D9488", light: "#ffffff" },
    errorCorrectionLevel: "H",
  });
}

const ID_CARD_HTML = (name: string, code: string, qrDataUrl: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Student ID — ${name}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
    @page { size: 85.6mm 53.98mm; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: #f0fdfa;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 32px;
      padding: 32px;
    }
    .card {
      width: 340px;
      background: white;
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 24px 64px rgba(13, 148, 136, 0.18), 0 4px 16px rgba(0,0,0,0.08);
    }
    .card-header {
      background: linear-gradient(135deg, #0D9488 0%, #0f766e 55%, #134e4a 100%);
      padding: 22px 24px 20px;
      position: relative;
      overflow: hidden;
    }
    .card-header::before {
      content: '';
      position: absolute;
      top: -30px; right: -20px;
      width: 100px; height: 100px;
      border-radius: 50%;
      background: rgba(255,255,255,0.07);
    }
    .card-header::after {
      content: '';
      position: absolute;
      bottom: -40px; left: -15px;
      width: 80px; height: 80px;
      border-radius: 50%;
      background: rgba(255,255,255,0.05);
    }
    .header-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 16px;
      position: relative;
    }
    .logo { font-size: 20px; font-weight: 900; color: white; letter-spacing: -0.5px; line-height: 1; }
    .logo-sub { font-size: 8px; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 1.5px; margin-top: 3px; }
    .badge {
      background: rgba(255,255,255,0.15);
      border: 1px solid rgba(255,255,255,0.3);
      border-radius: 20px;
      padding: 3px 10px;
      font-size: 8px;
      font-weight: 700;
      color: rgba(255,255,255,0.9);
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .avatar {
      width: 44px; height: 44px;
      border-radius: 50%;
      background: rgba(255,255,255,0.2);
      border: 2px solid rgba(255,255,255,0.45);
      display: flex; align-items: center; justify-content: center;
      color: white; font-weight: 800; font-size: 16px;
      position: relative;
    }
    .student-name { font-size: 17px; font-weight: 800; color: white; line-height: 1.2; }
    .student-code { font-family: 'Courier New', monospace; font-size: 11px; color: rgba(255,255,255,0.65); margin-top: 2px; letter-spacing: 1px; font-weight: 700; }
    .card-body {
      display: flex;
      padding: 20px 22px;
      gap: 16px;
      align-items: center;
    }
    .qr-wrap {
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }
    .qr-border {
      padding: 8px;
      border-radius: 12px;
      border: 2px solid #e2e8f0;
      background: white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    }
    .qr-border img { width: 110px; height: 110px; display: block; border-radius: 6px; }
    .qr-label { font-size: 7px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 700; }
    .info-block { flex: 1; }
    .info-row { margin-bottom: 10px; }
    .info-label { font-size: 7px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 700; margin-bottom: 2px; }
    .info-value { font-size: 13px; font-weight: 800; color: #0f172a; }
    .info-value-code { font-family: monospace; font-size: 12px; color: #0D9488; font-weight: 700; }
    .id-number { font-size: 8px; color: #cbd5e1; margin-top: 12px; letter-spacing: 0.5px; text-transform: uppercase; }
    .card-rainbow { height: 4px; background: linear-gradient(90deg, #0D9488 0%, #06b6d4 33%, #8b5cf6 66%, #ec4899 100%); }
    .card-footer {
      background: #f8fafc;
      border-top: 1px solid #f1f5f9;
      padding: 8px 22px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .footer-left { font-size: 8px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .footer-right { font-size: 8px; color: #0D9488; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    .print-hint { font-size: 11px; color: #64748b; text-align: center; max-width: 340px; }
    @media print {
      body { background: white; padding: 0; }
      .print-hint { display: none; }
      .card { box-shadow: none; border: 1px solid #e2e8f0; }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="card-header">
      <div class="header-top">
        <div>
          <div class="logo">Aperti.</div>
          <div class="logo-sub">Educational OS</div>
        </div>
        <div class="badge">Student ID</div>
      </div>
      <div style="display:flex;align-items:center;gap:12px;">
        <div class="avatar">${name.split(" ").map((n: string) => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()}</div>
        <div>
          <div class="student-name">${name}</div>
          <div class="student-code">${code}</div>
        </div>
      </div>
    </div>
    <div class="card-rainbow"></div>
    <div class="card-body">
      <div class="qr-wrap">
        <div class="qr-border">
          <img src="${qrDataUrl}" alt="QR Code" />
        </div>
        <div class="qr-label">Scan to attend</div>
      </div>
      <div class="info-block">
        <div class="info-row">
          <div class="info-label">Student Code</div>
          <div class="info-value-code">${code}</div>
        </div>
        <div class="info-row">
          <div class="info-label">Full Name</div>
          <div class="info-value">${name}</div>
        </div>
        <div class="id-number">Academic Year ${new Date().getFullYear()}–${new Date().getFullYear() + 1}</div>
      </div>
    </div>
    <div class="card-footer">
      <div class="footer-left">Aperti Educational OS</div>
      <div class="footer-right">Attendance QR Card</div>
    </div>
  </div>
  <div class="print-hint">Present this card whenever your teacher takes attendance &nbsp;·&nbsp; Keep it safe</div>
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 500);
    };
  </script>
</body>
</html>`;

export default function MyQRPage() {
  const { user } = useAuth();
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [generating, setGenerating] = useState(false);

  const { data: summary, isLoading } = useQuery<StudentSummary>({
    queryKey: ["student", "home-summary"],
    queryFn: () => apiFetch("/api/student/home-summary").then(r => r.json()),
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

  const handlePrintIDCard = () => {
    if (!qrDataUrl) return;
    const w = window.open("", "_blank", "width=800,height=600");
    if (!w) return;
    w.document.write(ID_CARD_HTML(studentName, studentCode, qrDataUrl));
    w.document.close();
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Attendance QR</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your personal QR code — show it to your teacher to check in instantly</p>
      </div>

      <Card className="shadow-sm overflow-hidden">
        <div className="h-1.5" style={{ background: "linear-gradient(90deg, #0D9488, #06b6d4, #8b5cf6, #ec4899)" }} />
        <CardContent className="p-8">
          {isLoading || generating ? (
            <div className="flex flex-col items-center gap-5">
              <Skeleton className="w-64 h-64 rounded-2xl" />
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-32" />
            </div>
          ) : qrDataUrl ? (
            <div className="flex flex-col items-center gap-5">
              <div className="relative">
                <div className="absolute inset-0 rounded-3xl blur-2xl opacity-20" style={{ background: "radial-gradient(circle, #0D9488, transparent)" }} />
                <div className="relative p-4 rounded-3xl border-2 bg-card shadow-lg" style={{ borderColor: "#0D9488" }}>
                  <img src={qrDataUrl} alt="Attendance QR Code" className="w-56 h-56 rounded-xl" />
                </div>
              </div>
              <div className="text-center space-y-1">
                <p className="font-bold text-lg text-foreground">{studentName}</p>
                <p className="font-mono text-sm font-semibold" style={{ color: "#0D9488" }}>ID: {studentCode}</p>
                <p className="text-xs text-muted-foreground">Academic Year {new Date().getFullYear()}–{new Date().getFullYear() + 1}</p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center mt-1">
                <Button onClick={handleDownload} variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />Download QR
                </Button>
                <Button onClick={handleShare} variant="outline" size="sm" className="gap-2">
                  <Share2 className="h-4 w-4" />Share
                </Button>
                <Button
                  onClick={handlePrintIDCard}
                  size="sm"
                  className="gap-2 text-white"
                  style={{ background: "linear-gradient(135deg, #0D9488, #0f766e)" }}
                >
                  <Printer className="h-4 w-4" />Print ID Card
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center max-w-sm leading-relaxed">
                This QR code is permanently linked to your student ID. Your teacher scans it to mark you as present.
              </p>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <QrCode className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">QR code not available</p>
              <p className="text-xs mt-1">Your account may not have a student profile linked yet.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            icon: <QrCode className="h-5 w-5" style={{ color: "#0D9488" }} />,
            color: "#0D9488",
            title: "Your Unique Code",
            desc: "Every student has a unique QR linked to their ID that cannot be duplicated.",
          },
          {
            icon: <CalendarCheck className="h-5 w-5 text-emerald-500" />,
            color: "#10b981",
            title: "Instant Scan",
            desc: "Your teacher scans your QR during class to mark you present in under a second.",
          },
          {
            icon: <Shield className="h-5 w-5 text-blue-500" />,
            color: "#3b82f6",
            title: "Secure Record",
            desc: "Attendance logs in real time with a tamper-proof audit trail.",
          },
          {
            icon: <BookOpen className="h-5 w-5 text-violet-500" />,
            color: "#8b5cf6",
            title: "Track Progress",
            desc: "View your full attendance history anytime in My Attendance.",
          },
          {
            icon: <Printer className="h-5 w-5 text-rose-500" />,
            color: "#f43f5e",
            title: "Print & Keep",
            desc: "Print your ID card and keep it in your student planner for quick access.",
          },
          {
            icon: <Share2 className="h-5 w-5 text-amber-500" />,
            color: "#f59e0b",
            title: "Share It",
            desc: "Share your QR via WhatsApp or email if you need a backup copy.",
          },
        ].map(({ icon, color, title, desc }) => (
          <Card key={title} className="shadow-sm border-border/50">
            <CardContent className="p-4 flex gap-3 items-start">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}15` }}>
                {icon}
              </div>
              <div>
                <p className="font-semibold text-sm">{title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
