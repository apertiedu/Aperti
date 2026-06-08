import { Router, Request, Response } from "express";
import { pool, db } from "@workspace/db";
import { systemHealthLogsTable } from "@workspace/db";
import { desc, sql } from "drizzle-orm";
import { requireRole } from "../middleware/auth";
import os from "os";

export const adminHealthRouter = Router();
adminHealthRouter.use(requireRole("admin", "super_admin"));

adminHealthRouter.get("/", async (_req, res) => {
  try {
    const start = Date.now();
    await pool.query("SELECT 1");
    const dbLatency = Date.now() - start;

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMemPct = Math.round(((totalMem - freeMem) / totalMem) * 100);
    const loadAvg = os.loadavg()[0];
    const cpuCount = os.cpus().length;
    const cpuPct = Math.min(Math.round((loadAvg / cpuCount) * 100), 100);

    const dbPool = await pool.query(`
      SELECT count(*) as total, 
             sum(case when state='active' then 1 else 0 end) as active
      FROM pg_stat_activity WHERE datname = current_database()
    `).catch(() => ({ rows: [{ total: 0, active: 0 }] }));

    const uptime = process.uptime();

    const metrics = {
      apiLatency: dbLatency,
      dbLatency,
      dbConnections: { total: parseInt(dbPool.rows[0].total), active: parseInt(dbPool.rows[0].active) },
      memory: { used: Math.round((totalMem - freeMem) / 1024 / 1024), total: Math.round(totalMem / 1024 / 1024), percent: usedMemPct },
      cpu: { percent: cpuPct, loadAvg },
      uptime: Math.round(uptime),
      status: dbLatency < 200 ? "healthy" : dbLatency < 500 ? "degraded" : "critical",
      timestamp: new Date().toISOString(),
    };

    await db.insert(systemHealthLogsTable).values({ service: "api", metric: "latency", value: String(dbLatency), status: metrics.status }).catch(() => {});
    res.json(metrics);
  } catch (err) {
    res.status(500).json({ error: "Health check failed", status: "critical" });
  }
});

adminHealthRouter.get("/history", async (_req, res) => {
  try {
    const logs = await db.select().from(systemHealthLogsTable).orderBy(desc(systemHealthLogsTable.timestamp)).limit(100);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch health history" });
  }
});

// GET /api/admin/health/backup-logs
adminHealthRouter.get("/backup-logs", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM backup_logs ORDER BY created_at DESC LIMIT 50`,
    ).catch(() => ({ rows: [] }));
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/health/run-backup
adminHealthRouter.post("/run-backup", async (_req, res) => {
  try {
    const { runBackup } = await import("../lib/backup-scheduler");
    // Fire and forget — backup runs async
    runBackup().catch(() => {});
    res.json({ success: true, message: "Backup started. Check backup logs in a few seconds." });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

adminHealthRouter.get("/scaling/metrics", async (_req, res) => {
  try {
    const [userGrowth, storageEst] = await Promise.all([
      pool.query(`SELECT date_trunc('month', created_at)::text as month, count(*)::int as users FROM accounts WHERE created_at >= now() - interval '6 months' GROUP BY 1 ORDER BY 1`).catch(() => ({ rows: [] })),
      pool.query(`SELECT pg_size_pretty(pg_database_size(current_database())) as db_size, pg_database_size(current_database()) as db_bytes`).catch(() => ({ rows: [{ db_size: 'N/A', db_bytes: 0 }] })),
    ]);
    res.json({ userGrowth: userGrowth.rows, storage: storageEst.rows[0], recommendations: [] });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch scaling metrics" });
  }
});
