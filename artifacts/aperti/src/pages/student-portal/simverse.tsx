import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CircuitBoard, FlaskConical, Shapes, Microscope, Beaker, Send, Sparkles } from "lucide-react";
import ForgeField from "./labs/forge-field";
import ReactSphere from "./labs/react-sphere";
import Geometrix from "./labs/geometric";
import BioSphere from "./labs/biosphere";
import { useToast } from "@/hooks/use-toast";


function PulseLab() {
  const { toast } = useToast();
  const [hypothesis, setHypothesis] = useState("");
  const [procedure, setProcedure] = useState("");
  const [observations, setObservations] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const handleEvaluate = async () => {
    if (!hypothesis.trim() || !procedure.trim() || !observations.trim()) {
      toast({ title: "Complete all fields", description: "Fill in hypothesis, procedure and observations first.", variant: "destructive" });
      return;
    }
    setEvaluating(true);
    setResult(null);
    const prompt = `Evaluate this student science experiment:

Hypothesis: ${hypothesis}
Procedure: ${procedure}
Observations: ${observations}

Provide structured feedback covering:
1. Hypothesis clarity and testability
2. Experimental procedure quality (controls, variables)
3. Observations and data quality
4. Conclusions the student could draw
5. Suggestions for improvement

Be encouraging and educational. Keep response under 300 words.`;

    try {
      const res = await fetch("/api/mentor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt, sessionId: "pulseLab" }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setResult(data.content || generateFallbackEvaluation(hypothesis, procedure, observations));
        return;
      }

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("text/event-stream")) {
        const data = await res.json();
        setResult(data.content || generateFallbackEvaluation(hypothesis, procedure, observations));
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n").filter((l) => l.startsWith("data: "))) {
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            fullContent += parsed.content || "";
            setResult(fullContent);
          } catch {}
        }
      }
      if (!fullContent) setResult(generateFallbackEvaluation(hypothesis, procedure, observations));
    } catch {
      setResult(generateFallbackEvaluation(hypothesis, procedure, observations));
    } finally {
      setEvaluating(false);
    }
  };

  const reset = () => {
    setHypothesis(""); setProcedure(""); setObservations(""); setResult(null); setStep(1);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-teal-50 to-emerald-50 rounded-2xl border border-teal-100">
        <div className="h-10 w-10 rounded-xl bg-teal-600 flex items-center justify-center shrink-0">
          <Beaker className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-gray-900 text-sm">PulseLab — Experiment Evaluator</h3>
          <p className="text-xs text-gray-500 mt-0.5">Record your experiment, then get AI-powered feedback on your scientific method.</p>
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <button onClick={() => setStep(s as 1 | 2 | 3)}
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step === s ? "text-white" : step > s ? "bg-teal-100 text-teal-700" : "bg-gray-100 text-gray-400"
              }`}
              style={step === s ? { background: "#0D9488" } : {}}>
              {s}
            </button>
            <span className={`text-xs ${step === s ? "text-teal-700 font-semibold" : "text-gray-400"}`}>
              {s === 1 ? "Hypothesis" : s === 2 ? "Procedure" : "Observations"}
            </span>
            {s < 3 && <div className="w-6 h-px bg-gray-200 mx-1" />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="bg-card rounded-2xl border border-border shadow-sm p-5 space-y-3">
              <label className="text-sm font-bold text-gray-900">Hypothesis</label>
              <p className="text-xs text-gray-500">State what you predict will happen and why.</p>
              <Textarea
                value={hypothesis}
                onChange={(e) => setHypothesis(e.target.value)}
                placeholder="e.g. I predict that increasing the temperature will increase the rate of reaction because..."
                rows={4}
                className="resize-none rounded-xl border-gray-200 text-sm"
                aria-label="Hypothesis"
              />
              <Button onClick={() => setStep(2)} disabled={!hypothesis.trim()} className="w-full rounded-xl" style={{ background: "#0D9488" }}>
                Next: Procedure →
              </Button>
            </div>
          </motion.div>
        )}
        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="bg-card rounded-2xl border border-border shadow-sm p-5 space-y-3">
              <label className="text-sm font-bold text-gray-900">Procedure</label>
              <p className="text-xs text-gray-500">Describe what you did step by step. Include variables and controls.</p>
              <Textarea
                value={procedure}
                onChange={(e) => setProcedure(e.target.value)}
                placeholder="1. Set up the apparatus...\n2. Measure...\n3. Record..."
                rows={5}
                className="resize-none rounded-xl border-gray-200 text-sm"
                aria-label="Procedure"
              />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="rounded-xl">← Back</Button>
                <Button onClick={() => setStep(3)} disabled={!procedure.trim()} className="flex-1 rounded-xl" style={{ background: "#0D9488" }}>
                  Next: Observations →
                </Button>
              </div>
            </div>
          </motion.div>
        )}
        {step === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <div className="bg-card rounded-2xl border border-border shadow-sm p-5 space-y-3">
              <label className="text-sm font-bold text-gray-900">Observations & Results</label>
              <p className="text-xs text-gray-500">Record what you observed. Include data, measurements, unexpected results.</p>
              <Textarea
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="e.g. At 20°C the reaction took 45s. At 40°C it took 22s..."
                rows={5}
                className="resize-none rounded-xl border-gray-200 text-sm"
                aria-label="Observations"
              />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)} className="rounded-xl">← Back</Button>
                <Button
                  onClick={handleEvaluate}
                  disabled={evaluating || !observations.trim()}
                  className="flex-1 rounded-xl gap-2"
                  style={{ background: "#0D9488" }}
                >
                  {evaluating
                    ? <><div className="h-3.5 w-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Evaluating…</>
                    : <><Sparkles className="h-3.5 w-3.5" /> Evaluate Experiment</>}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Result */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-teal-50 to-emerald-50 rounded-2xl border border-teal-100 p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-7 w-7 rounded-lg bg-teal-600 flex items-center justify-center">
                <Sparkles className="h-3.5 w-3.5 text-white" />
              </div>
              <h4 className="font-bold text-teal-800 text-sm">Mentor Evaluation</h4>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{result}</p>
            <Button variant="outline" size="sm" onClick={reset} className="mt-4 text-xs rounded-xl">
              Start New Experiment
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function generateFallbackEvaluation(hypothesis: string, procedure: string, observations: string): string {
  return `**Experiment Evaluation**

**Hypothesis Assessment:**
Your hypothesis "${hypothesis.slice(0, 80)}..." shows scientific thinking. Make sure it includes a clear independent variable, dependent variable, and reasoning.

**Procedure Review:**
Your procedure covers the main steps. Consider adding: specific quantities/measurements, a control group, and how you'll ensure fair testing.

**Observations Analysis:**
Your observations "${observations.slice(0, 80)}..." provide useful data. Try to quantify results with numbers where possible and note any anomalies.

**Suggested Conclusions:**
Based on your observations, think about whether your hypothesis was supported, partially supported, or refuted. Explain any unexpected results.

**Improvements for Next Time:**
• Add more trials for reliability
• Identify and control variables more explicitly
• Include error analysis in your results`;
}

export default function SimVerse() {
  return (
    <div className="min-h-screen bg-[#F8FAFB] px-4 py-6" style={{ fontFamily: "Inter, sans-serif" }}>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-teal-50 flex items-center justify-center">
            <FlaskConical className="h-4.5 w-4.5 text-teal-600" style={{ width: 18, height: 18 }} />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900">SimVerse</h1>
            <p className="text-xs text-gray-500">Five interactive science labs</p>
          </div>
        </div>
      </motion.div>

      <Tabs defaultValue="physics" className="space-y-5">
        <TabsList className="grid grid-cols-3 sm:grid-cols-5 h-auto gap-1 p-1 rounded-xl">
          <TabsTrigger value="physics" className="gap-1.5 text-xs py-2 rounded-lg">
            <CircuitBoard className="h-3.5 w-3.5" /> ForgeField
          </TabsTrigger>
          <TabsTrigger value="chemistry" className="gap-1.5 text-xs py-2 rounded-lg">
            <FlaskConical className="h-3.5 w-3.5" /> ReactSphere
          </TabsTrigger>
          <TabsTrigger value="geometry" className="gap-1.5 text-xs py-2 rounded-lg">
            <Shapes className="h-3.5 w-3.5" /> Geometrix
          </TabsTrigger>
          <TabsTrigger value="biology" className="gap-1.5 text-xs py-2 rounded-lg">
            <Microscope className="h-3.5 w-3.5" /> BioSphere
          </TabsTrigger>
          <TabsTrigger value="pulse" className="gap-1.5 text-xs py-2 rounded-lg">
            <Beaker className="h-3.5 w-3.5" /> PulseLab
          </TabsTrigger>
        </TabsList>

        <TabsContent value="physics">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <ForgeField />
          </motion.div>
        </TabsContent>
        <TabsContent value="chemistry">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <ReactSphere />
          </motion.div>
        </TabsContent>
        <TabsContent value="geometry">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Geometrix />
          </motion.div>
        </TabsContent>
        <TabsContent value="biology">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <BioSphere />
          </motion.div>
        </TabsContent>
        <TabsContent value="pulse">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
            <PulseLab />
          </motion.div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
