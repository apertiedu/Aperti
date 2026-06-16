import { Router } from "express";
import { eq, and, inArray } from "drizzle-orm";
import {
  db, studentsTable, snapgradeSubmissionsTable, markSchemesTable,
  homeworkTable, questionBankTable,
} from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { pool } from "@workspace/db";

const studentGuard = [authenticate, requireRole("student")];
const teacherGuard = [authenticate, requireRole("teacher", "admin", "super_admin")];
import type { Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();

const uploadDir = path.join(process.cwd(), "uploads", "snapgrade");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files allowed"));
  },
});

function getAIKey(): string | null {
  return (
    process.env.NVIDIA_API_KEY ??
    (process.env.AI_INTEGRATIONS_OPENAI_API_KEY && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL
      ? process.env.AI_INTEGRATIONS_OPENAI_API_KEY
      : null) ??
    process.env.OPENAI_API_KEY ??
    null
  );
}

function getAIBaseURL(): string {
  if (process.env.NVIDIA_API_KEY) return "https://integrate.api.nvidia.com/v1";
  if (process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) return process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  return process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
}

function getAIModel(): string {
  return process.env.OPENAI_MODEL ?? (process.env.NVIDIA_API_KEY ? "openai/gpt-oss-20b" : "gpt-4o-mini");
}

async function extractTextWithTesseract(imagePath: string): Promise<string> {
  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    const { data: { text } } = await worker.recognize(imagePath);
    await worker.terminate();
    return text.trim();
  } catch {
    return "";
  }
}

async function extractTextWithVision(imagePath: string): Promise<{ text: string; source: string }> {
  const apiKey = getAIKey();
  if (!apiKey) {
    const text = await extractTextWithTesseract(imagePath);
    return { text, source: "tesseract" };
  }
  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString("base64");
    const ext = path.extname(imagePath).replace(".", "") || "jpeg";
    const mimeType = ext === "jpg" ? "image/jpeg" : `image/${ext}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${getAIBaseURL()}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: getAIModel(),
        messages: [{
          role: "user",
          content: [
            { type: "text", text: "Extract all visible handwritten or printed text from this student homework image. Return only the raw text, no formatting." },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}`, detail: "high" } },
          ],
        }],
        max_tokens: 1000,
      }),
    });
    clearTimeout(timeout);
    const data = await response.json() as any;
    const text = data.choices?.[0]?.message?.content ?? "";
    return { text, source: "vision_ai" };
  } catch {
    const text = await extractTextWithTesseract(imagePath);
    return { text, source: "tesseract_fallback" };
  }
}

function ruleBasedGrade(ocrText: string, criteria: Array<{ keyword: string; marks: number }>) {
  const lower = ocrText.toLowerCase();
  let scored = 0;
  const annotated: Array<{ keyword: string; found: boolean; marks: number }> = [];
  for (const c of criteria) {
    const found = lower.includes(c.keyword.toLowerCase());
    if (found) scored += c.marks;
    annotated.push({ keyword: c.keyword, found, marks: c.marks });
  }
  const matchRatio = criteria.length > 0 ? annotated.filter(a => a.found).length / criteria.length : 0;
  const confidence = Math.min(0.55, 0.2 + matchRatio * 0.35);
  return { scored, annotated, confidence };
}

async function analyzeWithAI(
  ocrText: string,
  criteria: Array<{ keyword: string; marks: number; description?: string }>,
  totalMarks: number
): Promise<{ grade: number; feedback: string; suggestions: string[]; confidence: number } | null> {
  const apiKey = getAIKey();
  if (!apiKey) return null;

  const prompt = `You are grading a student's homework answer. The student wrote:

"${ocrText.slice(0, 1500)}"

Mark scheme criteria (${totalMarks} marks total):
${criteria.map(c => `- ${c.keyword}: ${c.marks} marks${c.description ? ` (${c.description})` : ""}`).join("\n")}

Respond with JSON only: { "grade": <number 0-${totalMarks}>, "feedback": "<brief feedback>", "suggestions": ["<tip1>", "<tip2>"], "confidence": <0.0-1.0> }
confidence reflects how certain you are about the grade (0=very uncertain, 1=very certain).`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(`${getAIBaseURL()}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: getAIModel(),
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 350,
        response_format: { type: "json_object" },
      }),
    });
    clearTimeout(timeout);

    const data = await response.json() as any;
    const parsed = JSON.parse(data.choices[0].message.content);
    return {
      grade: Math.min(Math.max(0, parseFloat(parsed.grade) || 0), totalMarks),
      feedback: parsed.feedback ?? "See suggestions below.",
      suggestions: parsed.suggestions ?? [],
      confidence: Math.min(1, Math.max(0, parseFloat(parsed.confidence) ?? 0.75)),
    };
  } catch {
    return null;
  }
}

router.post("/snapgrade/scan", ...studentGuard, upload.single("image"), async (req: AuthRequest, res: Response): Promise<void> => {
  const [student] = await db.select().from(studentsTable)
    .where(eq(studentsTable.accountId, req.userId!)).limit(1);
  if (!student) { res.status(403).json({ message: "No student record" }); return; }

  const homeworkId = req.body.homeworkId ? parseInt(req.body.homeworkId, 10) : null;
  const imageUrl = req.file ? `/uploads/snapgrade/${req.file.filename}` : null;

  let ocrText = req.body.text ?? "";
  let ocrSource = "manual";

  if (!ocrText && req.file) {
    const extraction = await extractTextWithVision(req.file.path);
    ocrText = extraction.text;
    ocrSource = extraction.source;
  }

  let aiAnalysis: Record<string, unknown> = {};
  let grade: number | null = null;
  let feedback = "No feedback available.";
  let suggestions: string[] = [];
  let annotatedItems: Array<{ keyword: string; found: boolean; marks: number }> = [];
  let aiConfidence: number | null = null;
  let aiSource = "none";
  let requiresTeacherReview = false;

  if (homeworkId) {
    const [hw] = await db.select({ subjectId: homeworkTable.subjectId, teacherAccountId: homeworkTable.teacherAccountId })
      .from(homeworkTable).where(eq(homeworkTable.id, homeworkId)).limit(1);

    let schemeQuery: typeof markSchemesTable.$inferSelect | undefined;

    if (hw?.subjectId) {
      const qbItems = await db.select({ id: questionBankTable.id })
        .from(questionBankTable)
        .where(and(
          eq(questionBankTable.subjectId, hw.subjectId),
          eq(questionBankTable.teacherAccountId, hw.teacherAccountId!)
        ))
        .limit(20);

      if (qbItems.length > 0) {
        const qbIds = qbItems.map(q => q.id);
        const [found] = await db.select().from(markSchemesTable)
          .where(inArray(markSchemesTable.questionBankId, qbIds))
          .limit(1);
        schemeQuery = found;
      }
    }

    const scheme = schemeQuery;

    if (scheme) {
      const criteria = (scheme.criteria as Array<{ keyword: string; marks: number; description?: string }>) ?? [];
      const totalMarks = parseFloat(scheme.totalMarks as string) || 0;

      const aiResult = await analyzeWithAI(ocrText, criteria, totalMarks);

      if (aiResult) {
        grade = aiResult.grade;
        feedback = aiResult.feedback;
        suggestions = aiResult.suggestions;
        aiConfidence = aiResult.confidence;
        aiSource = "ai_grading";
        aiAnalysis = { source: "ai", grade: aiResult.grade, feedback: aiResult.feedback, confidence: aiResult.confidence };
        requiresTeacherReview = aiResult.confidence < 0.65;
      } else {
        const ruleResult = ruleBasedGrade(ocrText, criteria);
        grade = ruleResult.scored;
        annotatedItems = ruleResult.annotated;
        aiConfidence = ruleResult.confidence;
        aiSource = "rule_based";
        feedback = `AI review unavailable. Teacher review mode activated. Rule-based analysis matched ${ruleResult.annotated.filter(a => a.found).length}/${criteria.length} criteria.`;
        aiAnalysis = { source: "rule_based", annotatedItems, confidence: ruleResult.confidence };
        requiresTeacherReview = true;
      }
    }
  }

  const [submission] = await db.insert(snapgradeSubmissionsTable).values({
    studentId: student.id,
    homeworkId,
    imageUrl,
    ocrText: ocrText || null,
    aiAnalysis,
    grade: grade !== null ? String(grade) : null,
    feedback,
  }).returning();

  await pool.query(
    `UPDATE snapgrade_submissions
     SET ai_confidence=$1, ai_source=$2
     WHERE id=$3`,
    [aiConfidence, aiSource, submission.id]
  ).catch(() => {});

  res.json({
    submissionId: submission.id,
    grade,
    feedback,
    annotatedItems,
    suggestions,
    ocrText,
    ocrSource,
    aiAnalysis,
    confidence: aiConfidence,
    aiSource,
    requiresTeacherReview,
    teacherReviewMessage: requiresTeacherReview
      ? "AI review unavailable. Teacher review mode activated."
      : null,
  });
});

router.get("/snapgrade/submissions", ...teacherGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { pending_review } = req.query;
    let query = `
      SELECT ss.id, ss.student_id, ss.homework_id, ss.grade, ss.feedback,
             ss.ai_confidence, ss.ai_source, ss.teacher_reviewed,
             ss.teacher_override_grade, ss.reviewed_at, ss.submitted_at,
             s.student_name, s.student_code,
             h.title AS homework_title
      FROM snapgrade_submissions ss
      LEFT JOIN students s ON s.id = ss.student_id
      LEFT JOIN homework h ON h.id = ss.homework_id
      WHERE s.teacher_account_id = $1
    `;
    const params: any[] = [req.userId!];

    if (pending_review === "true") {
      query += ` AND (ss.teacher_reviewed IS FALSE OR ss.teacher_reviewed IS NULL)
                 AND ss.grade IS NOT NULL`;
    }

    query += " ORDER BY ss.submitted_at DESC LIMIT 50";

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/snapgrade/submissions/:id", ...teacherGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(
      `SELECT ss.*, s.student_name, s.student_code, h.title AS homework_title,
              (SELECT json_agg(r ORDER BY r.created_at DESC)
               FROM ai_grade_reviews r WHERE r.submission_id = ss.id) AS review_history
       FROM snapgrade_submissions ss
       LEFT JOIN students s ON s.id = ss.student_id
       LEFT JOIN homework h ON h.id = ss.homework_id
       WHERE ss.id = $1`,
      [req.params.id]
    );
    if (!rows.length) { res.status(404).json({ error: "Submission not found" }); return; }
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/snapgrade/submissions/:id/review", ...teacherGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const submissionId = parseInt(req.params.id);
    const reviewerId = req.userId!;
    const { override_grade, override_feedback, decision, notes } = req.body as {
      override_grade?: number;
      override_feedback?: string;
      decision: "approved" | "rejected" | "modified";
      notes?: string;
    };

    if (!["approved", "rejected", "modified"].includes(decision)) {
      res.status(400).json({ error: "decision must be approved, rejected, or modified" });
      return;
    }

    const { rows: existing } = await pool.query(
      "SELECT id, grade, feedback, ai_confidence, ai_source FROM snapgrade_submissions WHERE id=$1",
      [submissionId]
    );
    if (!existing.length) { res.status(404).json({ error: "Submission not found" }); return; }
    const sub = existing[0];

    await pool.query(
      `INSERT INTO ai_grade_reviews
         (submission_id, reviewer_id, original_ai_grade, original_ai_feedback,
          original_ai_confidence, original_ai_source,
          override_grade, override_feedback, decision, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        submissionId, reviewerId,
        sub.grade, sub.feedback, sub.ai_confidence, sub.ai_source,
        override_grade ?? sub.grade, override_feedback ?? null,
        decision, notes ?? null,
      ]
    );

    const finalGrade = decision === "rejected" ? null
      : (override_grade !== undefined ? override_grade : sub.grade);
    const finalFeedback = override_feedback ?? sub.feedback;

    const { rows: updated } = await pool.query(
      `UPDATE snapgrade_submissions
       SET teacher_reviewed=TRUE,
           teacher_override_grade=$1,
           teacher_override_feedback=$2,
           reviewed_by=$3,
           reviewed_at=NOW()
       WHERE id=$4 RETURNING *`,
      [finalGrade, finalFeedback, reviewerId, submissionId]
    );

    res.json({
      submission: updated[0],
      decision,
      message: decision === "approved"
        ? "AI grade approved."
        : decision === "rejected"
        ? "AI grade rejected. Manual grading required."
        : "Grade modified and saved.",
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/snapgrade/review-stats", ...teacherGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await pool.query(
      `SELECT
         COUNT(ss.id)::int AS total_submissions,
         COUNT(CASE WHEN ss.teacher_reviewed = TRUE THEN 1 END)::int AS reviewed,
         COUNT(CASE WHEN ss.teacher_reviewed IS FALSE OR ss.teacher_reviewed IS NULL THEN 1 END)::int AS pending_review,
         COUNT(CASE WHEN r.decision = 'approved' THEN 1 END)::int AS approved,
         COUNT(CASE WHEN r.decision = 'modified' THEN 1 END)::int AS modified,
         COUNT(CASE WHEN r.decision = 'rejected' THEN 1 END)::int AS rejected,
         ROUND(AVG(ss.ai_confidence)::numeric, 3) AS avg_confidence
       FROM snapgrade_submissions ss
       LEFT JOIN students s ON s.id = ss.student_id AND s.teacher_account_id = $1
       LEFT JOIN ai_grade_reviews r ON r.submission_id = ss.id
       WHERE s.teacher_account_id = $1`,
      [req.userId!]
    );
    res.json(rows[0] ?? {});
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
