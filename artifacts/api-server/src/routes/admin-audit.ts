import { Router, Request, Response } from "express";
import { pool, db } from "@workspace/db";
import { auditLogsTable, accountsTable } from "@workspace/db";
import { eq, desc, ilike, and, gte, lte, sql } from "drizzle-orm";
import { requireRole } from "../middleware/auth";

export const adminAuditRouter = Router();
adminAuditRouter.use(requireRole("admin", "super_admin"));

const SEVERITY_COLORS: Record<string, string> = {
  info: "bg-blue-50 text-blue-700",
  warning: "bg-amber-50 text-amber-700",
  error: "bg-red-50 text-red-700",
  critical: "bg-red-100 text-red-800",
};

adminAuditRouter.get("/", async (req: Request, res: Response) => {
  try {
    const { search, from, to, severity, action, page = "1", limit = "100" } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const conditions: any[] = [];
    if (search) conditions.push(ilike(auditLogsTable.action, `%${search}%`));
    if (action) conditions.push(sql`${auditLogsTable.action} = ${action}`);
    if (from) conditions.push(gte(auditLogsTable.createdAt, new Date(from)));
    if (to) conditions.push(lte(auditLogsTable.createdAt, new Date(to)));
    if (severity) conditions.push(sql`${auditLogsTable.severity} = ${severity}`);
    const where = conditions.length ? and(...conditions) : undefined;

    const [logs, cnt] = await Promise.all([
      db.select({
        id: auditLogsTable.id,
        accountId: auditLogsTable.accountId,
        action: auditLogsTable.action,
        resource: auditLogsTable.resource,
        resourceId: auditLogsTable.resourceId,
        details: auditLogsTable.details,
        ipAddress: auditLogsTable.ipAddress,
        severity: auditLogsTable.severity,
        userAgent: auditLogsTable.userAgent,
        createdAt: auditLogsTable.createdAt,
        username: accountsTable.username,
        displayName: accountsTable.displayName,
      })
        .from(auditLogsTable)
        .leftJoin(accountsTable, eq(auditLogsTable.accountId, accountsTable.id))
        .where(where)
        .orderBy(desc(auditLogsTable.createdAt))
        .limit(parseInt(limit))
        .offset(offset),
      db.select({ c: sql<number>`count(*)::int` }).from(auditLogsTable).where(where),
    ]);

    res.json({ logs, total: cnt[0].c });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

adminAuditRouter.get("/stats", async (_req, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        severity,
        count(*)::int AS count
      FROM audit_logs
      WHERE created_at > now() - interval '30 days'
      GROUP BY severity
    `);
    const totals: Record<string, number> = {};
    for (const r of rows) totals[r.severity] = r.count;
    res.json(totals);
  } catch {
    res.json({});
  }
});

adminAuditRouter.get("/export", async (_req: Request, res: Response) => {
  try {
    const logs = await db.select().from(auditLogsTable).orderBy(desc(auditLogsTable.createdAt)).limit(5000);
    const header = "id,accountId,action,resource,resourceId,severity,ipAddress,createdAt\n";
    const rows = logs.map(l =>
      `${l.id},${l.accountId || ""},${l.action},${l.resource},${l.resourceId || ""},${l.severity || "info"},${l.ipAddress || ""},${l.createdAt}`
    ).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=audit-logs.csv");
    res.send(header + rows);
  } catch (err) {
    res.status(500).json({ error: "Export failed" });
  }
});
