import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, Trash2, FileText, CloudUpload, CheckCircle2,
  AlertCircle, Loader2, Library,
} from "lucide-react";

const API = "/api";
const token = () => localStorage.getItem("aperti_token");

export default function PaperVaultAdmin() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [board, setBoard] = useState("CAIE");
  const [subject, setSubject] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [session, setSession] = useState("May/June");
  const [component, setComponent] = useState("");
  const [paperNumber, setPaperNumber] = useState("");
  const [variant, setVariant] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const { data: papers = [], isLoading } = useQuery({
    queryKey: ["admin", "past-papers"],
    queryFn: async () => {
      const res = await fetch(`${API}/past-papers`, { headers: { Authorization: `Bearer ${token()}` } });
      return res.json();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: { board: string; subject: string; year: string; session?: string; component?: string; paperNumber?: string; variant: string; fileUrl?: string; file?: File }) => {
      setUploadProgress(0);
      if (data.file) {
        const form = new FormData();
        form.append("file", data.file);
        form.append("board", data.board);
        form.append("subject", data.subject);
        form.append("year", data.year);
        if (data.session) form.append("session", data.session);
        if (data.component) form.append("component", data.component);
        if (data.paperNumber) form.append("paperNumber", data.paperNumber);
        form.append("variant", data.variant);
        return new Promise<any>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", `${API}/past-papers/upload`);
          xhr.setRequestHeader("Authorization", `Bearer ${token()}`);
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
          };
          xhr.onload = () => {
            setUploadProgress(null);
            if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
            else reject(new Error("Upload failed"));
          };
          xhr.onerror = () => { setUploadProgress(null); reject(new Error("Network error")); };
          xhr.send(form);
        });
      } else {
        setUploadProgress(50);
        const res = await fetch(`${API}/past-papers`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
          body: JSON.stringify({ board: data.board, subject: data.subject, year: Number(data.year), session: data.session, component: data.component, paperNumber: data.paperNumber, variant: data.variant, fileUrl: data.fileUrl }),
        });
        setUploadProgress(100);
        setTimeout(() => setUploadProgress(null), 800);
        if (!res.ok) throw new Error("Upload failed");
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "past-papers"] });
      setSubject(""); setSession("May/June"); setComponent(""); setPaperNumber(""); setVariant(""); setFileUrl(""); setFile(null);
      toast({ title: "Paper uploaded successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`${API}/past-papers/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token()}` } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "past-papers"] });
      toast({ title: "Paper deleted" });
    },
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) {
      if (dropped.type !== "application/pdf") {
        toast({ title: "PDF files only", variant: "destructive" });
        return;
      }
      setFile(dropped);
      setFileUrl("");
    }
  }, [toast]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type !== "application/pdf") {
      toast({ title: "PDF files only", variant: "destructive" });
      return;
    }
    setFile(f);
    setFileUrl("");
  };

  const handleUpload = () => {
    if (!subject.trim()) {
      toast({ title: "Enter a subject", variant: "destructive" });
      return;
    }
    if (!file && !fileUrl.trim()) {
      toast({ title: "Provide a PDF file or URL", variant: "destructive" });
      return;
    }
    uploadMutation.mutate({ board, subject, year, session, component, paperNumber, variant, fileUrl: fileUrl || undefined, file: file || undefined });
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#0D9488]/10 flex items-center justify-center">
            <Library className="h-5 w-5 text-[#0D9488]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">PaperVault Admin</h1>
            <p className="text-sm text-gray-500">Upload and manage past papers for students</p>
          </div>
        </div>
      </motion.div>

      {/* Upload form */}
      <Card className="shadow-sm border-0 mb-8 max-w-2xl">
        <CardHeader className="border-b pb-3">
          <CardTitle className="text-base font-semibold">Upload New Paper</CardTitle>
        </CardHeader>
        <CardContent className="pt-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Exam Board</Label>
              <Select value={board} onValueChange={setBoard}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["CAIE", "Edexcel", "OxfordAQA", "IB", "AQA", "OCR"].map(b => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Year</Label>
              <Input
                type="number"
                value={year}
                onChange={e => setYear(e.target.value)}
                min={2000}
                max={new Date().getFullYear()}
                className="h-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600">Subject</Label>
            <Input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="e.g. Physics 0625"
              className="h-9"
            />
          </div>

          {/* Session + Paper Number */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Session</Label>
              <Select value={session} onValueChange={setSession}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["May/June", "Oct/Nov", "Feb/Mar", "Jan", "Other"].map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Paper Number</Label>
              <Input
                value={paperNumber}
                onChange={e => setPaperNumber(e.target.value)}
                placeholder="e.g. 1, 2, 3"
                className="h-9"
              />
            </div>
          </div>

          {/* Component + Variant */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Component</Label>
              <Input
                value={component}
                onChange={e => setComponent(e.target.value)}
                placeholder="e.g. Multiple Choice, Written"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Variant</Label>
              <Input
                value={variant}
                onChange={e => setVariant(e.target.value)}
                placeholder="e.g. 1, 2, 3"
                className="h-9"
              />
            </div>
          </div>

          {/* Drag-drop zone */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600">PDF File</Label>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById("pdf-input")?.click()}
              className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                dragOver
                  ? "border-[#0D9488] bg-[#0D9488]/5"
                  : file
                  ? "border-[#0D9488]/40 bg-[#0D9488]/5"
                  : "border-gray-200 hover:border-gray-300 bg-gray-50"
              }`}
            >
              <input
                id="pdf-input"
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileInput}
                className="hidden"
              />
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-[#0D9488]" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB · PDF</p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); setFile(null); }}
                    className="ml-auto text-gray-400 hover:text-red-500"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <>
                  <CloudUpload className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Drag & drop a PDF here, or click to browse</p>
                  <p className="text-xs text-gray-400 mt-1">PDF files only · Max 50MB</p>
                </>
              )}
            </div>
          </div>

          {/* OR URL */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">or enter URL</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <Input
            value={fileUrl}
            onChange={e => { setFileUrl(e.target.value); if (e.target.value) setFile(null); }}
            placeholder="https://papers.example.com/paper.pdf"
            className="h-9"
          />

          {/* Progress bar */}
          <AnimatePresence>
            {uploadProgress !== null && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-1"
              >
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Uploading…</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-[#0D9488] rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                    transition={{ ease: "linear" }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <Button
            onClick={handleUpload}
            disabled={uploadMutation.isPending}
            className="w-full bg-[#0D9488] hover:bg-[#0B7B70] text-white h-9"
          >
            {uploadMutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading…</>
            ) : (
              <><Upload className="h-4 w-4 mr-2" /> Upload Paper</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Papers list */}
      <Card className="shadow-sm border-0 max-w-2xl">
        <CardHeader className="border-b pb-3">
          <CardTitle className="text-base font-semibold">
            All Papers
            {papers.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">{papers.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
            </div>
          ) : papers.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="h-10 w-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No papers uploaded yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Board</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead>Paper</TableHead>
                  <TableHead>Variant</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {papers.map((paper: any) => (
                  <TableRow key={paper.id}>
                    <TableCell><Badge variant="secondary" className="text-xs">{paper.board}</Badge></TableCell>
                    <TableCell className="font-medium text-sm">{paper.subject}</TableCell>
                    <TableCell className="text-sm text-gray-500">{paper.year}</TableCell>
                    <TableCell className="text-sm text-gray-500">{paper.session || "—"}</TableCell>
                    <TableCell className="text-sm text-gray-500">{paper.paper_number || "—"}</TableCell>
                    <TableCell className="text-sm text-gray-500">{paper.variant || "—"}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost" size="icon"
                        onClick={() => deleteMutation.mutate(paper.id)}
                        disabled={deleteMutation.isPending}
                        className="h-7 w-7"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
