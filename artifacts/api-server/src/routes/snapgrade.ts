import { Router } from "express";
import { eq, and, inArray } from "drizzle-orm";
import {
  db, studentsTable, snapgradeSubmissionsTable, markSchemesTable,
  homeworkTable, questionBankTable,
} from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";

const studentGuard = [authenticate, requireRole("student")];
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

// Tesseract OCR fallback (used when OPENAI_API_KEY is absent)
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

async function extractTextWithOpenAIVision(imagePath: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Fall back to Tesseract when no OpenAI key is configured
    return extractTextWithTesseract(imagePath);
  }
  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString("base64");
    const ext = path.extname(imagePath).replace(".", "") || "jpeg";
    const mimeType = ext === "jpg" ? "image/jpeg" : `image/${ext}`;

    const response = await fetch(`${process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
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
    const data = await response.json() as any;
    return data.choices?.[0]?.message?.content ?? "";
  } catch {
    return "";
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
  return { scored, annotated };
}

async function analyzeWithOpenAI(ocrText: string, criteria: Array<{ keyword: string; marks: number; description?: string }>, totalMarks: number) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const prompt = `You are grading a student's homework answer. The student wrote:

"${ocrText.slice(0, 1500)}"

Mark scheme criteria (${totalMarks} marks total):
${criteria.map(c => `- ${c.keyword}: ${c.marks} marks${c.description ? ` (${c.description})` : ""}`).join("\n")}

Respond with JSON: { "grade": <number 0-${totalMarks}>, "feedback": "<brief feedback>", "suggestions": ["<tip1>", "<tip2>"] }`;

  try {
    const response = await fetch(`${process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 300,
        response_format: { type: "json_object" },
      }),
    });
    const data = await response.json() as any;
    return JSON.parse(data.choices[0].message.content);
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
  if (!ocrText && req.file) {
    ocrText = await extractTextWithOpenAIVision(req.file.path);
  }

  let aiAnalysis: Record<string, unknown> = {};
  let grade: number | null = null;
  let feedback = "No feedback available.";
  let suggestions: string[] = [];
  let annotatedItems: Array<{ keyword: string; found: boolean; marks: number }> = [];

  if (homeworkId) {
    // Resolve homework → subjectId → question_bank items → mark_schemes
    // This is the correct linkage: mark_schemes.questionBankId → question_bank.id,
    // and question_bank items are tagged with the same subjectId as the homework.
    const [hw] = await db.select({ subjectId: homeworkTable.subjectId, teacherAccountId: homeworkTable.teacherAccountId })
      .from(homeworkTable).where(eq(homeworkTable.id, homeworkId)).limit(1);

    let schemeQuery: typeof markSchemesTable.$inferSelect | undefined;

    if (hw?.subjectId) {
      // Find question_bank items for this subject + teacher
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

      const aiResult = await analyzeWithOpenAI(ocrText, criteria, totalMarks);

      if (aiResult) {
        grade = aiResult.grade ?? null;
        feedback = aiResult.feedback ?? "See annotated items below.";
        suggestions = aiResult.suggestions ?? [];
        aiAnalysis = { source: "openai", ...aiResult };
      } else {
        const ruleResult = ruleBasedGrade(ocrText, criteria);
        grade = ruleResult.scored;
        annotatedItems = ruleResult.annotated;
        feedback = `Rule-based analysis: matched ${ruleResult.annotated.filter(a => a.found).length}/${criteria.length} criteria.`;
        aiAnalysis = { source: "rule_based", annotatedItems };
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

  res.json({
    submissionId: submission.id,
    grade,
    feedback,
    annotatedItems,
    suggestions,
    ocrText,
    aiAnalysis,
  });
});

export default router;
