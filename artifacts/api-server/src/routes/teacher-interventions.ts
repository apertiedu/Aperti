import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, AuthRequest, requireRole } from "../middleware/auth";
import { openaiChat } from "../lib/ai-config";

export const teacherInterventionsRouter = Router();
teacherInterventionsRouter.use(authenticate, requireRole("teacher", "admin", "assistant"));

/* GET /api/teacher/interventions — AI-generated intervention suggestions per class */
teacherInterventionsRouter.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const teacherId = req.userId!;

    const { rows: subjects } = await pool.query(
      `SELECT s.id, s.name FROM subjects s WHERE s.teacher_account_id = $1`,
      [teacherId]
    );

    if (!subjects.length) return res.json({ interventions: [] });

    const results: any[] = [];

    for (const subject of subjects.slice(0, 5)) {
      const { rows: students } = await pool.query(
        `SELECT
           stu.id, a.display_name AS name,
           COALESCE(ROUND(AVG(sm.marks_obtained::numeric / NULLIF(sm.total_marks,0) * 100)::numeric, 1), NULL) AS avg_pct,
           COUNT(sm.id) AS assessments_taken,
           SUM(CASE WHEN att.status='absent' THEN 1 ELSE 0 END) AS absences,
           COUNT(att.id) AS total_lessons
         FROM students stu
         JOIN accounts a ON a.id = stu.account_id
         LEFT JOIN student_marks sm ON sm.student_id = stu.id
         LEFT JOIN attendance att ON att.student_id = stu.id
         WHERE stu.teacher_account_id = $1
         GROUP BY stu.id, a.display_name
         ORDER BY avg_pct ASC NULLS LAST
         LIMIT 20`,
        [teacherId]
      );

      if (!students.length) continue;

      const lowPerformers = students.filter((s: any) =>
        (s.avg_pct !== null && parseFloat(s.avg_pct) < 60) ||
        (s.total_lessons > 0 && s.absences / s.total_lessons > 0.25)
      );

      const topPerformers = students.filter((s: any) =>
        s.avg_pct !== null && parseFloat(s.avg_pct) >= 85
      );

      if (!lowPerformers.length && !topPerformers.length) {
        results.push({
          subjectId: subject.id,
          subjectName: subject.name,
          atRisk: [],
          suggestions: [],
          generatedAt: new Date().toISOString(),
        });
        continue;
      }

      const studentSummary = students.slice(0, 12).map((s: any) => ({
        name: s.name,
        avgPct: s.avg_pct ? parseFloat(s.avg_pct) : null,
        assessmentsTaken: parseInt(s.assessments_taken),
        absenceRate: s.total_lessons > 0
          ? Math.round((s.absences / s.total_lessons) * 100)
          : 0,
      }));

      let suggestions: string[] = [];

      if (process.env.OPENAI_API_KEY) {
        try {
          const prompt = `You are an expert educational advisor helping a teacher with class ${subject.name}.

Student performance data:
${JSON.stringify(studentSummary, null, 2)}

Generate 2-4 specific, actionable intervention suggestions. Focus on:
- Students scoring below 60% (name them directly)
- Students with high absence rates (name them directly)  
- Whole-class patterns if relevant
- Concrete actions the teacher can take this week

Keep each suggestion to 1-2 sentences. Be direct and practical. Return a JSON array of strings.`;

          const aiResponse = await openaiChat({
            systemPrompt: "You are a concise, practical educational advisor. Return only a JSON array of suggestion strings.",
            userMessage: prompt,
            maxTokens: 400,
          });

          const match = (aiResponse ?? "").match(/\[[\s\S]+\]/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            suggestions = Array.isArray(parsed) ? parsed.filter((s: any) => typeof s === "string") : [];
          }
        } catch {
          suggestions = generateRuleSuggestions(lowPerformers, subject.name);
        }
      } else {
        suggestions = generateRuleSuggestions(lowPerformers, subject.name);
      }

      results.push({
        subjectId: subject.id,
        subjectName: subject.name,
        atRisk: lowPerformers.map((s: any) => ({
          name: s.name,
          avgPct: s.avg_pct ? parseFloat(s.avg_pct) : null,
          absenceRate: s.total_lessons > 0
            ? Math.round((s.absences / s.total_lessons) * 100) : 0,
        })),
        topPerformers: topPerformers.map((s: any) => ({
          name: s.name,
          avgPct: parseFloat(s.avg_pct),
        })),
        suggestions,
        generatedAt: new Date().toISOString(),
      });
    }

    res.json({ interventions: results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

function generateRuleSuggestions(lowPerformers: any[], subjectName: string): string[] {
  const suggestions: string[] = [];
  const names = lowPerformers.map((s: any) => s.name).slice(0, 3).join(", ");

  if (lowPerformers.length > 0) {
    suggestions.push(
      `Schedule 1-to-1 catch-up sessions with ${names} — their ${subjectName} averages are below 60%.`
    );
  }

  const highAbsence = lowPerformers.filter((s: any) => s.absences / (s.total_lessons || 1) > 0.25);
  if (highAbsence.length > 0) {
    suggestions.push(
      `Contact parents of ${highAbsence.map((s: any) => s.name).join(", ")} — absence rate above 25% is impacting their progress.`
    );
  }

  if (lowPerformers.length >= 4) {
    suggestions.push(
      `Consider a whole-class revision session on core ${subjectName} concepts — ${lowPerformers.length} students are below threshold.`
    );
  }

  return suggestions;
}
