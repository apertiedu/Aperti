import { Router, type Request, type Response } from "express";
import { register } from "../lib/metrics";
import { authenticate, requireRole } from "../middleware/auth";

export const metricsRouter = Router();

metricsRouter.get("/", async (req: Request, res: Response): Promise<void> => {
  const token = process.env["METRICS_TOKEN"];
  if (token) {
    const provided = (req.headers["authorization"] ?? "").replace(/^Bearer\s+/i, "");
    if (provided !== token) {
      res.status(401).set("WWW-Authenticate", 'Bearer realm="metrics"').end("# unauthorized");
      return;
    }
    try {
      res.set("Content-Type", register.contentType);
      const metrics = await register.metrics();
      res.end(metrics);
    } catch {
      res.status(500).end("# metrics unavailable");
    }
    return;
  }
  res.status(401).end("# unauthorized: set METRICS_TOKEN or use admin login via /api/metrics");
});
