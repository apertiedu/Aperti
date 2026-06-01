import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Camera, Upload, ScanLine, CheckCircle2, XCircle, RotateCcw, Lightbulb, FileImage } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Status = "idle" | "uploading" | "scanning" | "done";

interface Answer {
  question: number;
  detected: string;
  correct: string;
  score: number;
  maxScore: number;
  feedback: string;
}

const MOCK_RESULTS: Answer[] = [
  { question: 1, detected: "The acceleration is 9.8 m/s² downward", correct: "g = 9.81 m/s² (accepted range 9.7–9.9)", score: 2, maxScore: 2, feedback: "Correct! Good use of units." },
  { question: 2, detected: "F = ma = 5 × 3 = 15 N", correct: "F = 15 N", score: 2, maxScore: 2, feedback: "Perfect." },
  { question: 3, detected: "KE = 0.5mv = 0.5 × 2 × 4 = 4 J", correct: "KE = ½mv² = ½ × 2 × 4² = 16 J", score: 0, maxScore: 3, feedback: "Forgot to square the velocity. v² not v." },
  { question: 4, detected: "P = IV = 12 × 0.5 = 6 W", correct: "P = 6 W", score: 3, maxScore: 3, feedback: "Excellent working shown." },
  { question: 5, detected: "λ = v/f = 340/680 = 0.5 m", correct: "λ = 0.5 m", score: 2, maxScore: 2, feedback: "Correct." },
];

export default function SnapGrade() {
  const [status, setStatus] = useState<Status>("idle");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<Answer[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please upload an image file", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
    processImage();
  };

  const processImage = async () => {
    setStatus("uploading");
    setProgress(0);
    // Simulate upload
    for (let i = 0; i <= 40; i += 5) {
      await new Promise((r) => setTimeout(r, 60));
      setProgress(i);
    }
    setStatus("scanning");
    // Simulate OCR scan
    for (let i = 40; i <= 95; i += 3) {
      await new Promise((r) => setTimeout(r, 80));
      setProgress(i);
    }
    setProgress(100);
    await new Promise((r) => setTimeout(r, 300));
    setStatus("done");
    setResults(MOCK_RESULTS);
    toast({ title: "Scan complete!", description: "Your answers have been graded." });
  };

  const reset = () => {
    setStatus("idle");
    setImagePreview(null);
    setProgress(0);
    setResults(null);
  };

  const totalScore = results ? results.reduce((s, a) => s + a.score, 0) : 0;
  const totalMax = results ? results.reduce((s, a) => s + a.maxScore, 0) : 0;
  const percentage = results ? Math.round((totalScore / totalMax) * 100) : 0;

  return (
    <div className="min-h-screen bg-background p-6 page-transition">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Camera className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">SnapGrade<span className="text-primary">™</span></h1>
        </div>
        <p className="text-muted-foreground">Take a photo of your handwritten work — instant OCR grading.</p>
      </motion.div>

      <div className="max-w-3xl mx-auto space-y-6">
        <AnimatePresence mode="wait">
          {status === "idle" && (
            <motion.div key="idle" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
              <Card className="card-hover">
                <CardContent className="p-8">
                  <div
                    className="border-2 border-dashed border-border hover:border-primary/40 rounded-2xl p-12 text-center cursor-pointer transition-colors"
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files[0];
                      if (file) handleFile(file);
                    }}
                  >
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <Camera className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">Upload your answer sheet</h3>
                    <p className="text-muted-foreground text-sm mb-6">
                      Drag & drop or click to select an image.<br />
                      Supports JPG, PNG, HEIC.
                    </p>
                    <div className="flex gap-3 justify-center">
                      <Button className="gap-2" onClick={() => fileRef.current?.click()}>
                        <Upload className="h-4 w-4" /> Choose File
                      </Button>
                      <Button variant="outline" className="gap-2">
                        <Camera className="h-4 w-4" /> Take Photo
                      </Button>
                    </div>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="card-hover">
                <CardContent className="p-4 flex items-start gap-3">
                  <Lightbulb className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium mb-1">For best results</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>• Write clearly in dark pen on white paper</li>
                      <li>• Include question numbers before each answer</li>
                      <li>• Show all working/steps clearly</li>
                      <li>• Ensure good lighting when photographing</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {(status === "uploading" || status === "scanning") && (
            <motion.div key="processing" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
              <Card>
                <CardContent className="p-8 text-center">
                  {imagePreview && (
                    <div className="w-48 h-32 mx-auto mb-6 rounded-xl overflow-hidden border border-border">
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    >
                      <ScanLine className="h-8 w-8 text-primary" />
                    </motion.div>
                  </div>
                  <h3 className="font-semibold text-lg mb-2">
                    {status === "uploading" ? "Uploading…" : "Scanning & Grading…"}
                  </h3>
                  <p className="text-muted-foreground text-sm mb-6">
                    {status === "scanning" ? "OCR engine is reading your handwriting and comparing to mark scheme." : "Preparing your image for analysis."}
                  </p>
                  <div className="max-w-xs mx-auto">
                    <Progress value={progress} className="h-2 mb-2" />
                    <p className="text-xs text-muted-foreground">{progress}% complete</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {status === "done" && results && (
            <motion.div key="results" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {/* Score summary */}
              <Card className={`card-hover border-${percentage >= 70 ? "primary" : "destructive"}/30`}>
                <CardContent className="p-6 text-center">
                  <div className={`text-6xl font-extrabold mb-1 ${percentage >= 70 ? "text-primary" : "text-destructive"}`}>
                    {percentage}%
                  </div>
                  <p className="text-muted-foreground text-sm mb-4">
                    {totalScore} / {totalMax} marks
                  </p>
                  <Progress value={percentage} className="h-3 max-w-xs mx-auto mb-4" />
                  <div className="flex items-center justify-center gap-2">
                    <Badge variant={percentage >= 70 ? "default" : "destructive"}>
                      {percentage >= 85 ? "Excellent" : percentage >= 70 ? "Good" : percentage >= 50 ? "Pass" : "Needs work"}
                    </Badge>
                    <Button variant="outline" size="sm" className="gap-1" onClick={reset}>
                      <RotateCcw className="h-3.5 w-3.5" /> Retake
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Per-question breakdown */}
              {results.map((answer) => (
                <motion.div
                  key={answer.question}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: answer.question * 0.07 }}
                >
                  <Card className="card-hover">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${answer.score === answer.maxScore ? "bg-primary/10" : answer.score > 0 ? "bg-amber-100 dark:bg-amber-900/20" : "bg-destructive/10"}`}>
                          {answer.score === answer.maxScore
                            ? <CheckCircle2 className="h-4 w-4 text-primary" />
                            : answer.score > 0
                              ? <span className="text-xs font-bold text-amber-600">{answer.score}/{answer.maxScore}</span>
                              : <XCircle className="h-4 w-4 text-destructive" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-medium">Question {answer.question}</p>
                            <Badge variant="outline" className="text-[10px]">
                              {answer.score}/{answer.maxScore} marks
                            </Badge>
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
                            <Lightbulb className="h-3 w-3" />{answer.feedback}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
