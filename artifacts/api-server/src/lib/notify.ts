import { pool } from "@workspace/db";
import { sendPushToUser } from "./push";

interface NotifyOptions {
  accountId: number;
  title: string;
  message?: string;
  type?: string;
  link?: string;
  relatedEntityType?: string;
  relatedEntityId?: number;
  metadata?: Record<string, unknown>;
}

export async function notifyUser(opts: NotifyOptions): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO notifications
         (account_id, title, message, type, link, related_entity_type, related_entity_id, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        opts.accountId,
        opts.title,
        opts.message ?? null,
        opts.type ?? "info",
        opts.link ?? null,
        opts.relatedEntityType ?? null,
        opts.relatedEntityId ?? null,
        opts.metadata ? JSON.stringify(opts.metadata) : null,
      ],
    );
  } catch {
  }
}

export async function notifyMany(accountIds: number[], opts: Omit<NotifyOptions, "accountId">): Promise<void> {
  await Promise.allSettled(accountIds.map(id => notifyUser({ ...opts, accountId: id })));
}

export async function notifyAndPush(
  accountId: number,
  opts: Omit<NotifyOptions, "accountId"> & { pushBody?: string },
): Promise<void> {
  await Promise.allSettled([
    notifyUser({ ...opts, accountId }),
    sendPushToUser(accountId, {
      title: opts.title,
      body: opts.pushBody ?? opts.message ?? opts.title,
      url: opts.link,
    }),
  ]);
}

export async function notifyManyAndPush(
  accountIds: number[],
  opts: Omit<NotifyOptions, "accountId"> & { pushBody?: string },
): Promise<void> {
  await Promise.allSettled(accountIds.map(id => notifyAndPush(id, opts)));
}
