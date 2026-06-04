import { pool } from "@workspace/db";
import { executeTask } from "../routes/autopilot";

const INTERVAL_MS = 60_000; // check every minute
let _started = false;

export function startAutopilotService(): void {
  if (_started) return;
  _started = true;

  setInterval(async () => {
    try {
      const now = new Date();
      const { rows: tasks } = await pool.query(
        `SELECT * FROM automation_tasks WHERE enabled = TRUE`
      );

      for (const task of tasks) {
        if (!isDue(task, now)) continue;
        try {
          await executeTask(task);
          await pool.query(
            `UPDATE automation_tasks SET last_run=NOW(), run_count=COALESCE(run_count,0)+1 WHERE id=$1`,
            [task.id]
          );
        } catch (err) {
          console.error(`[AutoPilot] Task ${task.id} failed:`, err);
        }
      }
    } catch (err) {
      console.error("[AutoPilot] Scheduler tick failed:", err);
    }
  }, INTERVAL_MS);

  console.log("[AutoPilot] Scheduler started (60s interval)");
}

function isDue(task: any, now: Date): boolean {
  if (!task.last_run) return true;

  const lastRun = new Date(task.last_run).getTime();
  const schedule: string = task.schedule ?? "daily";

  const INTERVALS: Record<string, number> = {
    "every_minute": 60_000,
    "hourly":      60 * 60_000,
    "daily":       24 * 60 * 60_000,
    "weekly":      7  * 24 * 60 * 60_000,
    "monday":      7  * 24 * 60 * 60_000,
  };

  const interval = INTERVALS[schedule];
  if (!interval) return false;

  // For monday, only run on Mondays
  if (schedule === "monday" && now.getDay() !== 1) return false;

  return now.getTime() - lastRun >= interval;
}
