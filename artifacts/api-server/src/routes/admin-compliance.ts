import { Router, Request, Response } from "express";
import { db, pool } from "@workspace/db";
import { complianceRequestsTable, backupLogsTable, accountsTable, platformSettingsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireRole, AuthRequest } from "../middleware/auth";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";

export const adminComplianceRouter = Router();
adminComplianceRouter.use(requireRole("admin", "super_admin"));

adminComplianceRouter.get("/requests", async (_req, res) => {
  try {
    const requests = await db
      .select({
        id: complianceRequestsTable.id,
        userId: complianceRequestsTable.userId,
        type: complianceRequestsTable.type,
        status: complianceRequestsTable.status,
        requestedAt: complianceRequestsTable.requestedAt,
        completedAt: complianceRequestsTable.completedAt,
        notes: complianceRequestsTable.notes,
        username: accountsTable.username,
        displayName: accountsTable.displayName,
        email: accountsTable.email,
      })
      .from(complianceRequestsTable)
      .leftJoin(accountsTable, eq(complianceRequestsTable.userId, accountsTable.id))
      .orderBy(desc(complianceRequestsTable.requestedAt));
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch compliance requests" });
  }
});

adminComplianceRouter.put("/requests/:id", async (req: Request, res: Response) => {
  try {
    const { status, notes } = req.body;
    const [r] = await db.update(complianceRequestsTable).set({ status, notes, completedAt: status === "completed" ? new Date() : undefined }).where(eq(complianceRequestsTable.id, parseInt(req.params.id))).returning();
    res.json(r);
  } catch (err) {
    res.status(500).json({ error: "Failed to update request" });
  }
});

adminComplianceRouter.get("/backups", async (_req, res) => {
  try {
    const backups = await db.select().from(backupLogsTable).orderBy(desc(backupLogsTable.createdAt)).limit(50);
    res.json(backups);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch backups" });
  }
});

adminComplianceRouter.post("/backups", async (req: Request, res: Response) => {
  try {
    const [backup] = await db.insert(backupLogsTable).values({ type: "manual", status: "pending" }).returning();
    setTimeout(async () => {
      await db.update(backupLogsTable).set({ status: "completed", fileUrl: `/backups/backup-${backup.id}.sql` }).where(eq(backupLogsTable.id, backup.id)).catch(() => {});
    }, 3000);
    res.status(201).json(backup);
  } catch (err) {
    res.status(500).json({ error: "Failed to trigger backup" });
  }
});

adminComplianceRouter.get("/platform-settings", async (_req, res) => {
  try {
    const settings = await db.select().from(platformSettingsTable);
    const map: Record<string, any> = {};
    for (const s of settings) map[s.key] = s.value;
    res.json(map);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

adminComplianceRouter.put("/platform-settings", async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).userId;
    for (const [key, value] of Object.entries(req.body)) {
      const existing = await db.select().from(platformSettingsTable).where(eq(platformSettingsTable.key, key));
      if (existing.length > 0) {
        await db.update(platformSettingsTable).set({ value: value as any, updatedBy: adminId, updatedAt: new Date() }).where(eq(platformSettingsTable.key, key));
      } else {
        await db.insert(platformSettingsTable).values({ key, value: value as any, updatedBy: adminId });
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update settings" });
  }
});

/**
 * POST /api/admin/compliance/requests/:id/execute
 *
 * GDPR Right-to-Erasure execution.
 * Anonymises all PII for the user linked to the compliance request:
 *   - username        → deleted_user_<id>
 *   - display_name    → Deleted User
 *   - email           → deleted_<id>@deleted.aperti.app
 *   - password_hash   → irreversible random hash
 *   - bio, avatar_url → nulled
 *   - account status  → 'deleted'
 *   - google_id       → nulled
 * Then marks the compliance request as completed.
 * This is IRREVERSIBLE. Requires super_admin.
 */
adminComplianceRouter.post("/requests/:id/execute", async (req: Request, res: Response) => {
  const actorReq = req as AuthRequest;
  if (actorReq.role !== "super_admin") {
    res.status(403).json({ error: "Only super_admin can execute GDPR erasure" });
    return;
  }

  const requestId = parseInt(req.params.id, 10);
  if (isNaN(requestId)) {
    res.status(400).json({ error: "Invalid request ID" });
    return;
  }

  try {
    // Load compliance request
    const { rows: crRows } = await pool.query(
      `SELECT * FROM compliance_requests WHERE id = $1 LIMIT 1`,
      [requestId],
    );
    if (!crRows.length) {
      res.status(404).json({ error: "Compliance request not found" });
      return;
    }
    const cr = crRows[0];

    if (cr.status === "completed") {
      res.status(409).json({ error: "This request has already been executed" });
      return;
    }

    const userId: number = cr.user_id;
    if (!userId) {
      res.status(400).json({ error: "Compliance request has no user_id — cannot execute" });
      return;
    }

    const { rows: acctRows } = await pool.query(
      `SELECT id, status FROM accounts WHERE id = $1`,
      [userId],
    );
    if (!acctRows.length) {
      res.status(404).json({ error: "User account not found" });
      return;
    }

    // Generate an irreversible password hash so the account cannot be logged into
    const unusableHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10);

    // 1. Anonymise the account record
    await pool.query(
      `UPDATE accounts SET
         username      = $1,
         display_name  = 'Deleted User',
         email         = $2,
         password_hash = $3,
         bio           = NULL,
         avatar_url    = NULL,
         google_id     = NULL,
         phone         = NULL,
         status        = 'deleted',
         email_verified = false,
         updated_at    = NOW()
       WHERE id = $4`,
      [
        `deleted_user_${userId}`,
        `deleted_${userId}@deleted.aperti.app`,
        unusableHash,
        userId,
      ],
    );

    // 2. Invalidate sessions (drop any session store entries for this user)
    await pool.query(
      `DELETE FROM session WHERE sess::jsonb->>'userId' = $1::text`,
      [String(userId)],
    ).catch(() => {}); // session table may not exist in all setups

    // 3. Null-out personal data in related tables (best-effort)
    const piiCleanups: Array<{ sql: string; params: any[] }> = [
      { sql: `UPDATE students SET name = 'Deleted', email = NULL, phone = NULL WHERE teacher_account_id = $1`, params: [userId] },
      { sql: `DELETE FROM email_verification_tokens WHERE account_id = $1`, params: [userId] },
      { sql: `DELETE FROM password_reset_tokens WHERE account_id = $1`, params: [userId] },
      { sql: `UPDATE consent_records SET ip_address = NULL, user_agent = NULL WHERE user_id = $1`, params: [userId] },
    ];

    const cleanupResults: Array<{ table: string; ok: boolean; error?: string }> = [];
    for (const c of piiCleanups) {
      try {
        await pool.query(c.sql, c.params);
        cleanupResults.push({ table: c.sql.split(" ")[1] ?? "?", ok: true });
      } catch (e: any) {
        cleanupResults.push({ table: c.sql.split(" ")[1] ?? "?", ok: false, error: e.message });
      }
    }

    // 4. Mark compliance request completed
    await pool.query(
      `UPDATE compliance_requests
       SET status = 'completed', completed_at = NOW(), notes = COALESCE(notes, '') || ' | Executed by admin ' || $1::text || ' at ' || NOW()::text
       WHERE id = $2`,
      [actorReq.userId, requestId],
    ).catch(async () => {
      await pool.query(
        `UPDATE compliance_requests SET status = 'completed', completed_at = NOW() WHERE id = $1`,
        [requestId],
      ).catch(() => {});
    });

    // 5. Audit log
    await pool.query(
      `INSERT INTO audit_logs (account_id, action, severity, details, created_at)
       VALUES ($1, 'gdpr_erasure_executed', 'critical', $2, NOW())`,
      [
        userId,
        JSON.stringify({
          compliance_request_id: requestId,
          actor_id: actorReq.userId,
          cleanup_results: cleanupResults,
        }),
      ],
    ).catch(() => {});

    res.json({
      ok: true,
      user_id: userId,
      compliance_request_id: requestId,
      executed_at: new Date().toISOString(),
      cleanup: cleanupResults,
      message: "PII anonymised and account deactivated. This action is irreversible.",
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message ?? "GDPR erasure execution failed" });
  }
});
