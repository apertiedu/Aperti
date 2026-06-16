import { pool } from "@workspace/db";

export interface AuditEntry {
  actorId: number | null;
  actorRole: string;
  action: string;
  targetId: string | number | null;
  targetType: string;
  ip: string;
  result: "success" | "blocked";
  metadata?: Record<string, unknown>;
}

export function auditLog(entry: AuditEntry): void {
  pool
    .query(
      `INSERT INTO financial_audit_log
         (actor_id, actor_role, action, target_id, target_type, ip_address, result, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        entry.actorId,
        entry.actorRole,
        entry.action,
        entry.targetId !== null ? String(entry.targetId) : null,
        entry.targetType,
        entry.ip.slice(0, 64),
        entry.result,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
      ],
    )
    .catch(() => {});
}

export function getClientIp(req: { ip?: string; headers: Record<string, string | string[] | undefined> }): string {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) return (Array.isArray(fwd) ? fwd[0] : fwd.split(",")[0]).trim();
  return req.ip ?? "unknown";
}
