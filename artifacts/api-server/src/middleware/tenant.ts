import type { Request, Response, NextFunction } from "express";
import { db, auditLogsTable } from "@workspace/db";

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

export function requireTenantAccess(req: Request, res: Response, next: NextFunction): void {
  const session = req.session as any;

  if (!session.accountId) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  const role: string = session.role || "admin";

  if (role === "student") {
    res.status(403).json({ message: "Students must use the student portal" });
    return;
  }

  let teacherId: number | null = null;

  if (role === "teacher") {
    teacherId = session.accountId;
  } else if (role === "assistant") {
    teacherId = session.teacherAccountId ?? null;
    if (!teacherId) {
      res.status(403).json({ message: "Assistant is not assigned to a teacher" });
      return;
    }
  }
  // admin: teacherId stays null — can access all data

  req.tenant = {
    accountId: session.accountId,
    teacherId,
    isAdmin: role === "admin",
    role,
  };

  next();
}

export async function logAudit(
  req: Request,
  action: string,
  resource: string,
  resourceId?: number,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    const session = req.session as any;
    await db.insert(auditLogsTable).values({
      accountId: session.accountId ?? null,
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

export function tenantFilter<T extends Record<string, any>>(
  table: T,
  column: keyof T,
  teacherId: number | null
) {
  const { eq } = require("drizzle-orm");
  return teacherId !== null ? eq(table[column], teacherId) : undefined;
}
