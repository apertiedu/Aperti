import { Router, Response } from "express";
import { db } from "@workspace/db";
import { assistantPermissionsTable, accountsTable } from "@workspace/db";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { eq, and, inArray } from "drizzle-orm";

export const assistantsRouter = Router();

const ALL_PERMISSIONS = [
  "can_manage_courses",
  "can_manage_materials",
  "can_grade_exams",
  "can_approve_grades",
  "can_manage_enrollments",
  "can_view_students",
  "can_view_reports",
  "can_view_revenue",
  "can_manage_assistants",
  "manage_students",
  "approve_enrollments",
  "manage_attendance",
  "manage_flashcards",
  "manage_homework",
  "manage_exams",
  "view_analytics",
  "manage_sessions",
  "mark_payments",
];

// GET /assistants/permissions/all — list all permission types
assistantsRouter.get("/permissions/all", authenticate, (_req, res: Response) => {
  res.json(ALL_PERMISSIONS);
});

// GET /assistants — list assistants for a teacher (or all for admin)
assistantsRouter.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  const { role, userId } = req as any;
  const effectiveRole = role || "teacher";

  let assistants;
  if (effectiveRole === "admin") {
    assistants = await db.select({
      id: accountsTable.id,
      username: accountsTable.username,
      displayName: accountsTable.displayName,
      status: accountsTable.status,
      teacherAccountId: accountsTable.teacherAccountId,
      createdAt: accountsTable.createdAt,
    }).from(accountsTable)
      .where(eq(accountsTable.role, "assistant"));
  } else {
    assistants = await db.select({
      id: accountsTable.id,
      username: accountsTable.username,
      displayName: accountsTable.displayName,
      status: accountsTable.status,
      teacherAccountId: accountsTable.teacherAccountId,
      createdAt: accountsTable.createdAt,
    }).from(accountsTable)
      .where(and(eq(accountsTable.role, "assistant"), eq(accountsTable.teacherAccountId, userId!)));
  }

  const ids = assistants.map(a => a.id);
  const perms = ids.length > 0
    ? await db.select().from(assistantPermissionsTable).where(inArray(assistantPermissionsTable.assistantId, ids))
    : [];

  const result = assistants.map(a => ({
    ...a,
    permissions: perms.filter(p => p.assistantId === a.id).map(p => p.permission),
  }));

  res.json(result);
});

// GET /assistants/:id/permissions
assistantsRouter.get("/:id/permissions", authenticate, async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const perms = await db.select().from(assistantPermissionsTable)
    .where(eq(assistantPermissionsTable.assistantId, id));
  res.json(perms.map(p => p.permission));
});

// PUT /assistants/:id/permissions — replace all permissions
assistantsRouter.put("/:id/permissions", authenticate, async (req: AuthRequest, res: Response) => {
  const id = parseInt(req.params.id);
  const { permissions } = req.body as { permissions: string[] };
  const grantedBy = (req as any).userId;

  // Verify the target is an assistant
  const [target] = await db.select({ id: accountsTable.id, role: accountsTable.role, teacherAccountId: accountsTable.teacherAccountId })
    .from(accountsTable).where(eq(accountsTable.id, id));

  if (!target || target.role !== "assistant") {
    res.status(404).json({ error: "Assistant not found" });
    return;
  }

  // Only admin or the linked teacher can edit permissions
  const callerRole = (req as any).role;
  const callerId = (req as any).userId;
  if (callerRole !== "admin" && target.teacherAccountId !== callerId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  // Replace all permissions
  await db.delete(assistantPermissionsTable).where(eq(assistantPermissionsTable.assistantId, id));

  if (permissions && permissions.length > 0) {
    const valid = permissions.filter(p => ALL_PERMISSIONS.includes(p));
    if (valid.length > 0) {
      await db.insert(assistantPermissionsTable).values(
        valid.map(p => ({ assistantId: id, permission: p, grantedBy }))
      );
    }
  }

  res.json({ success: true, permissions: permissions ?? [] });
});
