import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Camera, Upload, ScanLine, CheckCircle2, XCircle, RotateCcw, Lightbulb, Brain } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";


type Status = "idle" | "uploading" | "done" | "error";

interface AnnotatedItem {
  question: number;
  detected: string;
  correct: string;
  score: number;
  maxScore: number;
  feedback: string;
}

interface ScanResult {
  submissionId?: number;
  grade?: number;
  feedback?: string;
  annotatedItems?: AnnotatedItem[];
  suggestions?: string[];
  ocrText?: string;
  aiAnalysis?: any;
}

export default function SnapGrade() {
  const [status, setStatus] = useState<Status>("idle");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please upload an image file", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setStatus("uploading");
    setProgress(0);

    // Animate progress while uploading
    const tick = setInterval(() => {
      setProgress(p => Math.min(p + 8, 88));
    }, 200);

    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await fetch("/api/snapgrade/scan", {
        method: "POST",
        headers: {},
        body: formData,
      });

      clearInterval(tick);
      setProgress(100);

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Scan failed" }));
        setErrorMsg(err.message ?? "Scan failed");
        setStatus("error");
        return;
      }

      const data = await res.json();
      setResult(data);
      setStatus("done");
      toast({ title: "Scan complete!", description: "Your work has been graded." });
    } catch {
      clearInterval(tick);
      setErrorMsg("Network error. Please try again.");
      setStatus("error");
    }
  };

  const reset = () => {
    setStatus("idle");
    setImagePreview(null);
    setProgress(0);
    setResult(null);
    setErrorMsg("");
  };

  const annotated = result?.annotatedItems ?? [];
  const totalScore = annotated.reduce((s, a) => s + a.score, 0);
  const totalMax = annotated.reduce((s, a) => s + a.maxScore, 0);
  const percentage = result?.grade ?? (totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0);

  return (
    <div className="min-h-screen bg-[#F5F5F5] dark:bg-background p-4 md:p-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Camera className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">SnapGrade</h1>
            <p className="text-muted-foreground text-sm">Take a photo of your handwritten work — instant OCR grading.</p>
          </div>
        </div>
      </motion.div>

      <div className="max-w-2xl mx-auto space-y-5">
        <AnimatePresence mode="wait">
          {status === "idle" && (
            <motion.div key="idle" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-4">
              <Card className="shadow-sm">
                <CardContent className="p-6">
                  <div
                    className="border-2 border-dashed border-border hover:border-primary/50 rounded-2xl p-10 text-center cursor-pointer transition-colors"
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                  >
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <Camera className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">Upload your answer sheet</h3>
                    <p className="text-muted-foreground text-sm mb-5">Drag & drop or click to select. JPG, PNG, HEIC supported.</p>
                    <div className="flex gap-3 justify-center flex-wrap">
                      <Button className="gap-2" onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}>
                        <Upload className="h-4 w-4" /> Choose File
                      </Button>
                      <Button variant="outline" className="gap-2" onClick={(e) => { e.stopPropagation(); fileRef.current?.setAttribute("capture", "environment"); fileRef.current?.click(); }}>
                        <Camera className="h-4 w-4" /> Take Photo
                      </Button>
                    </div>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardContent className="p-4 flex items-start gap-3">
                  <Lightbulb className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium mb-1">For best results</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Write clearly in dark pen on white paper</li>
                      <li>• Include question numbers before each answer</li>
                      <li>• Show all working clearly</li>
                      <li>• Ensure good lighting when photographing</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {status === "uploading" && (
            <motion.div key="uploading" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <Card className="shadow-sm">
                <CardContent className="p-8 text-center">
                  {imagePreview && (
                    <div className="w-40 h-28 mx-auto mb-5 rounded-xl overflow-hidden border">
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <ScanLine className="h-7 w-7 text-primary" />
                  </motion.div>
                  <h3 className="font-semibold text-lg mb-2">{progress < 50 ? "Uploading…" : "Scanning & Grading…"}</h3>
                  <p className="text-sm text-muted-foreground mb-5">AI is reading your handwriting and grading against the mark scheme.</p>
                  <Progress value={progress} className="h-2 max-w-xs mx-auto" />
                  <p className="text-xs text-muted-foreground mt-2">{progress}%</p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {status === "error" && (
            <motion.div key="error" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <Card className="shadow-sm border-destructive/30">
                <CardContent className="p-6 text-center">
                  <XCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
                  <h3 className="font-semibold mb-1">Scan Failed</h3>
                  <p className="text-sm text-muted-foreground mb-4">{errorMsg}</p>
                  <Button onClick={reset} className="gap-2"><RotateCcw className="h-4 w-4" /> Try Again</Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {status === "done" && result && (
            <motion.div key="done" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {/* Score summary */}
              <Card className="shadow-sm">
                <CardContent className="p-6 text-center">
                  <div className={`text-6xl font-extrabold mb-1 ${percentage >= 70 ? "text-primary" : percentage >= 50 ? "text-amber-600" : "text-destructive"}`}>
                    {percentage}%
                  </div>
                  {totalMax > 0 && <p className="text-muted-foreground text-sm mb-3">{totalScore} / {totalMax} marks</p>}
                  <Progress value={percentage} className="h-3 max-w-xs mx-auto mb-4" />
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    <Badge variant={percentage >= 70 ? "default" : "destructive"}>
                      {percentage >= 85 ? "Excellent" : percentage >= 70 ? "Good" : percentage >= 50 ? "Pass" : "Needs work"}
                    </Badge>
                    <Button variant="outline" size="sm" className="gap-1" onClick={reset}>
                      <RotateCcw className="h-3.5 w-3.5" /> Scan Another
                    </Button>
                    <Link href="/mentor">
                      <Button size="sm" className="gap-1">
                        <Brain className="h-3.5 w-3.5" /> Ask Mentor
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>

              {/* AI Feedback */}
              {result.feedback && (
                <Card className="shadow-sm border-primary/20 bg-primary/5">
                  <CardContent className="p-4 flex items-start gap-3">
                    <Lightbulb className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-primary mb-1">Overall Feedback</p>
                      <p className="text-sm">{result.feedback}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Suggestions */}
              {(result.suggestions?.length ?? 0) > 0 && (
                <Card className="shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Suggested Next Steps</CardTitle></CardHeader>
                  <CardContent className="space-y-1">
                    {result.suggestions!.map((s, i) => (
                      <p key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="text-primary font-bold shrink-0">{i + 1}.</span>{s}
                      </p>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Per-question breakdown */}
              {annotated.length > 0 && (
                <>
                  <h3 className="font-semibold text-sm mt-2">Question Breakdown</h3>
                  {annotated.map((answer) => (
                    <motion.div key={answer.question} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: answer.question * 0.06 }}>
                      <Card className="shadow-sm">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${answer.score === answer.maxScore ? "bg-primary/10" : answer.score > 0 ? "bg-amber-100 dark:bg-amber-900/20" : "bg-destructive/10"}`}>
                              {answer.score === answer.maxScore
                                ? <CheckCircle2 className="h-4 w-4 text-primary" />
                                : answer.score > 0
                                  ? <span className="text-[10px] font-bold text-amber-600">{answer.score}/{answer.maxScore}</span>
                                  : <XCircle className="h-4 w-4 text-destructive" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-sm font-medium">Q{answer.question}</p>
                                <Badge variant="outline" className="text-[10px]">{answer.score}/{answer.maxScore} marks</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mb-1">
                                <span className="font-medium text-foreground">Detected: </span>{answer.detected}
                              </p>
                              {answer.score < answer.maxScore && (
                                <p className="text-xs text-muted-foreground mb-1">
                                  <span className="font-medium text-foreground">Expected: </span>{answer.correct}
                                </p>
                              )}
                              <p className="text-xs text-primary mt-1 flex items-center gap-1">
                                <Lightbulb className="h-3 w-3 shrink-0" />{answer.feedback}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </>
              )}

              {/* OCR text */}
              {result.ocrText && (
                <Card className="shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Raw OCR Text</CardTitle></CardHeader>
                  <CardContent>
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted/50 p-3 rounded-lg">{result.ocrText}</pre>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
