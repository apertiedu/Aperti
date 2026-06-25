import type { Response, NextFunction } from "express";
import { db, auditLogsTable, studentsTable, accountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authenticate, AuthRequest } from "./auth";

export interface TenantContext {
  accountId: number;
  teacherId: number | null;
  isAdmin: boolean;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      tenant: TenantContext;
    }
  }
}

export async function requireStudentAccess(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  authenticate(req, res, async () => {
    const accountId = req.userId;
    if (!accountId) { res.status(401).json({ message: "Not authenticated" }); return; }
    if (req.role !== "student") { res.status(403).json({ message: "Student access required" }); return; }
    const [student] = await db.select().from(studentsTable).where(eq(studentsTable.accountId, accountId));
    if (!student) { res.status(403).json({ message: "No student record linked to this account" }); return; }
    (req as any).studentId = student.id;
    (req as any).teacherAccountId = student.teacherAccountId;
    next();
  });
}

export async function requireTenantAccess(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  authenticate(req, res, async () => {
    const accountId = req.userId;
    const role = req.role || "admin";

    if (!accountId) { res.status(401).json({ message: "Not authenticated" }); return; }
    if (role === "student") { res.status(403).json({ message: "Students must use the student portal" }); return; }

    let teacherId: number | null = null;

    if (role === "teacher") {
      teacherId = accountId;
    } else if (role === "assistant") {
      // JWT only carries { id, role } — must query DB to resolve the owning teacher.
      // This is intentional: client-supplied teacherAccountId is never trusted.
      const [account] = await db
        .select({ teacherAccountId: accountsTable.teacherAccountId })
        .from(accountsTable)
        .where(eq(accountsTable.id, accountId));

      teacherId = account?.teacherAccountId ?? null;

      if (!teacherId) {
        res.status(403).json({ message: "Assistant is not assigned to a teacher" });
        return;
      }
    }
    // admin: teacherId stays null — admins operate globally

    req.tenant = { accountId, teacherId, isAdmin: role === "admin", role };
    next();
  });
}

export async function logAudit(
  req: AuthRequest,
  action: string,
  resource: string,
  resourceId?: number,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      accountId: req.userId ?? null,
      teacherId: req.tenant?.teacherId ?? null,
      action,
      resource,
      resourceId: resourceId ?? null,
      details: details ?? null,
      ipAddress: req.ip ?? null,
    });
  } catch {
    // Never let audit logging break a request
  }
}

/**
 * Builds a Drizzle WHERE clause that scopes a query to the authenticated teacher.
 * For admins (teacherId === null) no filter is applied — they see everything.
 * ALWAYS call this; never accept teacherAccountId from the request body or params.
 */
export function tenantFilter<T extends Record<string, any>>(
  table: T,
  column: keyof T,
  teacherId: number | null
) {
  const { eq } = require("drizzle-orm");
  return teacherId !== null ? eq(table[column], teacherId) : undefined;
}
