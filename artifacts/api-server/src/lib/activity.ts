import { pool } from "@workspace/db";

interface ActivityEntry {
  actorId: number;
  actorName?: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId?: number;
  entityName?: string;
  description: string;
  metadata?: Record<string, unknown>;
  tenantId?: number;
}

export async function logActivity(entry: ActivityEntry): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO activity_logs
         (actor_id, actor_name, actor_role, action, entity_type, entity_id, entity_name, description, metadata, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        entry.actorId,
        entry.actorName ?? null,
        entry.actorRole,
        entry.action,
        entry.entityType,
        entry.entityId ?? null,
        entry.entityName ?? null,
        entry.description,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
        entry.tenantId ?? null,
      ],
    );
  } catch {
  }
}
