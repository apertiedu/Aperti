/**
 * Phase 4 additions:
 *   GET  /api/parent/child/:studentId/report-pdf   → PDF download
 *   GET  /api/parent/family-calendar               → merged family events
 *   GET  /api/parent/documents                     → document list
 *   POST /api/parent/documents                     → save document record
 */
import { Router, Response } from "express";
import { authenticate, AuthRequest, requireRole } from "../middleware/auth";
import { pool } from "@workspace/db";
import PDFDocument from "pdfkit";

export const parentPhase4Router = Router();

const authParent = [authenticate, requireRole("parent")];

async function isLinked(parentId: number, studentId: number): Promise<boolean> {
  const { rows } = await pool.query(
    "SELECT id FROM guardian_links WHERE parent_account_id=$1 AND student_id=$2 AND status='active'",
    [parentId, studentId]
  );
  return rows.length > 0;
}

// ─── GET /api/parent/child/:studentId/report-pdf ──────────────────────────
parentPhase4Router.get(
  "/parent/child/:studentId/report-pdf",
  ...authParent,
  async (req: AuthRequest, res: Response) => {
    try {
      const sid = parseInt(req.params.studentId);
      if (!(await isLinked(req.userId!, sid))) {
        return res.status(403).json({ error: "Not linked" });
      }

      // ── Fetch all data in parallel ────────────────────────────────────────
      const [studentRes, attRes, gradesRes, assignRes, hwFbRes, nextExamRes, achievementsRes] =
        await Promise.all([
          pool.query(
            `SELECT s.student_name, a.display_name, a.email, s.student_code
             FROM students s LEFT JOIN accounts a ON a.id=s.account_id WHERE s.id=$1`,
            [sid]
          ),
          pool.query(
            `SELECT COUNT(*) AS total,
                    SUM(CASE WHEN LOWER(status)='present' THEN 1 ELSE 0 END) AS present,
                    SUM(CASE WHEN LOWER(status)='absent'  THEN 1 ELSE 0 END) AS absent
             FROM attendance WHERE student_id=$1`,
            [sid]
          ),
          pool.query(
            `SELECT sub.subject_name,
                    ROUND(AVG(sm.marks_scored::float / NULLIF(eq.marks,0)*100),1) AS avg_pct
             FROM student_marks sm
             JOIN exam_questions eq ON eq.id=sm.question_id
             JOIN exams e ON e.id=eq.exam_id
             LEFT JOIN subjects sub ON e.subject_id=sub.id
             WHERE sm.student_id=$1
             GROUP BY sub.subject_name ORDER BY avg_pct DESC`,
            [sid]
          ),
          pool.query(
            `SELECT h.title, h.due_date, sub.subject_name
             FROM homework h
             LEFT JOIN subjects sub ON h.subject_id=sub.id
             LEFT JOIN homework_submissions hs ON hs.homework_id=h.id AND hs.student_id=$1
             WHERE h.due_date >= NOW() AND (hs.status IS NULL OR hs.status NOT IN ('submitted','graded'))
             ORDER BY h.due_date ASC LIMIT 5`,
            [sid]
          ),
          pool.query(
            `SELECT h.title, sub.subject_name, hs.marks_awarded, h.total_marks, hs.teacher_feedback
             FROM homework_submissions hs
             JOIN homework h ON h.id=hs.homework_id
             LEFT JOIN subjects sub ON h.subject_id=sub.id
             WHERE hs.student_id=$1 AND hs.status='graded' AND hs.teacher_feedback IS NOT NULL
             ORDER BY hs.graded_at DESC LIMIT 5`,
            [sid]
          ),
          pool.query(
            `SELECT e.title, e.date, sub.subject_name FROM exams e
             LEFT JOIN subjects sub ON e.subject_id=sub.id
             WHERE e.date > NOW() ORDER BY e.date ASC LIMIT 1`
          ),
          pool.query(
            `SELECT badge_name, awarded_at FROM student_badges WHERE student_id=$1 ORDER BY awarded_at DESC LIMIT 5`,
            [sid]
          ).catch(() => ({ rows: [] })),
        ]);

      const student = studentRes.rows[0];
      const name = student?.display_name || student?.student_name || "Student";
      const code = student?.student_code || "";
      const total = parseInt(attRes.rows[0]?.total || "0");
      const present = parseInt(attRes.rows[0]?.present || "0");
      const absent = parseInt(attRes.rows[0]?.absent || "0");
      const attRate = total > 0 ? Math.round((present / total) * 100) : 0;

      // ── Build PDF ─────────────────────────────────────────────────────────
      const doc = new PDFDocument({ margin: 50, size: "A4" });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="aperti-report-${code || sid}-${new Date().toISOString().split("T")[0]}.pdf"`
      );
      doc.pipe(res);

      const TEAL_R = 13, TEAL_G = 148, TEAL_B = 136;
      const pageWidth = doc.page.width - 100; // margins

      // ── Header band ───────────────────────────────────────────────────────
      doc.rect(0, 0, doc.page.width, 80).fill(`rgb(${TEAL_R},${TEAL_G},${TEAL_B})`);
      doc.fillColor("white").fontSize(22).font("Helvetica-Bold").text("Aperti.", 50, 22);
      doc.fontSize(10).font("Helvetica").text("Student Progress Report", 50, 50);
      doc.text(`Generated: ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`, 350, 50, { align: "right", width: 200 });

      doc.fillColor("#1f2937");
      let y = 100;

      // ── Student info ──────────────────────────────────────────────────────
      doc.fontSize(16).font("Helvetica-Bold").text(name, 50, y);
      y += 22;
      doc.fontSize(9).font("Helvetica").fillColor("#6b7280").text(`Student Code: ${code}  |  ${student?.email || ""}`, 50, y);
      y += 30;

      // divider
      doc.moveTo(50, y).lineTo(545, y).strokeColor("#e5e7eb").lineWidth(1).stroke();
      y += 20;

      // ── Attendance section ────────────────────────────────────────────────
      doc.fontSize(12).font("Helvetica-Bold").fillColor("#1f2937").text("Attendance", 50, y);
      y += 18;
      doc.fontSize(10).font("Helvetica").fillColor("#374151");
      doc.text(`Overall Rate: ${attRate}%  |  Present: ${present}  |  Absent: ${absent}  |  Total Sessions: ${total}`, 50, y);
      y += 12;
      // mini progress bar
      const barWidth = Math.min(pageWidth, 400);
      doc.rect(50, y, barWidth, 8).fillColor("#f3f4f6").fill();
      doc.rect(50, y, (attRate / 100) * barWidth, 8).fillColor(`rgb(${TEAL_R},${TEAL_G},${TEAL_B})`).fill();
      y += 25;

      // ── Grades per subject ────────────────────────────────────────────────
      if (gradesRes.rows.length > 0) {
        doc.fontSize(12).font("Helvetica-Bold").fillColor("#1f2937").text("Grades by Subject", 50, y);
        y += 18;
        doc.fontSize(9).font("Helvetica-Bold").fillColor("#6b7280");
        doc.text("Subject", 50, y, { width: 200 });
        doc.text("Average Score", 300, y, { width: 100 });
        doc.text("Grade", 440, y, { width: 60 });
        y += 14;
        doc.moveTo(50, y).lineTo(545, y).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
        y += 8;

        gradesRes.rows.forEach((g: any, i: number) => {
          const pct = parseFloat(g.avg_pct || "0");
          const grade = pct >= 90 ? "A*" : pct >= 80 ? "A" : pct >= 70 ? "B" : pct >= 60 ? "C" : pct >= 50 ? "D" : "E";
          const colour = pct >= 70 ? `rgb(${TEAL_R},${TEAL_G},${TEAL_B})` : pct >= 50 ? "#d97706" : "#dc2626";

          if (i % 2 === 0) doc.rect(50, y - 3, 495, 18).fillColor("#f9fafb").fill();
          doc.fillColor("#1f2937").fontSize(9).font("Helvetica").text(g.subject_name || "General", 50, y, { width: 200 });
          doc.text(`${pct.toFixed(1)}%`, 300, y, { width: 100 });
          doc.fillColor(colour).font("Helvetica-Bold").text(grade, 440, y, { width: 60 });
          doc.fillColor("#1f2937");
          y += 18;
        });
        y += 10;
      }

      // ── Upcoming assignments ──────────────────────────────────────────────
      if (assignRes.rows.length > 0 && y < 680) {
        doc.fontSize(12).font("Helvetica-Bold").fillColor("#1f2937").text("Upcoming Assignments", 50, y);
        y += 18;
        assignRes.rows.forEach((hw: any) => {
          doc.fontSize(9).font("Helvetica").fillColor("#374151");
          doc.text(
            `• ${hw.title}  (${hw.subject_name || "General"})  —  Due ${new Date(hw.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
            55, y
          );
          y += 15;
        });
        y += 8;
      }

      // ── Teacher feedback ──────────────────────────────────────────────────
      if (hwFbRes.rows.length > 0 && y < 660) {
        doc.fontSize(12).font("Helvetica-Bold").fillColor("#1f2937").text("Recent Teacher Feedback", 50, y);
        y += 18;
        hwFbRes.rows.forEach((fb: any) => {
          if (y > 720) return; // avoid overflow
          doc.fontSize(9).font("Helvetica-Bold").fillColor("#374151").text(`${fb.title} (${fb.subject_name || "General"}):`, 55, y);
          y += 13;
          doc.fontSize(9).font("Helvetica-Oblique").fillColor("#6b7280")
            .text(`"${fb.teacher_feedback}"`, 65, y, { width: 470 });
          y += doc.heightOfString(fb.teacher_feedback, { width: 470 }) + 6;
        });
        y += 5;
      }

      // ── Footer ────────────────────────────────────────────────────────────
      doc.moveTo(50, 780).lineTo(545, 780).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
      doc.fontSize(8).font("Helvetica").fillColor("#9ca3af")
        .text("Aperti Educational Platform  |  Confidential student progress report  |  Not for redistribution", 50, 790, { align: "center", width: pageWidth });

      doc.end();

      // ── Auto-save document record ─────────────────────────────────────────
      pool.query(
        `INSERT INTO documents (parent_id, student_id, title, type, file_url, created_at)
         VALUES ($1,$2,$3,'report',NULL,NOW())`,
        [req.userId, sid, `Progress Report — ${name} — ${new Date().toLocaleDateString("en-GB")}`]
      ).catch(() => {});

    } catch (err: any) {
      console.error("[report-pdf]", err);
      if (!res.headersSent) res.status(500).json({ error: err.message });
    }
  }
);

// ─── GET /api/parent/family-calendar ─────────────────────────────────────
parentPhase4Router.get(
  "/parent/family-calendar",
  ...authParent,
  async (req: AuthRequest, res: Response) => {
    try {
      const { rows: links } = await pool.query(
        `SELECT gl.student_id, s.student_name, a.display_name
         FROM guardian_links gl
         JOIN students s ON s.id=gl.student_id
         LEFT JOIN accounts a ON a.id=s.account_id
         WHERE gl.parent_account_id=$1 AND gl.status='active'`,
        [req.userId]
      );

      if (!links.length) return res.json([]);

      const CHILD_COLOURS = ["#0D9488","#6366f1","#f59e0b","#ef4444","#8b5cf6","#10b981"];

      const events: any[] = [];

      await Promise.all(
        links.map(async (link, idx) => {
          const sid = link.student_id;
          const childName = link.display_name || link.student_name;
          const colour = CHILD_COLOURS[idx % CHILD_COLOURS.length];

          // Homework deadlines
          const { rows: hw } = await pool.query(
            `SELECT h.id, h.title, h.due_date, sub.subject_name
             FROM homework h
             LEFT JOIN subjects sub ON h.subject_id=sub.id
             LEFT JOIN homework_submissions hs ON hs.homework_id=h.id AND hs.student_id=$1
             WHERE h.due_date >= NOW()-INTERVAL '7 days'
               AND (hs.status IS NULL OR hs.status NOT IN ('submitted','graded'))`,
            [sid]
          );
          hw.forEach(h => events.push({
            id: `hw-${h.id}`,
            title: `📚 ${h.title}`,
            start: h.due_date,
            end: h.due_date,
            type: "homework",
            childName,
            childId: sid,
            colour,
            detail: h.subject_name,
          }));

          // Exam dates
          const { rows: exams } = await pool.query(
            `SELECT e.id, e.title, e.date, sub.subject_name
             FROM exams e
             LEFT JOIN subjects sub ON e.subject_id=sub.id
             WHERE e.date >= NOW()-INTERVAL '7 days'
             ORDER BY e.date ASC LIMIT 20`
          );
          exams.forEach(e => events.push({
            id: `exam-${e.id}-${sid}`,
            title: `📝 ${e.title}`,
            start: e.date,
            end: e.date,
            type: "exam",
            childName,
            childId: sid,
            colour,
            detail: e.subject_name,
          }));

          // Lessons / classes (from sessions via timetable)
          const { rows: lessons } = await pool.query(
            `SELECT ses.id, ses.session_name, ses.session_time, sub.subject_name,
                    tt.day_of_week
             FROM sessions ses
             LEFT JOIN subjects sub ON ses.subject_id=sub.id
             LEFT JOIN timetables tt ON tt.session_id=ses.id
             WHERE ses.id IN (
               SELECT unnest(ARRAY[lesson1_session_id,lesson2_session_id,lesson3_session_id])
               FROM students WHERE id=$1
             ) AND ses.id IS NOT NULL LIMIT 20`,
            [sid]
          );
          const dayMap: Record<string, number> = { Monday:1, Tuesday:2, Wednesday:3, Thursday:4, Friday:5, Saturday:6, Sunday:0 };
          lessons.forEach(l => {
            // Generate next 4 occurrences of this weekday
            for (let w = 0; w < 4; w++) {
              const now = new Date();
              const dow = dayMap[l.day_of_week] ?? 1;
              const today = now.getDay();
              let diff = dow - today;
              if (diff < 0 || (diff === 0 && w === 0)) diff += 7;
              const d = new Date(now);
              d.setDate(d.getDate() + diff + w * 7);
              d.setHours(0,0,0,0);
              events.push({
                id: `class-${l.id}-${sid}-w${w}`,
                title: `🎓 ${l.subject_name || l.session_name}`,
                start: d.toISOString(),
                end: d.toISOString(),
                type: "class",
                childName,
                childId: sid,
                colour,
                detail: l.session_time || "",
              });
            }
          });
        })
      );

      // Parent-teacher meetings
      const { rows: meetings } = await pool.query(
        `SELECT m.*, a.display_name AS teacher_name
         FROM meetings m LEFT JOIN accounts a ON a.id=m.teacher_id
         WHERE m.parent_id=$1 AND m.status != 'canceled'
         ORDER BY m.date ASC`,
        [req.userId]
      );
      meetings.forEach(m => events.push({
        id: `meeting-${m.id}`,
        title: `🤝 ${m.title}`,
        start: `${m.date}T${m.time}:00`,
        end: `${m.date}T${m.time}:00`,
        type: "meeting",
        childName: null,
        childId: null,
        colour: "#64748b",
        detail: `with ${m.teacher_name}`,
      }));

      res.json(events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ─── GET /api/parent/documents ────────────────────────────────────────────
parentPhase4Router.get(
  "/parent/documents",
  ...authParent,
  async (req: AuthRequest, res: Response) => {
    try {
      const { rows } = await pool.query(
        `SELECT d.*, s.student_name, a.display_name AS student_display_name
         FROM documents d
         LEFT JOIN students s ON s.id=d.student_id
         LEFT JOIN accounts a ON a.id=s.account_id
         WHERE d.parent_id=$1
         ORDER BY d.created_at DESC`,
        [req.userId]
      );
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ─── POST /api/parent/documents ───────────────────────────────────────────
parentPhase4Router.post(
  "/parent/documents",
  ...authParent,
  async (req: AuthRequest, res: Response) => {
    try {
      const { studentId, title, type, fileUrl } = req.body;
      const { rows } = await pool.query(
        `INSERT INTO documents (parent_id, student_id, title, type, file_url, created_at)
         VALUES ($1,$2,$3,$4,$5,NOW()) RETURNING *`,
        [req.userId, studentId || null, title, type || "report", fileUrl || null]
      );
      res.status(201).json(rows[0]);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);
