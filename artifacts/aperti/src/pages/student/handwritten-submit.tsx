import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Upload, Camera, Loader2, CheckCircle, FileText,
  Zap, Eye, Sigma, GitBranch, ListOrdered, AlertCircle,
} from "lucide-react";

const API = "/api";
const token = () => localStorage.getItem("aperti_token");
async function fetchJSON(url: string, opts?: RequestInit) {
  const res = await fetch(`${API}${url}`, {
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json", ...(opts?.headers ?? {}) },
    ...opts,
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

type Step = "upload" | "processing" | "review" | "done";

export default function HandwrittenSubmit() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<Step>("upload");
  const [imageUrl, setImageUrl] = useState("");
  const [result, setResult] = useState<any>(null);
  const [previewError, setPreviewError] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImageUrl(dataUrl);
      setPreviewError(false);
    };
    reader.readAsDataURL(file);
  };

  const processHandwriting = useMutation({
    mutationFn: (data: any) => fetchJSON("/submissions/handwritten", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (data) => { setResult(data); setStep("review"); },
    onError: () => setStep("upload"),
  });

  const handleProcess = () => {
    if (!imageUrl.trim()) return;
    setStep("processing");
    processHandwriting.mutate({ imageUrl });
  };

  const confidence = parseFloat(result?.confidence_score || "0");
  const confColor = confidence >= 0.9 ? "text-green-600" : confidence >= 0.7 ? "text-amber-600" : "text-red-600";
  const confBg = confidence >= 0.9 ? "bg-green-50 border-green-200" : confidence >= 0.7 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";

  const equations: any[] = result?.equation_data || [];
  const diagrams: any[] = result?.diagram_data || [];
  const steps: any[] = result?.step_analysis || [];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1 as any)}><ArrowLeft size={16} /></Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="text-teal-600" size={22} /> Handwritten Submission
            </h1>
            <p className="text-gray-500 text-sm">Submit handwritten work — AI extracts text, equations and diagrams</p>
          </div>
        </motion.div>

        {/* Step indicators */}
        <div className="flex items-center gap-2">
          {(["upload","processing","review","done"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                s === step ? "bg-teal-600 text-white scale-110" :
                (["upload","processing","review","done"].indexOf(step) > i) ? "bg-green-500 text-white" :
                "bg-gray-200 text-gray-500"}`}>
                {(["upload","processing","review","done"].indexOf(step) > i) ? <CheckCircle size={12} /> : i + 1}
              </div>
              <span className={`text-xs font-medium capitalize ${s === step ? "text-teal-700" : "text-gray-400"}`}>{s}</span>
              {i < 3 && <div className="w-6 h-px bg-gray-200 mx-1" />}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {step === "upload" && (
            <motion.div key="upload" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <Card className="bg-white border-0 shadow-sm">
                <CardHeader><CardTitle className="text-base">Upload Your Work</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  {/* Hidden file inputs */}
                  <input ref={cameraRef} type="file" accept="image/*" capture="environment"
                    className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
                  <input ref={galleryRef} type="file" accept="image/*"
                    className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />

                  {/* Mobile-first capture buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => cameraRef.current?.click()}
                      className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-teal-200 bg-teal-50 hover:bg-teal-100 transition-colors min-h-[80px]">
                      <Camera size={22} className="text-teal-600" />
                      <span className="text-xs font-semibold text-teal-700">Take Photo</span>
                    </button>
                    <button onClick={() => galleryRef.current?.click()}
                      className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors min-h-[80px]">
                      <Upload size={22} className="text-gray-500" />
                      <span className="text-xs font-semibold text-gray-600">Choose File</span>
                    </button>
                  </div>

                  {/* URL input fallback */}
                  <div>
                    <label className="text-xs font-semibold text-gray-400 mb-2 block">Or paste an image URL</label>
                    <div className="flex gap-3">
                      <Input value={imageUrl.startsWith("data:") ? "" : imageUrl}
                        onChange={e => { setImageUrl(e.target.value); setPreviewError(false); }}
                        placeholder="https://..." className="flex-1 text-sm" />
                    </div>
                  </div>

                  {/* Process button */}
                  {imageUrl && (
                    <Button onClick={handleProcess} className="w-full bg-teal-600 hover:bg-teal-700 text-white h-11">
                      <Zap size={14} className="mr-2" /> Analyse with AI
                    </Button>
                  )}

                  {/* Image preview */}
                  {imageUrl && !previewError && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-2 border-dashed border-gray-200 rounded-xl overflow-hidden">
                      <img src={imageUrl} alt="Preview" className="max-h-64 w-full object-contain"
                        onError={() => setPreviewError(true)} />
                    </motion.div>
                  )}
                  {previewError && (
                    <div className="flex items-center gap-2 text-amber-600 text-sm p-3 bg-amber-50 rounded-lg border border-amber-200">
                      <AlertCircle size={14} /> Could not preview this URL. You can still submit it for processing.
                    </div>
                  )}

                  {/* Feature callouts */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { icon: FileText, label: "Text OCR", desc: "Handwritten text extracted accurately" },
                      { icon: Sigma, label: "Equation Detection", desc: "LaTeX equations parsed automatically" },
                      { icon: GitBranch, label: "Diagram Analysis", desc: "Scientific diagrams described" },
                      { icon: ListOrdered, label: "Step Recognition", desc: "Working steps identified and scored" },
                    ].map(({ icon: Icon, label, desc }) => (
                      <div key={label} className="flex gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <Icon size={16} className="text-teal-600 shrink-0 mt-0.5" />
                        <div><p className="text-xs font-semibold text-gray-700">{label}</p><p className="text-xs text-gray-500">{desc}</p></div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === "processing" && (
            <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Card className="bg-white border-0 shadow-sm">
                <CardContent className="py-16 text-center space-y-6">
                  <div className="relative w-24 h-24 mx-auto">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                      className="w-24 h-24 border-4 border-teal-100 border-t-teal-600 rounded-full absolute" />
                    <div className="w-24 h-24 flex items-center justify-center">
                      <Zap size={28} className="text-teal-600" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">AI Processing</h3>
                    <p className="text-gray-500 text-sm mt-1">Extracting text, equations and diagrams from your work...</p>
                  </div>
                  <div className="flex flex-col gap-2 max-w-xs mx-auto">
                    {["Analysing handwriting...", "Detecting equations...", "Identifying diagrams...", "Scoring steps..."].map((msg, i) => (
                      <motion.div key={msg} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.4 }}
                        className="flex items-center gap-2 text-sm text-gray-600">
                        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ delay: i * 0.4, duration: 0.3 }}>
                          <CheckCircle size={14} className="text-teal-500" />
                        </motion.div>
                        {msg}
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {step === "review" && result && (
            <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              {/* Confidence badge */}
              <div className={`flex items-center gap-3 p-4 rounded-xl border ${confBg}`}>
                <Eye size={18} className={confColor} />
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${confColor}`}>
                    Confidence: {Math.round(confidence * 100)}%
                  </p>
                  <p className="text-xs text-gray-500">
                    {confidence >= 0.9 ? "Excellent clarity" : confidence >= 0.7 ? "Good readability" : "Some sections unclear — please review"}
                  </p>
                </div>
                <Badge className={`${confidence >= 0.9 ? "bg-green-100 text-green-700" : confidence >= 0.7 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                  {confidence >= 0.9 ? "High" : confidence >= 0.7 ? "Medium" : "Low"}
                </Badge>
              </div>

              {/* Extracted text */}
              {result.processed_text && (
                <Card className="bg-white border-0 shadow-sm">
                  <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><FileText size={14} className="text-teal-600" /> Extracted Text</CardTitle></CardHeader>
                  <CardContent>
                    <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 leading-relaxed font-mono whitespace-pre-wrap border border-gray-100">
                      {result.processed_text}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Equations */}
              {equations.length > 0 && (
                <Card className="bg-white border-0 shadow-sm">
                  <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Sigma size={14} className="text-blue-600" /> Equations Detected</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {equations.map((eq: any, i: number) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                          <Badge className="text-xs bg-blue-100 text-blue-700 shrink-0">{eq.type || "formula"}</Badge>
                          <code className="text-sm font-mono text-blue-800">{eq.latex || eq.text}</code>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Diagrams */}
              {diagrams.length > 0 && (
                <Card className="bg-white border-0 shadow-sm">
                  <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><GitBranch size={14} className="text-purple-600" /> Diagrams</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {diagrams.map((d: any, i: number) => (
                        <div key={i} className="p-3 bg-purple-50 rounded-lg border border-purple-100 text-sm text-purple-800">{d.description || JSON.stringify(d)}</div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Steps */}
              {steps.length > 0 && (
                <Card className="bg-white border-0 shadow-sm">
                  <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><ListOrdered size={14} className="text-green-600" /> Working Steps</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {steps.map((s: any, i: number) => (
                        <div key={i} className={`flex gap-3 p-3 rounded-lg border ${s.correct ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${s.correct ? "bg-green-600 text-white" : "bg-red-500 text-white"}`}>{s.number || i + 1}</span>
                          <p className="text-sm text-gray-700">{s.text}</p>
                          {s.correct !== undefined && (
                            s.correct ? <CheckCircle size={14} className="text-green-600 shrink-0 mt-0.5" /> : <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setStep("upload")}>Upload Another</Button>
                <Button className="flex-1 bg-teal-600 hover:bg-teal-700 text-white" onClick={() => setStep("done")}>
                  <CheckCircle size={14} className="mr-2" /> Submit Work
                </Button>
              </div>
            </motion.div>
          )}

          {step === "done" && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <Card className="bg-white border-0 shadow-sm">
                <CardContent className="py-14 text-center space-y-4">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle size={40} className="text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-800">Submitted Successfully</h2>
                  <p className="text-gray-500">Your handwritten work has been processed and submitted.</p>
                  {result && (
                    <div className="grid grid-cols-3 gap-4 py-4 max-w-xs mx-auto">
                      <div><p className="text-xl font-bold text-teal-600">{Math.round(parseFloat(result.confidence_score || "0") * 100)}%</p><p className="text-xs text-gray-500">Confidence</p></div>
                      <div><p className="text-xl font-bold text-blue-600">{equations.length}</p><p className="text-xs text-gray-500">Equations</p></div>
                      <div><p className="text-xl font-bold text-purple-600">{steps.length}</p><p className="text-xs text-gray-500">Steps</p></div>
                    </div>
                  )}
                  <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={() => navigate(-1 as any)}>
                    <ArrowLeft size={14} className="mr-2" /> Back to Assignments
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
