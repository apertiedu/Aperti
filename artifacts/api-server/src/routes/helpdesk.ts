import { Router, Response } from "express";
import { db } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { helpdeskTicketsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const helpdeskRouter = Router();

// POST /helpdesk — create ticket (any authenticated user)
helpdeskRouter.post("/", authenticate, async (req: AuthRequest, res: Response) => {
  const accountId = req.userId!;
  const { subject, message, priority } = req.body;
  const [ticket] = await db.insert(helpdeskTicketsTable).values({
    accountId, subject, message, priority: priority || "normal",
  }).returning();
  res.status(201).json(ticket);
});

// GET /helpdesk/my — user's tickets
helpdeskRouter.get("/my", authenticate, async (req: AuthRequest, res: Response) => {
  const tickets = await db.query.helpdeskTickets.findMany({
    where: (t, { eq }) => eq(t.accountId, req.userId!),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  res.json(tickets);
});

// ADMIN: GET /helpdesk/admin/all — all tickets
helpdeskRouter.get("/admin/all", authenticate, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const tickets = await db.query.helpdeskTickets.findMany({
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  res.json(tickets);
});

// ADMIN: PUT /helpdesk/admin/:id — update ticket status / reply
helpdeskRouter.put("/admin/:id", authenticate, requireRole("admin"), async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id, 10);
  const { status } = req.body;
  await db.update(helpdeskTicketsTable).set({ status }).where(eq(helpdeskTicketsTable.id, id));
  res.json({ success: true });
});
