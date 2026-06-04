import { Router } from "express";
import fs from "fs";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import type { Response } from "express";

const router = Router();
const studentGuard = [authenticate, requireRole("student")];

const REPORTS_FILE = "/tmp/aperti-safety-reports.json";
const BLOCKS_FILE = "/tmp/aperti-safety-blocks.json";

const FLAGGED_KEYWORDS = [
  "kill", "hate", "stupid", "idiot", "loser", "ugly", "die", "worthless", "trash", "retard",
];

function readJSON(file: string): any[] {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return []; }
}
function writeJSON(file: string, data: any[]): void {
  try { fs.writeFileSync(file, JSON.stringify(data, null, 2)); } catch { /* silent */ }
}

export function containsFlaggedContent(text: string): boolean {
  const lower = text.toLowerCase();
  return FLAGGED_KEYWORDS.some(k => lower.includes(k));
}

// POST /api/safety/report
router.post("/safety/report", ...studentGuard, (req: AuthRequest, res: Response): void => {
  const { targetType, targetId, reason, description } = req.body;
  if (!targetType || !targetId || !reason) {
    res.status(400).json({ message: "targetType, targetId, and reason are required" });
    return;
  }
  const reports = readJSON(REPORTS_FILE);
  reports.push({
    id: Date.now(),
    reporterId: req.userId,
    targetType,
    targetId: String(targetId),
    reason,
    description: description ?? "",
    status: "pending",
    createdAt: new Date().toISOString(),
  });
  writeJSON(REPORTS_FILE, reports);
  res.status(201).json({ message: "Report submitted. Our team will review it shortly." });
});

// POST /api/safety/block/:userId
router.post("/safety/block/:userId", ...studentGuard, (req: AuthRequest, res: Response): void => {
  const blockedId = parseInt(req.params.userId, 10);
  if (isNaN(blockedId) || blockedId === req.userId) {
    res.status(400).json({ message: "Invalid user" });
    return;
  }
  const blocks = readJSON(BLOCKS_FILE);
  const exists = blocks.find((b: any) => b.blockerId === req.userId && b.blockedId === blockedId);
  if (!exists) {
    blocks.push({ blockerId: req.userId, blockedId, createdAt: new Date().toISOString() });
    writeJSON(BLOCKS_FILE, blocks);
  }
  res.json({ message: "User blocked" });
});

// DELETE /api/safety/block/:userId
router.delete("/safety/block/:userId", ...studentGuard, (req: AuthRequest, res: Response): void => {
  const blockedId = parseInt(req.params.userId, 10);
  const blocks = readJSON(BLOCKS_FILE).filter(
    (b: any) => !(b.blockerId === req.userId && b.blockedId === blockedId),
  );
  writeJSON(BLOCKS_FILE, blocks);
  res.json({ message: "User unblocked" });
});

// GET /api/safety/blocked
router.get("/safety/blocked", ...studentGuard, (req: AuthRequest, res: Response): void => {
  const blockedIds = readJSON(BLOCKS_FILE)
    .filter((b: any) => b.blockerId === req.userId)
    .map((b: any) => b.blockedId);
  res.json(blockedIds);
});

export default router;
