import { execFile } from "child_process";
import { existsSync, mkdirSync, createWriteStream, readdirSync, statSync, unlinkSync } from "fs";
import { join } from "path";
import { promisify } from "util";
import { pool } from "@workspace/db";
import { logger } from "./logger";

const execFileAsync = promisify(execFile);
const BACKUP_DIR = join(process.cwd(), "backups");
const MAX_BACKUPS = 10;

if (!existsSync(BACKUP_DIR)) {
  try { mkdirSync(BACKUP_DIR, { recursive: true }); } catch {}
}

async function logBackup(type: string, status: string, fileUrl?: string, sizeBytes?: number) {
  await pool.query(
    `INSERT INTO backup_logs (type, status, file_url, size_bytes, created_at) VALUES ($1,$2,$3,$4,NOW())`,
    [type, status, fileUrl ?? null, sizeBytes ?? null],
  ).catch((err) => logger.warn({ err }, "Failed to write backup log"));
}

async function pruneOldBackups() {
  try {
    const files = readdirSync(BACKUP_DIR)
      .filter((f) => f.endsWith(".sql") || f.endsWith(".sql.gz"))
      .map((f) => ({ name: f, mtime: statSync(join(BACKUP_DIR, f)).mtime.getTime() }))
      .sort((a, b) => b.mtime - a.mtime);

    for (const file of files.slice(MAX_BACKUPS)) {
      unlinkSync(join(BACKUP_DIR, file.name));
      logger.info({ file: file.name }, "Pruned old backup");
    }
  } catch (err) {
    logger.warn({ err }, "Failed to prune old backups");
  }
}

export async function runBackup(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    logger.warn("DATABASE_URL not set — skipping backup");
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `aperti-backup-${timestamp}.sql`;
  const filePath = join(BACKUP_DIR, fileName);

  try {
    logger.info({ fileName }, "Starting database backup");

    await execFileAsync("pg_dump", [dbUrl, "-f", filePath]);

    const { statSync: stat } = await import("fs");
    const sizeBytes = stat(filePath).size;

    await logBackup("auto", "success", `/backups/${fileName}`, sizeBytes);
    await pruneOldBackups();

    logger.info({ fileName, sizeBytes }, "Database backup completed");
  } catch (err: any) {
    logger.error({ err }, "Database backup failed");
    await logBackup("auto", "failed");
  }
}

let schedulerStarted = false;

export function startBackupScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;

  import("node-cron").then(({ default: cron }) => {
    // Daily backup at 2:00 AM UTC
    cron.schedule("0 2 * * *", () => {
      logger.info("Running scheduled backup");
      runBackup().catch((err) => logger.error({ err }, "Scheduled backup error"));
    });

    logger.info("Backup scheduler started (daily at 02:00 UTC)");
  }).catch((err) => {
    logger.warn({ err }, "node-cron not available — backup scheduler disabled");
  });
}
