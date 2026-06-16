import { Router } from "express";
import { register } from "../lib/metrics";

export const metricsRouter = Router();

// GET /metrics — Prometheus scrape endpoint (no auth for scraper compatibility)
metricsRouter.get("/", async (_req, res) => {
  try {
    res.set("Content-Type", register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch {
    res.status(500).end("# metrics unavailable");
  }
});
