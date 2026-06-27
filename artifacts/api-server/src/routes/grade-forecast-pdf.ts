import { Router, Response } from "express";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { pool } from "@workspace/db";
import PDFDocument from "pdfkit";
import { AI_AVAILABLE } from "../services/ai";

export const gradeForecastPdfRouter = Router();

gradeForecastPdfRouter.get(
  "/grade-prediction/forecast-pdf",
  authenticate,
  requireRole("teacher", "admin"),
  async (req: AuthRequest, res: Response) => {
    if (!AI_AVAILABLE) {
      return res.status(503).json({
        error: "AI grade forecasting is not available — OPENAI_API_KEY is not configured.",
        ai_available: false,
      });
    }
    try {
      const teacherId = req.userId!;
      const subjectId = req.query.subjectId ? parseInt(req.query.subjectId as string) : null;
      const examId = req.query.examId ? parseInt(req.query.examId as string) : null;

      // ── Fetch class forecast data ─────────────────────────────────────────
      const subjectFilter = subjectId ? "AND e.subject_id = $2" : "";
      const examFilter = examId ? `AND e.id = ${examId}` : "";

      const params: any[] = [teacherId];
      if (subjectId) params.push(subjectId);

      const { rows: students } = await pool.query(`
        SELECT
          s.id AS student_id,
          s.student_name,
          s.student_code,
          ROUND(AVG(sm.marks_scored::float / NULLIF(eq.marks, 0) * 100)::numeric, 1) AS recent_avg,
          ROUND(AVG(sm.marks_scored::float / NULLIF(eq.marks, 0) * 100)::numeric, 1) AS overall_avg,
          COUNT(DISTINCT sm.question_id) AS data_points,
          COUNT(DISTINCT e.id) AS exam_count
        FROM students s
        JOIN student_marks sm ON sm.student_id = s.id
        JOIN exam_questions eq ON eq.id = sm.question_id
        JOIN exams e ON e.id = eq.exam_id
        WHERE e.teacher_account_id = $1
          ${subjectFilter}
          ${examFilter}
        GROUP BY s.id, s.student_name, s.student_code
        HAVING COUNT(sm.question_id) >= 2
        ORDER BY recent_avg DESC NULLS LAST
      `, params);

      const { rows: subjectRow } = subjectId
        ? await pool.query("SELECT name, board, level FROM subjects WHERE id=$1", [subjectId])
        : { rows: [] };

      const subject = subjectRow[0];

      // ── Build PDF ─────────────────────────────────────────────────────────
      const doc = new PDFDocument({ margin: 40, size: "A4" });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="grade-forecast-${subjectId ?? "all"}.pdf"`,
      );
      doc.pipe(res);

      // Header
      doc.fontSize(20).font("Helvetica-Bold").fillColor("#0f766e").text("Grade Forecast Report", { align: "center" });
      doc.moveDown(0.3);
      doc.fontSize(10).font("Helvetica").fillColor("#6b7280")
        .text(`Generated: ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}`, { align: "center" });

      if (subject) {
        doc.moveDown(0.4);
        doc.fontSize(11).fillColor("#0f766e").text(`${subject.name} · ${subject.board} · ${subject.level}`, { align: "center" });
      }

      doc.moveDown(1);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor("#e5e7eb").stroke();
      doc.moveDown(0.5);

      // Summary stats
      if (students.length > 0) {
        const scores = students.map((s: any) => parseFloat(s.recent_avg) || 0);
        const mean = (scores.reduce((a: number, b: number) => a + b, 0) / scores.length).toFixed(1);
        const passing = scores.filter((s: number) => s >= 50).length;
        const atRisk = scores.filter((s: number) => s < 40).length;

        doc.fontSize(12).font("Helvetica-Bold").fillColor("#111827").text("Class Summary", { underline: false });
        doc.moveDown(0.4);

        const summaryLines = [
          ["Total Students", students.length.toString()],
          ["Class Mean", `${mean}%`],
          ["Predicted Pass Rate", `${((passing / students.length) * 100).toFixed(0)}%`],
          ["At Risk (< 40%)", atRisk.toString()],
        ];

        const colX = [40, 200, 310, 460];
        doc.fontSize(10).font("Helvetica");

        for (let i = 0; i < summaryLines.length; i++) {
          const col = Math.floor(i / 2);
          const row = i % 2;
          doc.fillColor("#6b7280").text(summaryLines[i][0], colX[col * 2], doc.y - (row === 1 ? 14 : 0));
          doc.fillColor("#111827").font("Helvetica-Bold")
            .text(summaryLines[i][1], colX[col * 2 + 1], doc.y - 14);
        }

        doc.moveDown(1.5);
        doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor("#e5e7eb").stroke();
        doc.moveDown(0.8);

        // Table header
        doc.fontSize(10).font("Helvetica-Bold").fillColor("#374151");
        const COL = { name: 40, code: 230, score: 310, risk: 400, trend: 470 };
        doc.text("Student", COL.name, doc.y);
        doc.text("Code", COL.code, doc.y - 13);
        doc.text("Pred. Score", COL.score, doc.y - 13);
        doc.text("Risk", COL.risk, doc.y - 13);
        doc.text("Exams", COL.trend, doc.y - 13);
        doc.moveDown(0.3);
        doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor("#d1d5db").stroke();
        doc.moveDown(0.3);

        // Table rows
        for (const s of students) {
          const score = parseFloat(s.recent_avg) || 0;
          const risk = score >= 60 ? "On Track" : score >= 40 ? "Borderline" : "At Risk";
          const riskColor = score >= 60 ? "#059669" : score >= 40 ? "#d97706" : "#dc2626";

          if (doc.y > 740) { doc.addPage(); }

          const rowY = doc.y;
          doc.fontSize(9).font("Helvetica").fillColor("#111827")
            .text(s.student_name?.slice(0, 28) ?? "", COL.name, rowY, { width: 180 });
          doc.fillColor("#6b7280").text(s.student_code ?? "", COL.code, rowY);
          doc.fillColor("#111827").font("Helvetica-Bold").text(`${score}%`, COL.score, rowY);
          doc.fillColor(riskColor).font("Helvetica").text(risk, COL.risk, rowY);
          doc.fillColor("#6b7280").text(String(s.exam_count ?? 0), COL.trend, rowY);
          doc.moveDown(0.8);
        }
      } else {
        doc.fontSize(11).fillColor("#6b7280").text("No student data available for the selected filter.", { align: "center" });
      }

      doc.moveDown(2);
      doc.fontSize(8).fillColor("#9ca3af")
        .text("This report is based on historical exam performance and is a statistical estimate only. It should not be used as a final assessment.", {
          align: "center",
          width: 480,
        });

      doc.end();
    } catch (err) {
      console.error("Grade forecast PDF error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to generate PDF" });
      }
    }
  },
);
