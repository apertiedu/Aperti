import { Router, Response, Request } from "express";
import { pool } from "@workspace/db";
import { authenticate, AuthRequest } from "../middleware/auth";

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
  commandWord: string;
  paperType: string;
  diagramHint: string;
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
          `INSERT INTO question_bank (topic, subject, difficulty, paper_type, command_word, marks, text, created_by, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
           ON CONFLICT DO NOTHING`,
          [q.topic, q.subject, q.difficulty, q.paperType || paperTypeFallback(job.source),
           q.commandWord, q.marks, q.text, job.createdBy]
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
  jobId: string, text: string, subject: string, paperType: string, userId: number
) {
  const job = jobs.get(jobId)!;
  job.status = "processing";

  try {
    let extracted: ExtractedQuestion[] = [];

    if (process.env.OPENAI_API_KEY) {
      extracted = await extractWithAI(text, subject, paperType);
    } else {
      extracted = extractWithRules(text, subject, paperType);
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

async function extractWithAI(text: string, subject: string, paperType: string): Promise<ExtractedQuestion[]> {
  const prompt = `You are an expert exam paper parser. Extract individual questions from this exam paper text.

Paper text:
"""
${text.substring(0, 3000)}
"""

Subject: ${subject || "Unknown"}
Paper type: ${paperType || "Unknown"}

Return a JSON array of question objects:
[{
  "id": "q1",
  "text": "Full question text",
  "marks": 4,
  "subparts": ["(a) subpart text", "(b) subpart text"],
  "topic": "Topic name (e.g. Forces, Algebra)",
  "subject": "${subject || "Unknown"}",
  "difficulty": "easy|medium|hard",
  "commandWord": "Calculate|Explain|Describe|Define|Evaluate|Compare|Sketch",
  "paperType": "${paperType || "structured"}",
  "diagramHint": "Brief note if a diagram is referenced, or empty string"
}]

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
      current = {
        id: `q${idx}`,
        text: match[2],
        marks: extractMarks(line),
        subparts: [],
        topic: guessTopicFromText(match[2]),
        subject: subject || "General",
        difficulty: "medium",
        commandWord: extractCommandWord(match[2]),
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
