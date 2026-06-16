import { Router, Response } from "express";
import { authenticate, AuthRequest, requireRole } from "../middleware/auth";
import { pool } from "@workspace/db";
import { withLanguage } from "../lib/ai-config";
import { generateAIResponse, AI_AVAILABLE } from "../services/ai";

export const parentAiRouter = Router();

const authParent = [authenticate, requireRole("parent")];

async function isLinked(parentId: number, studentId: number): Promise<boolean> {
  const { rows } = await pool.query(
    "SELECT id FROM guardian_links WHERE parent_account_id=$1 AND student_id=$2 AND status='active'",
    [parentId, studentId]
  );
  return rows.length > 0;
}

parentAiRouter.post(
  "/parent/ai-assistant/:studentId",
  ...authParent,
  async (req: AuthRequest, res: Response) => {
    try {
      const studentId = parseInt(req.params.studentId);
      const { question, language } = req.body;

      if (!question?.trim()) {
        return res.status(400).json({ error: "question is required" });
      }

      if (!(await isLinked(req.userId!, studentId))) {
        return res.status(403).json({ error: "Not linked to this student" });
      }

      const { rows: studentRows } = await pool.query(
        `SELECT s.student_name, a.display_name
         FROM students s LEFT JOIN accounts a ON a.id=s.account_id
         WHERE s.id=$1`,
        [studentId]
      );
      const studentName = studentRows[0]?.display_name || studentRows[0]?.student_name || "your child";

      let analysis: any = null;
      try {
        const { analyzeStudent } = await import("../lib/coremind");
        analysis = await analyzeStudent(studentId);
      } catch { }

      const [attRes, gradeRes] = await Promise.all([
        pool.query(
          `SELECT ROUND(
            COUNT(CASE WHEN status='present' THEN 1 END)::numeric / NULLIF(COUNT(*),0)*100, 1
          ) AS att_rate FROM attendance WHERE student_id=$1`,
          [studentId]
        ),
        pool.query(
          `SELECT ROUND(AVG(sm.marks_scored::float / NULLIF(eq.marks,0)*100),1) AS avg_pct
           FROM student_marks sm
           JOIN exam_questions eq ON eq.id=sm.question_id
           WHERE sm.student_id=$1`,
          [studentId]
        ),
      ]);

      const attRate = parseFloat(attRes.rows[0]?.att_rate ?? "0");
      const avgGrade = parseFloat(gradeRes.rows[0]?.avg_pct ?? "0");

      const dataCtx = [
        `Student: ${studentName}`,
        `Attendance: ${attRate}%`,
        `Average grade: ${avgGrade > 0 ? `${avgGrade}%` : "No exam data yet"}`,
        analysis ? `CoreMind risk level: ${analysis.riskLevel}` : null,
        analysis ? `Exam readiness: ${analysis.examReadiness}%` : null,
        analysis?.weakTopics?.length > 0 ? `Weak topics: ${analysis.weakTopics.slice(0, 3).join(", ")}` : null,
        analysis?.recommendedActions?.length > 0 ? `Recommendations: ${analysis.recommendedActions.slice(0, 2).join("; ")}` : null,
      ].filter(Boolean).join("\n");

      if (!AI_AVAILABLE) {
        let reply = `Here is what I know about ${studentName}:\n\n`;
        reply += `**Attendance:** ${attRate}%\n`;
        reply += `**Average Grade:** ${avgGrade > 0 ? `${avgGrade}%` : "Not yet recorded"}\n`;
        if (analysis) {
          reply += `**Exam Readiness:** ${analysis.examReadiness}%\n`;
          reply += `**Risk Level:** ${analysis.riskLevel}\n`;
          if (analysis.weakTopics?.length > 0) {
            reply += `**Weak Topics:** ${analysis.weakTopics.slice(0, 3).join(", ")}\n`;
          }
          if (analysis.recommendedActions?.length > 0) {
            reply += `\n**Recommended Actions:**\n${analysis.recommendedActions.map((a: string) => `- ${a}`).join("\n")}`;
          }
        }
        reply += "\n\n*AI assistant unavailable. Configure an AI API key for conversational responses.*";
        return res.json({ reply, studentName, dataCtx, fallback: true });
      }

      const baseSystemPrompt = `You are a caring parent assistant for the Aperti educational platform. 
You answer parent questions about their child's academic progress with empathy and clarity.
You have access to real student data. Be specific, supportive, and actionable.
Never be alarmist — frame concerns constructively.`;

      const systemPrompt = withLanguage(baseSystemPrompt, language);

      const userPrompt = `Parent question: "${question}"

Real student data:
${dataCtx}

Answer the parent's question using the data above. Be warm, specific, and give 1-2 clear actionable suggestions.`;

      const result = await generateAIResponse(
        userPrompt,
        {
          systemPrompt,
          maxTokens: 600,
          module: "parent-ai",
        }
      );

      if (!result.ok || !result.text) {
        let reply = `Here is what I know about ${studentName}:\n\n`;
        reply += `**Attendance:** ${attRate}%\n`;
        reply += `**Average Grade:** ${avgGrade > 0 ? `${avgGrade}%` : "Not yet recorded"}\n`;
        if (analysis) {
          reply += `**Exam Readiness:** ${analysis.examReadiness}%\n`;
          reply += `**Risk Level:** ${analysis.riskLevel}\n`;
          if (analysis.weakTopics?.length > 0) {
            reply += `**Weak Topics:** ${analysis.weakTopics.slice(0, 3).join(", ")}\n`;
          }
        }
        reply += "\n\n*AI review unavailable. Teacher review mode activated.*";
        return res.json({ reply, studentName, dataCtx, fallback: true, error: result.error });
      }

      res.json({ reply: result.text, studentName, coremindBacked: analysis !== null, latencyMs: result.latencyMs });
    } catch (err: any) {
      res.status(500).json({ error: "An unexpected error occurred" });
    }
  }
);

parentAiRouter.get(
  "/parent/ai-snapshot/:studentId",
  ...authParent,
  async (req: AuthRequest, res: Response) => {
    try {
      const studentId = parseInt(req.params.studentId);
      if (!(await isLinked(req.userId!, studentId))) {
        return res.status(403).json({ error: "Not linked" });
      }

      let analysis: any = null;
      try {
        const { analyzeStudent } = await import("../lib/coremind");
        analysis = await analyzeStudent(studentId);
      } catch { }

      if (!analysis) {
        return res.json({ available: false, message: "No AI data available yet for this student." });
      }

      res.json({
        available: true,
        riskLevel: analysis.riskLevel,
        examReadiness: analysis.examReadiness,
        weakTopics: analysis.weakTopics.slice(0, 3),
        recommendedActions: analysis.recommendedActions.slice(0, 3),
        nextBestTopic: analysis.nextBestTopic,
      });
    } catch (err: any) {
      res.status(500).json({ error: "An unexpected error occurred" });
    }
  }
);
