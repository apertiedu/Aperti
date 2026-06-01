import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function ScanScribe() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append("image", file);
    const res = await fetch("/api/ocr/scan", { method: "POST", body: formData });
    const data = await res.json();
    setText(data.text || "No text extracted");
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold">ScanScribe<span className="text-primary">™</span></h1>
      </motion.div>
      <Card className="card-hover max-w-lg mx-auto">
        <CardHeader><CardTitle>Upload Handwriting</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} />
          <Button onClick={handleUpload} disabled={!file || loading}>
            {loading ? "Scanning..." : "Scan"}
          </Button>
          {text && <Textarea rows={6} value={text} readOnly />}
        </CardContent>
      </Card>
    </div>
  );
}
