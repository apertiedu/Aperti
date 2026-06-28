import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, subjectsTable } from "@workspace/db";
import { requireTenantAccess } from "../middleware/tenant";
import { sql } from "drizzle-orm";
import { pool } from "@workspace/db";

async function writeSubjectAudit(
  accountId: number,
  action: string,
  resourceId: number | null,
  metadata?: Record<string, unknown>,
) {
  pool.query(
    `INSERT INTO audit_logs (account_id, action, resource, resource_id, details, severity, created_at)
     VALUES ($1,$2,'subject',$3,$4,'info',NOW())`,
    [accountId, action, resourceId ?? null, JSON.stringify(metadata ?? {})],
  ).catch(() => {});
}

const router: IRouter = Router();

// Idempotent migration for new subject fields
async function ensureSubjectColumns() {
  try {
    await db.execute(sql`
      ALTER TABLE subjects
        ADD COLUMN IF NOT EXISTS syllabus_codes text,
        ADD COLUMN IF NOT EXISTS papers_breakdown jsonb,
        ADD COLUMN IF NOT EXISTS pdf_url text,
        ADD COLUMN IF NOT EXISTS code_explainer text
    `);
  } catch (_) {}
}
ensureSubjectColumns();

router.get("/subjects", requireTenantAccess, async (req, res): Promise<void> => {
  const { teacherId, isAdmin } = req.tenant;
  const rows = !isAdmin && teacherId
    ? await db.execute(sql`SELECT * FROM subjects WHERE teacher_account_id = ${teacherId} ORDER BY name`)
    : await db.execute(sql`SELECT * FROM subjects ORDER BY name`);
  res.json(rows.rows ?? rows);
});

router.post("/subjects", requireTenantAccess, async (req, res): Promise<void> => {
  const { name, board, code, level, syllabusCodes, papersBreakdown, pdfUrl, codeExplainer } = req.body;
  if (!name?.trim()) { res.status(400).json({ message: "Subject name is required" }); return; }

  const { teacherId, isAdmin, accountId } = req.tenant;
  const effectiveTeacherId = isAdmin
    ? (req.body.teacherAccountId ? parseInt(req.body.teacherAccountId, 10) : accountId)
    : (teacherId ?? accountId);

  const insertResult = await db.execute(sql`
    INSERT INTO subjects (name, board, code, level, teacher_account_id, syllabus_codes, papers_breakdown, pdf_url, code_explainer)
    VALUES (
      ${name.trim()},
      ${board || "CAIE"},
      ${code || null},
      ${level || "IGCSE"},
      ${effectiveTeacherId},
      ${syllabusCodes || null},
      ${papersBreakdown ? JSON.stringify(papersBreakdown) : null},
      ${pdfUrl || null},
      ${codeExplainer || null}
    )
    RETURNING *
  `);
  const inserted = insertResult.rows[0] as any;
  writeSubjectAudit(accountId, "SUBJECT_CREATE", inserted?.id ?? null, { name: name.trim(), board, code, level });
  res.status(201).json(inserted);
});

router.patch("/subjects/:id", requireTenantAccess, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const { name, board, code, level, syllabusCodes, papersBreakdown, pdfUrl, codeExplainer } = req.body;
  if (!name?.trim()) { res.status(400).json({ message: "Name required" }); return; }

  const updateResult = await db.execute(sql`
    UPDATE subjects SET
      name = ${name.trim()},
      board = ${board || "CAIE"},
      code = ${code || null},
      level = ${level || "IGCSE"},
      syllabus_codes = ${syllabusCodes || null},
      papers_breakdown = ${papersBreakdown ? JSON.stringify(papersBreakdown) : null},
      pdf_url = ${pdfUrl || null},
      code_explainer = ${codeExplainer || null}
    WHERE id = ${id}
    RETURNING *
  `);
  if (!updateResult.rows.length) { res.status(404).json({ message: "Subject not found" }); return; }
  writeSubjectAudit(accountId, "SUBJECT_UPDATE", id, { name: name.trim() });
  res.json(updateResult.rows[0]);
});

router.delete("/subjects/:id", requireTenantAccess, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const { teacherId, isAdmin } = req.tenant;
  const condition = isAdmin
    ? eq(subjectsTable.id, id)
    : and(eq(subjectsTable.id, id), eq(subjectsTable.teacherAccountId, teacherId!));
  const result = await db.delete(subjectsTable).where(condition!).returning();
  if (!result.length) { res.status(403).json({ error: "Not found or access denied" }); return; }
  writeSubjectAudit(accountId, "SUBJECT_DELETE", id, { severity: "warn" });
  res.json({ message: "Subject deleted" });
});

export default router;
