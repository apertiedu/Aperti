import { Router } from "express";
import { eq, and } from "drizzle-orm";
import {
  db, studentsTable, examsTable, examQuestionsTable, examVaultPackagesTable, studentMarksTable,
} from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";

const studentGuard = [authenticate, requireRole("student")];
import type { Response } from "express";
import crypto from "crypto";

const router = Router();

/**
 * Derive a per-student-exam AES-256 key using HKDF from the master EXAM_VAULT_KEY.
 * Each (studentId, examId) pair gets a unique key — preventing cross-exam decryption.
 * Throws if EXAM_VAULT_KEY is not configured or too short.
 */
function deriveExamKey(studentId: number, examId: number): Buffer {
  const masterKey = process.env.EXAM_VAULT_KEY;
  if (!masterKey || masterKey.length < 32) {
    throw new Error(
      "EXAM_VAULT_KEY environment variable must be set and at least 32 characters. " +
      "ExamVault requires a secure master key."
    );
  }
  const ikm = Buffer.from(masterKey.slice(0, 32));
  const salt = crypto.randomBytes(0); // deterministic derivation
  const info = Buffer.from(`exam:${examId}:student:${studentId}`);
  return crypto.hkdfSync("sha256", ikm, salt, info, 32);
}

function encryptPayload(data: string, studentId: number, examId: number): { encrypted: string; iv: string } {
  const key = deriveExamKey(studentId, examId);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(data, "utf8", "base64");
  encrypted += cipher.final("base64");
  return { encrypted, iv: iv.toString("base64") };
}

function decryptPayload(encrypted: string, ivBase64: string, studentId: number, examId: number): string {
  const key = deriveExamKey(studentId, examId);
  const iv = Buffer.from(ivBase64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let decrypted = decipher.update(encrypted, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

async function requireStudent(req: AuthRequest, res: Response): Promise<{ studentId: number; teacherAccountId: number | null } | null> {
  const [student] = await db.select({
    id: studentsTable.id,
    teacherAccountId: studentsTable.teacherAccountId,
  }).from(studentsTable).where(eq(studentsTable.accountId, req.userId!)).limit(1);
  if (!student) { res.status(403).json({ message: "No student record" }); return null; }
  return { studentId: student.id, teacherAccountId: student.teacherAccountId };
}

// GET /exam-vault/download/:examId — primary contract path
// GET /exam-vault/packages/:examId — alternate path (backward compat)
const downloadHandler = async (req: AuthRequest, res: Response): Promise<void> => {
  const ctx = await requireStudent(req, res);
  if (!ctx) return;
  const { studentId, teacherAccountId } = ctx;

  // Fail early if master key is not configured
  try { deriveExamKey(0, 0); } catch (e: any) {
    res.status(503).json({ message: "ExamVault not configured: " + e.message }); return;
  }

  const examId = parseInt(req.params.examId, 10);

  const [exam] = await db.select().from(examsTable).where(eq(examsTable.id, examId));
  if (!exam) { res.status(404).json({ message: "Exam not found" }); return; }

  // Authorization: exam must belong to this student's teacher
  if (!teacherAccountId || exam.teacherAccountId !== teacherAccountId) {
    res.status(403).json({ message: "Not authorized to access this exam" }); return;
  }

  const questions = await db.select({
    id: examQuestionsTable.id,
    questionText: examQuestionsTable.questionText,
    topic: examQuestionsTable.topic,
    maxMarks: examQuestionsTable.maxMarks,
    questionOrder: examQuestionsTable.questionOrder,
    questionType: examQuestionsTable.questionType,
    options: examQuestionsTable.options,
  }).from(examQuestionsTable)
    .where(eq(examQuestionsTable.examId, examId))
    .orderBy(examQuestionsTable.questionOrder);

  const payload = JSON.stringify({ examId, examName: exam.name, examDate: exam.examDate, questions });

  // Use per-student-exam derived key
  const { encrypted, iv } = encryptPayload(payload, studentId, examId);

  const existing = await db.select().from(examVaultPackagesTable)
    .where(and(eq(examVaultPackagesTable.examId, examId), eq(examVaultPackagesTable.studentId, studentId)))
    .limit(1);

  let pkg;
  if (existing.length > 0) {
    [pkg] = await db.update(examVaultPackagesTable)
      .set({ encryptedData: encrypted, encryptionKey: iv, downloadedAt: new Date() })
      .where(eq(examVaultPackagesTable.id, existing[0].id))
      .returning();
  } else {
    [pkg] = await db.insert(examVaultPackagesTable).values({
      examId,
      studentId,
      encryptedData: encrypted,
      encryptionKey: iv,
      downloadedAt: new Date(),
    }).returning();
  }

  res.json({
    packageId: pkg.id,
    examId,
    examName: exam.name,
    examDate: exam.examDate,
    timeLimitMinutes: exam.timeLimitMinutes,
    encryptedData: encrypted,
    iv,
    questionCount: questions.length,
    totalMarks: exam.totalMarks,
  });
};

router.get("/exam-vault/download/:examId", ...studentGuard, downloadHandler);
router.get("/exam-vault/packages/:examId", ...studentGuard, downloadHandler);

// POST /exam-vault/submit
router.post("/exam-vault/submit", ...studentGuard, async (req: AuthRequest, res: Response): Promise<void> => {
  const ctx = await requireStudent(req, res);
  if (!ctx) return;
  const { studentId } = ctx;

  // Fail early if master key is not configured
  try { deriveExamKey(0, 0); } catch (e: any) {
    res.status(503).json({ message: "ExamVault not configured: " + e.message }); return;
  }

  const { packageId, encryptedData, iv } = req.body;
  if (!packageId || !encryptedData || !iv) {
    res.status(400).json({ message: "packageId, encryptedData, and iv required" }); return;
  }

  const [pkg] = await db.select().from(examVaultPackagesTable)
    .where(and(eq(examVaultPackagesTable.id, parseInt(packageId, 10)), eq(examVaultPackagesTable.studentId, studentId)));
  if (!pkg) { res.status(404).json({ message: "Package not found or not authorized" }); return; }
  if (pkg.submittedAt) { res.status(400).json({ message: "Already submitted" }); return; }

  // Decrypt using the same per-student-exam derived key
  let decoded: { answers?: Record<string, string> };
  try {
    decoded = JSON.parse(decryptPayload(encryptedData, iv, studentId, pkg.examId));
  } catch {
    res.status(400).json({ message: "Invalid encrypted submission — key mismatch or tampered payload" }); return;
  }

  const answers = decoded.answers ?? {};

  const questions = await db.select().from(examQuestionsTable)
    .where(eq(examQuestionsTable.examId, pkg.examId));

  let totalScored = 0;

  for (const q of questions) {
    const ans = answers[String(q.id)];
    let scored = 0;

    if (q.questionType === "mcq" && q.correctOption !== null && ans !== undefined) {
      scored = parseInt(ans, 10) === q.correctOption
        ? parseFloat(String(q.maxMarks ?? 0))
        : 0;
    }

    totalScored += scored;
    await db.insert(studentMarksTable).values({
      studentId,
      examId: pkg.examId,
      questionId: q.id,
      marksScored: String(scored),
    }).onConflictDoNothing();
  }

  await db.update(examVaultPackagesTable)
    .set({
      submittedAt: new Date(),
      gradedScore: String(totalScored),
      submissionData: JSON.stringify(answers),
    })
    .where(eq(examVaultPackagesTable.id, pkg.id));

  res.json({ success: true, gradedScore: totalScored, questionsGraded: questions.length });
});

export default router;
