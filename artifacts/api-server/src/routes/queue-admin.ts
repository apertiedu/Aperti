import { Router } from "express";
import { requireRole } from "../middleware/auth";
import { getQueueStats, getRecentJobs, getJobById, enqueue, JobName } from "../lib/queue";

export const queueAdminRouter = Router();
queueAdminRouter.use(requireRole("admin", "super_admin"));

// GET /api/admin/queue/stats
queueAdminRouter.get("/stats", (_req, res) => {
  res.json(getQueueStats());
});

// GET /api/admin/queue/jobs
queueAdminRouter.get("/jobs", (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit)) || 50, 200);
  const jobs = getRecentJobs(limit);
  res.json(jobs);
});

// GET /api/admin/queue/jobs/:id
queueAdminRouter.get("/jobs/:id", (req, res) => {
  const job = getJobById(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json(job);
});

// POST /api/admin/queue/test — enqueue a test job
queueAdminRouter.post("/test", async (_req, res) => {
  try {
    const id = await enqueue("send-notification", { message: "Test job from admin", type: "test" });
    res.json({ success: true, jobId: id });
  } catch (err: any) {
    res.status(500).json({ error: "An unexpected error occurred" });
  }
});
