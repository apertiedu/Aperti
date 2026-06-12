import { Router, Response, Request } from "express";
import { pool } from "@workspace/db";
import { authenticate, AuthRequest } from "../middleware/auth";
import multer from "multer";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export const questionExtractionRouter = Router();

/* ── In-memory job store (upgrade to Redis/DB for production) ─────────── */
interface ExtractionJob {
  id: string;
  status: "pending" | "processing" | "done" | "failed";
  createdBy: number;
  source: string;
  totalExtracted: number;
  approved: number;
  rejected: number;
  questions: ExtractedQuestion[];
  error?: string;
  createdAt: string;
  completedAt?: string;
}
interface ExtractedQuestion {
  id: string;
  text: string;
  marks: number | null;
  subparts: string[];
  topic: string;
  subject: string;
  difficulty: "easy" | "medium" | "hard";
  cognitiveLevel: "recall" | "understanding" | "application" | "analysis" | "evaluation";
  examStyle: "mcq" | "structured" | "extended" | "practical" | "calculation" | "theory";
  commandWord: string;
  paperType: string;
  diagramHint: string;
  markScheme?: string;
  status: "pending" | "approved" | "rejected";
  isDuplicate: boolean;
  duplicateOf?: number;
}

const jobs = new Map<string, ExtractionJob>();

questionExtractionRouter.use(authenticate as any);

/* POST /api/questions/extract — start extraction job */
questionExtractionRouter.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const { text, subject, paperType, source } = req.body;
    if (!text || text.trim().length < 20) {
      return res.status(400).json({ error: "Please provide the paper text content (min 20 characters)" });
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const job: ExtractionJob = {
      id: jobId,
      status: "pending",
      createdBy: req.userId!,
      source: source || "manual_paste",
      totalExtracted: 0,
      approved: 0,
      rejected: 0,
      questions: [],
      createdAt: new Date().toISOString(),
    };
    jobs.set(jobId, job);

    // Start async extraction
    extractQuestionsAsync(jobId, text, subject, paperType, req.userId!).catch(console.error);

    res.status(202).json({ jobId, status: "pending", message: "Extraction started" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* POST /api/questions/extract/upload — PDF upload extraction */
questionExtractionRouter.post("/upload",
  upload.fields([{ name: "questionPdf", maxCount: 1 }, { name: "markSchemePdf", maxCount: 1 }]),
  async (req: AuthRequest, res: Response) => {
    try {
      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const questionFile = files?.["questionPdf"]?.[0];
      const markSchemeFile = files?.["markSchemePdf"]?.[0];

      if (!questionFile) return res.status(400).json({ error: "Question paper PDF is required" });

      const { subject, paperType } = req.body;

      // Extract text from PDF
      let questionText = "";
      let markSchemeText = "";
      try {
        const pdfParse = (await import("pdf-parse")).default;
        const qData = await pdfParse(questionFile.buffer);
        questionText = qData.text;
        if (markSchemeFile) {
          const msData = await pdfParse(markSchemeFile.buffer);
          markSchemeText = msData.text;
        }
      } catch {
        questionText = questionFile.buffer.toString("utf8", 0, Math.min(questionFile.buffer.length, 10000));
      }

      if (!questionText || questionText.trim().length < 20) {
        return res.status(400).json({ error: "Could not extract text from PDF. Please ensure it is a text-based PDF." });
      }

      const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const job: ExtractionJob = {
        id: jobId,
        status: "pending",
        createdBy: req.userId!,
        source: "pdf_upload",
        totalExtracted: 0,
        approved: 0,
        rejected: 0,
        questions: [],
        createdAt: new Date().toISOString(),
      };
      jobs.set(jobId, job);

      extractQuestionsAsync(jobId, questionText, subject, paperType, req.userId!, markSchemeText).catch(console.error);

      res.status(202).json({ jobId, status: "pending", message: "PDF extraction started" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

/* GET /api/questions/extract/:jobId — job status */
questionExtractionRouter.get("/:jobId", async (req: AuthRequest, res: Response) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  if (job.createdBy !== req.userId && (req as any).role !== "admin") {
    return res.status(403).json({ error: "Access denied" });
  }
  res.json(job);
});

/* PUT /api/questions/extract/:jobId/approve — batch approve */
questionExtractionRouter.put("/:jobId/approve", async (req: AuthRequest, res: Response) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });

  const { questionIds, action } = req.body as { questionIds: string[]; action: "approve" | "reject" };
  if (!["approve", "reject"].includes(action)) return res.status(400).json({ error: "action must be approve or reject" });

  const ids = new Set(questionIds ?? job.questions.map(q => q.id));
  let saved = 0;

  for (const q of job.questions) {
    if (!ids.has(q.id)) continue;
    q.status = action === "approve" ? "approved" : "rejected";
    if (action === "approve") {
      try {
        await pool.query(
          `INSERT INTO question_bank
             (topic, subject, difficulty, cognitive_level, exam_style, paper_type, command_word, marks, text, created_by, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
           ON CONFLICT DO NOTHING`,
          [
            q.topic, q.subject, q.difficulty,
            q.cognitiveLevel || null, q.examStyle || null,
            q.paperType || paperTypeFallback(job.source),
            q.commandWord, q.marks, q.text, job.createdBy,
          ]
        );
        saved++;
      } catch { /* non-critical */ }
    }
  }

  job.approved = job.questions.filter(q => q.status === "approved").length;
  job.rejected = job.questions.filter(q => q.status === "rejected").length;

  res.json({ message: `${action === "approve" ? `Approved and saved ${saved} questions` : `Rejected ${ids.size} questions`}`, job });
});

/* GET /api/questions/extract — list recent jobs for user */
questionExtractionRouter.get("/", async (req: AuthRequest, res: Response) => {
  const userJobs = Array.from(jobs.values())
    .filter(j => j.createdBy === req.userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 20);
  res.json({ jobs: userJobs });
});

/* ── Async extraction logic ──────────────────────────────────────────── */
async function extractQuestionsAsync(
  jobId: string, text: string, subject: string, paperType: string, userId: number,
  markSchemeText?: string
) {
  const job = jobs.get(jobId)!;
  job.status = "processing";

  try {
    let extracted: ExtractedQuestion[] = [];

    if (process.env.OPENAI_API_KEY) {
      extracted = await extractWithAI(text, subject, paperType, markSchemeText);
    } else {
      extracted = extractWithRules(text, subject, paperType);
      if (markSchemeText) {
        extracted = matchMarkSchemeFallback(extracted, markSchemeText);
      }
    }

    // Duplicate detection
    if (extracted.length > 0) {
      try {
        for (const q of extracted) {
          const { rows } = await pool.query(
            `SELECT id FROM question_bank WHERE topic ILIKE $1 AND subject ILIKE $2 LIMIT 1`,
            [`%${q.topic.substring(0, 20)}%`, `%${q.subject}%`]
          );
          if (rows.length > 0) {
            q.isDuplicate = true;
            q.duplicateOf = rows[0].id;
          }
        }
      } catch { /* non-critical */ }
    }

    job.questions = extracted;
    job.totalExtracted = extracted.length;
    job.status = "done";
    job.completedAt = new Date().toISOString();
  } catch (err: any) {
    job.status = "failed";
    job.error = err.message;
  }
}

function matchMarkSchemeFallback(questions: ExtractedQuestion[], markSchemeText: string): ExtractedQuestion[] {
  const lines = markSchemeText.split("\n").filter(l => l.trim().length > 10);
  const qPattern = /^(\d+)\s*[\.\)]/;
  const msMap: Record<string, string[]> = {};
  let currentQ = "";
  for (const line of lines) {
    const m = line.match(qPattern);
    if (m) {
      currentQ = m[1];
      msMap[currentQ] = msMap[currentQ] ?? [];
    } else if (currentQ) {
      msMap[currentQ] = [...(msMap[currentQ] ?? []), line.trim()];
    }
  }
  return questions.map((q, i) => {
    const num = String(i + 1);
    const msLines = msMap[num];
    if (msLines && msLines.length > 0) {
      return { ...q, markScheme: msLines.slice(0, 8).join("\n") };
    }
    return q;
  });
}

async function extractWithAI(text: string, subject: string, paperType: string, markSchemeText?: string): Promise<ExtractedQuestion[]> {
  const msSection = markSchemeText
    ? `\n\nMark Scheme text (link answers to questions by number):\n"""\n${markSchemeText.substring(0, 2000)}\n"""`
    : "";

  const prompt = `You are an expert exam paper parser. Extract individual questions from this exam paper text.

Paper text:
"""
${text.substring(0, 3000)}
"""

Subject: ${subject || "Unknown"}
Paper type: ${paperType || "Unknown"}${msSection}

Return a JSON array of question objects:
[{
  "id": "q1",
  "text": "Full question text",
  "marks": 4,
  "subparts": ["(a) subpart text", "(b) subpart text"],
  "topic": "Topic name (e.g. Forces, Algebra)",
  "subject": "${subject || "Unknown"}",
  "difficulty": "easy|medium|hard",
  "cognitiveLevel": "recall|understanding|application|analysis|evaluation",
  "examStyle": "mcq|structured|extended|practical|calculation|theory",
  "commandWord": "Calculate|Explain|Describe|Define|Evaluate|Compare|Sketch|State|Suggest|Analyse",
  "paperType": "${paperType || "structured"}",
  "diagramHint": "Brief note if a diagram is referenced, or empty string",
  "markScheme": "Corresponding mark scheme answer, or empty string if not available"
}]

Cognitive level guide: recall=State/Define/List, understanding=Describe/Explain, application=Calculate/Solve/Use, analysis=Analyse/Compare/Deduce, evaluation=Evaluate/Justify/Assess.
Exam style guide: mcq=multiple choice, structured=short answer with parts, extended=long essay/report, practical=experiment/lab, calculation=purely numerical, theory=written explanation.

Extract 5-15 questions. Be thorough. Return ONLY the JSON array, no other text.`;

  const aiRes = await fetch(`${process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "meta/llama-3.1-70b-instruct",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 3000,
    }),
  });

  if (!aiRes.ok) throw new Error(`AI API error: ${aiRes.status}`);
  const data = await aiRes.json() as any;
  const raw = data.choices?.[0]?.message?.content ?? "[]";
  const match = raw.match(/\[[\s\S]+\]/);
  if (!match) return extractWithRules("", subject, paperType);

  const parsed = JSON.parse(match[0]);
  return parsed.map((q: any, i: number) => ({
    ...q,
    id: q.id || `q${i + 1}`,
    cognitiveLevel: q.cognitiveLevel || inferCognitiveLevel(q.commandWord || ""),
    examStyle: q.examStyle || inferExamStyle(q.paperType || "", q.marks),
    status: "pending" as const,
    isDuplicate: false,
  }));
}

function extractWithRules(text: string, subject: string, paperType: string): ExtractedQuestion[] {
  // Rule-based fallback: split by question numbers
  const lines = text.split("\n").filter(l => l.trim());
  const qPattern = /^(\d+)\s*[\.\)]\s+(.{20,})/;
  const questions: ExtractedQuestion[] = [];

  let current: Partial<ExtractedQuestion> | null = null;
  let idx = 0;

  for (const line of lines) {
    const match = line.match(qPattern);
    if (match) {
      if (current?.text) questions.push(current as ExtractedQuestion);
      idx++;
      const cw = extractCommandWord(match[2]);
      const mk = extractMarks(line);
      current = {
        id: `q${idx}`,
        text: match[2],
        marks: mk,
        subparts: [],
        topic: guessTopicFromText(match[2]),
        subject: subject || "General",
        difficulty: "medium",
        cognitiveLevel: inferCognitiveLevel(cw),
        examStyle: inferExamStyle(paperType || "", mk),
        commandWord: cw,
        paperType: paperType || "structured",
        diagramHint: "",
        status: "pending",
        isDuplicate: false,
      };
    } else if (current && line.match(/^\s*\([a-z]\)/)) {
      current.subparts = [...(current.subparts ?? []), line.trim()];
    }
  }
  if (current?.text) questions.push(current as ExtractedQuestion);

  // Return at least some sample data if nothing was parsed
  if (questions.length === 0) {
    return [{
      id: "q1",
      text: "Sample extracted question — please review and edit before approving.",
      marks: 4,
      subparts: [],
      topic: "General",
      subject: subject || "General",
      difficulty: "medium",
      commandWord: "Explain",
      paperType: paperType || "structured",
      diagramHint: "",
      status: "pending",
      isDuplicate: false,
    }];
  }
  return questions.slice(0, 20);
}

function extractMarks(text: string): number | null {
  const m = text.match(/\[(\d+)\s*marks?\]/i) || text.match(/\((\d+)\s*marks?\)/i);
  return m ? parseInt(m[1]) : null;
}
function extractCommandWord(text: string): string {
  const words = ["Calculate","Explain","Describe","Define","Evaluate","Compare","Sketch","State","Show","Determine","Suggest","Predict","Analyse","Discuss","Justify"];
  for (const w of words) {
    if (text.toLowerCase().startsWith(w.toLowerCase())) return w;
  }
  return "Explain";
}
function guessTopicFromText(text: string): string {
  const keywords: Record<string, string> = {
    force: "Forces", velocity: "Motion", energy: "Energy", momentum: "Momentum",
    wave: "Waves", circuit: "Electricity", atom: "Atomic Physics", cell: "Biology",
    acid: "Chemistry", equation: "Algebra", graph: "Graphs", probability: "Statistics",
  };
  const lower = text.toLowerCase();
  for (const [key, topic] of Object.entries(keywords)) {
    if (lower.includes(key)) return topic;
  }
  return "General";
}
function paperTypeFallback(source: string): string {
  if (source.includes("mcq") || source.includes("multiple")) return "mcq";
  return "structured";
}

function inferCognitiveLevel(commandWord: string): ExtractedQuestion["cognitiveLevel"] {
  const cw = commandWord.toLowerCase();
  if (["state","define","list","name","identify"].some(w => cw.includes(w)))     return "recall";
  if (["describe","explain","outline","summarise"].some(w => cw.includes(w)))    return "understanding";
  if (["calculate","solve","determine","use","apply"].some(w => cw.includes(w))) return "application";
  if (["analyse","compare","deduce","distinguish","interpret"].some(w => cw.includes(w))) return "analysis";
  if (["evaluate","justify","assess","discuss","suggest"].some(w => cw.includes(w))) return "evaluation";
  return "understanding";
}

function inferExamStyle(paperType: string, marks: number | null): ExtractedQuestion["examStyle"] {
  const pt = (paperType || "").toLowerCase();
  if (pt.includes("mcq") || pt.includes("multiple")) return "mcq";
  if (pt.includes("practical") || pt.includes("lab"))  return "practical";
  if (marks !== null && marks >= 1 && marks <= 2)       return "structured";
  if (marks !== null && marks >= 6)                     return "extended";
  return "structured";
}
