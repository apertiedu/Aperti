import { Router, Response } from "express";
import { db } from "@workspace/db";
import { authenticate, AuthRequest } from "../middleware/auth";
import { studentsTable, accountsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { enforceLimit, incrementUsage, decrementUsage } from "../middleware/enforce-limit";

export const studentsRouter = Router();

studentsRouter.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  const teacherId = req.userId!;
  const role = req.role!;
  const students = role === "admin"
    ? await db.select().from(studentsTable)
    : await db.select().from(studentsTable).where(eq(studentsTable.teacherAccountId, teacherId));
  res.json(students);
});

studentsRouter.post("/bulk", authenticate, enforceLimit("students"), async (req: AuthRequest, res: Response) => {
  const teacherId = req.userId!;
  const { students } = req.body as { students: Array<{ studentName: string; studentCode: string }> };
  if (!Array.isArray(students) || students.length === 0) {
    return res.status(400).json({ error: "students array required" });
  }
  const rows = students.map(s => ({
    studentName: s.studentName,
    studentCode: s.studentCode.trim().toUpperCase(),
    teacherAccountId: teacherId,
  }));
  try {
    const inserted = await db.insert(studentsTable).values(rows).returning();
    await incrementUsage(teacherId, "students", inserted.length);
    res.json(inserted);
  } catch (err: any) {
    if (err.code === "23505" || err.message?.includes("unique")) {
      return res.status(409).json({ error: "One or more student codes already exist. Student codes must be unique across the entire platform." });
    }
    return res.status(500).json({ error: err.message });
  }
});

studentsRouter.post("/", authenticate, enforceLimit("students"), async (req: AuthRequest, res: Response) => {
  const teacherId = req.userId!;
  const { studentName, studentCode, lesson1SessionId, lesson2SessionId, lesson3SessionId } = req.body;
  if (!studentName || !studentCode) return res.status(400).json({ error: "studentName and studentCode required" });
  try {
    const [student] = await db.insert(studentsTable).values({
      studentName,
      studentCode: studentCode.trim().toUpperCase(),
      teacherAccountId: teacherId,
      lesson1SessionId: lesson1SessionId || null,
      lesson2SessionId: lesson2SessionId || null,
      lesson3SessionId: lesson3SessionId || null,
    }).returning();
    await incrementUsage(teacherId, "students");
    res.status(201).json(student);
  } catch (err: any) {
    if (err.code === "23505" || err.message?.includes("unique")) {
      return res.status(409).json({ error: `Student code "${studentCode}" is already taken. Student codes must be unique across the entire platform.` });
    }
    return res.status(500).json({ error: err.message });
  }
});

// GET /students/pending — teacher sees pending student account registrations
studentsRouter.get("/pending", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const teacherId = req.userId!;
    const role = req.role!;
    const { pool } = await import("@workspace/db");
    let query = `SELECT id, username, display_name, email, status, created_at, role
                 FROM accounts WHERE role='student' AND status='pending'`;
    const params: any[] = [];
    if (role !== "admin") {
      params.push(teacherId);
      query += ` AND teacher_account_id=$${params.length}`;
    }
    query += " ORDER BY created_at DESC";
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /students/:id/approve — approve a pending student
studentsRouter.put("/:id/approve", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { pool } = await import("@workspace/db");
    const id = parseInt(req.params.id);
    const teacherId = req.userId!;
    const role = req.role!;
    let query = `UPDATE accounts SET status='active' WHERE id=$1 AND role='student' AND status='pending'`;
    const params: any[] = [id];
    if (role !== "admin") {
      params.push(teacherId);
      query += ` AND teacher_account_id=$${params.length}`;
    }
    const { rowCount } = await pool.query(query, params);
    if (!rowCount) return res.status(404).json({ error: "Student not found or not authorized" });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /students/:id/reject — reject a pending student
studentsRouter.put("/:id/reject", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { pool } = await import("@workspace/db");
    const id = parseInt(req.params.id);
    const teacherId = req.userId!;
    const role = req.role!;
    let query = `UPDATE accounts SET status='rejected' WHERE id=$1 AND role='student' AND status='pending'`;
    const params: any[] = [id];
    if (role !== "admin") {
      params.push(teacherId);
      query += ` AND teacher_account_id=$${params.length}`;
    }
    const { rowCount } = await pool.query(query, params);
    if (!rowCount) return res.status(404).json({ error: "Student not found or not authorized" });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

studentsRouter.patch("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const { studentName, studentCode, lesson1SessionId, lesson2SessionId, lesson3SessionId } = req.body;
  const [updated] = await db.update(studentsTable)
    .set({
      ...(studentName !== undefined && { studentName }),
      ...(studentCode !== undefined && { studentCode }),
      ...(lesson1SessionId !== undefined && { lesson1SessionId: lesson1SessionId || null }),
      ...(lesson2SessionId !== undefined && { lesson2SessionId: lesson2SessionId || null }),
      ...(lesson3SessionId !== undefined && { lesson3SessionId: lesson3SessionId || null }),
    })
    .where(eq(studentsTable.id, id))
    .returning();
  if (!updated) return res.status(404).json({ error: "Student not found" });
  res.json(updated);
});

studentsRouter.delete("/:id", authenticate, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  await db.delete(studentsTable).where(eq(studentsTable.id, id));
  res.json({ success: true });
});

studentsRouter.post("/:id/create-account", authenticate, async (req: AuthRequest, res: Response) => {
  const studentId = Number(req.params.id);
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: "password required" });

  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, studentId)).limit(1);
  if (!student) return res.status(404).json({ error: "Student not found" });

  const username = student.studentCode.toLowerCase();
  const hash = await bcrypt.hash(password, 12);
  const [account] = await db.insert(accountsTable).values({
    username,
    passwordHash: hash,
    displayName: student.studentName,
    role: "student",
    status: "active",
  }).returning();

  await db.update(studentsTable).set({ accountId: account.id }).where(eq(studentsTable.id, studentId));
  res.json({ success: true, accountId: account.id, username });
});

studentsRouter.get("/:id/id-card", authenticate, async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, id)).limit(1);
  if (!student) return res.status(404).json({ error: "Student not found" });
  const html = `<!DOCTYPE html>
<html><head><title>Student ID Card — ${student.studentName}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Inter',system-ui,sans-serif;background:#f0fdfa;display:flex;align-items:center;justify-content:center;min-height:100vh;}
.card{width:340px;background:white;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.15);}
.header{background:linear-gradient(135deg,#0D9488 0%,#0f766e 100%);padding:24px;color:white;text-align:center;}
.header h2{font-size:22px;font-weight:800;letter-spacing:-0.5px;}
.header p{font-size:11px;opacity:0.8;margin-top:2px;text-transform:uppercase;letter-spacing:2px;}
.body{padding:24px;display:flex;flex-direction:column;align-items:center;gap:16px;}
.info{text-align:center;width:100%;}
.name{font-size:20px;font-weight:700;color:#0f172a;}
.code{font-size:14px;color:#0D9488;font-weight:600;font-family:monospace;margin-top:4px;}
.footer{background:#f8fafc;border-top:1px solid #e2e8f0;padding:12px;text-align:center;}
.footer p{font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;}
@media print{body{background:white;}.card{box-shadow:none;}}
</style></head><body>
<div class="card">
<div class="header"><h2>Aperti.</h2><p>Student Identification Card</p></div>
<div class="body">
<div class="info"><p class="name">${student.studentName}</p><p class="code">ID: ${student.studentCode}</p></div>
</div>
<div class="footer"><p>Aperti Educational Platform</p></div>
</div>
</body></html>`;
  res.setHeader("Content-Type", "text/html");
  res.send(html);
});
