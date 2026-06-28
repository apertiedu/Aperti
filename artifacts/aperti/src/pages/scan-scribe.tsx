import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ScanScribe() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setText("");
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/ocr/scan", { method: "POST", credentials: "include", body: formData });
      if (res.status === 404) {
        toast({
          title: "OCR not configured",
          description: "The OCR service is not enabled on this server. Contact your administrator.",
          variant: "destructive",
        });
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: "Scan failed", description: (err as any).error ?? "An error occurred.", variant: "destructive" });
        return;
      }
      const data = await res.json();
      setText((data as any).text || "No text could be extracted from this image.");
    } catch {
      toast({ title: "Network error", description: "Could not reach the server.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold">ScanScribe<span className="text-primary"></span></h1>
        <p className="text-muted-foreground mt-1">Upload a handwritten image to extract text using OCR.</p>
      </motion.div>
      <Card className="card-hover max-w-lg mx-auto">
        <CardHeader><CardTitle>Upload Handwriting</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>OCR requires server-side configuration. Contact your admin if this feature is unavailable.</span>
          </div>
          <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          <Button onClick={handleUpload} disabled={!file || loading}>
            {loading ? "Scanning..." : "Scan"}
          </Button>
          {text && <Textarea rows={6} value={text} readOnly className="font-mono text-sm" />}
        </CardContent>
      </Card>
    </div>
  );
}
