import { Router, Response } from "express";
import { db } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { helpdeskTicketsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const helpdeskRouter = Router();

helpdeskRouter.post("/", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const accountId = req.userId!;
    const { subject, message, priority } = req.body;
    const [ticket] = await db.insert(helpdeskTicketsTable).values({
      accountId, subject, message, priority: priority || "normal",
    }).returning();
    res.status(201).json(ticket);
  } catch (err) {
    res.status(500).json({ error: "Failed to create ticket" });
  }
});

helpdeskRouter.get("/my", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const tickets = await db.query.helpdeskTickets.findMany({
      where: (t, { eq }) => eq(t.accountId, req.userId!),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ error: "Failed to load tickets" });
  }
});

helpdeskRouter.get("/admin/all", authenticate, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const tickets = await db.query.helpdeskTickets.findMany({
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ error: "Failed to load tickets" });
  }
});

helpdeskRouter.put("/admin/:id", authenticate, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body;
    await db.update(helpdeskTicketsTable).set({ status }).where(eq(helpdeskTicketsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update ticket" });
  }
});
