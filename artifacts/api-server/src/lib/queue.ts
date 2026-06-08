import { logger } from "./logger";

/**
 * Simple job queue abstraction.
 * Uses in-memory processing. When REDIS_URL is set, BullMQ can be wired in.
 */

export type JobName =
  | "send-email"
  | "generate-ai"
  | "generate-report"
  | "send-notification"
  | "process-backup";

export interface Job {
  id: string;
  name: JobName;
  data: Record<string, unknown>;
  status: "waiting" | "active" | "completed" | "failed";
  createdAt: Date;
  completedAt?: Date;
  error?: string;
  attempts: number;
}

const jobs = new Map<string, Job>();
const handlers = new Map<JobName, (data: Record<string, unknown>) => Promise<void>>();

let jobCounter = 0;

export function registerHandler(name: JobName, handler: (data: Record<string, unknown>) => Promise<void>) {
  handlers.set(name, handler);
}

export async function enqueue(name: JobName, data: Record<string, unknown> = {}): Promise<string> {
  const id = `${Date.now()}-${++jobCounter}`;
  const job: Job = {
    id,
    name,
    data,
    status: "waiting",
    createdAt: new Date(),
    attempts: 0,
  };
  jobs.set(id, job);

  // Process async so the caller returns immediately
  setImmediate(async () => {
    const handler = handlers.get(name);
    if (!handler) {
      job.status = "failed";
      job.error = `No handler registered for job: ${name}`;
      return;
    }
    job.status = "active";
    job.attempts++;
    try {
      await handler(data);
      job.status = "completed";
      job.completedAt = new Date();
    } catch (err: any) {
      job.status = "failed";
      job.error = err?.message ?? String(err);
      logger.error({ jobId: id, name, err }, "Job failed");

      // Simple retry: re-queue once after 5 seconds if first attempt
      if (job.attempts < 2) {
        setTimeout(() => {
          job.status = "waiting";
          jobs.set(id, job);
          setImmediate(() => {
            enqueue(name, data);
          });
        }, 5000);
      }
    }
  });

  return id;
}

export function getQueueStats() {
  const allJobs = Array.from(jobs.values());
  const waiting = allJobs.filter((j) => j.status === "waiting").length;
  const active = allJobs.filter((j) => j.status === "active").length;
  const completed = allJobs.filter((j) => j.status === "completed").length;
  const failed = allJobs.filter((j) => j.status === "failed").length;
  return { waiting, active, completed, failed, total: allJobs.length };
}

export function getRecentJobs(limit = 50): Job[] {
  return Array.from(jobs.values())
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

export function getJobById(id: string): Job | undefined {
  return jobs.get(id);
}

// Register built-in handlers
registerHandler("send-email", async (data) => {
  const { sendEmail } = await import("./email");
  if (data.to && data.subject && data.html) {
    await sendEmail({ to: String(data.to), subject: String(data.subject), html: String(data.html) });
  }
});

registerHandler("send-notification", async (data) => {
  logger.info({ data }, "[Queue] send-notification processed");
});

registerHandler("generate-report", async (data) => {
  logger.info({ data }, "[Queue] generate-report processed");
});

registerHandler("generate-ai", async (data) => {
  logger.info({ data }, "[Queue] generate-ai processed");
});

registerHandler("process-backup", async (_data) => {
  logger.info("[Queue] process-backup triggered");
});
