import type { Server as SocketServer } from "socket.io";
import { pool } from "@workspace/db";

let _io: SocketServer | null = null;

export function setupParentNotifications(io: SocketServer) {
  _io = io;

  const parentNs = io.of("/parent");

  parentNs.on("connection", (socket) => {
    // Parent joins their personal room after auth
    socket.on("join", (parentId: number) => {
      if (parentId) {
        socket.join(`parent:${parentId}`);
      }
    });

    socket.on("disconnect", () => {
      // auto-cleanup
    });
  });
}

export interface ParentNotificationPayload {
  parentId: number;
  type: "attendance" | "grade" | "assignment" | "message" | "meeting" | "alert" | "report";
  title: string;
  message: string;
}

/**
 * Emit a real-time notification to a specific parent AND persist it in DB.
 */
export async function emitParentNotification(payload: ParentNotificationPayload) {
  try {
    // Persist to DB
    const { rows } = await pool.query(
      `INSERT INTO parent_notifications (parent_id, type, title, message, is_read, created_at)
       VALUES ($1, $2, $3, $4, false, NOW()) RETURNING *`,
      [payload.parentId, payload.type, payload.title, payload.message]
    );

    // Emit via WebSocket if IO is set up
    if (_io) {
      _io.of("/parent").to(`parent:${payload.parentId}`).emit("notification", {
        ...rows[0],
        ts: Date.now(),
      });
    }

    return rows[0];
  } catch (err) {
    console.error("[parent-notifications] emit error:", err);
  }
}

/**
 * Notify all parents of a given student about an event.
 */
export async function notifyParentsOfStudent(
  studentId: number,
  notification: Omit<ParentNotificationPayload, "parentId">
) {
  try {
    const { rows } = await pool.query(
      "SELECT parent_account_id FROM guardian_links WHERE student_id=$1 AND status='active'",
      [studentId]
    );
    await Promise.all(
      rows.map((r: { parent_account_id: number }) => emitParentNotification({ ...notification, parentId: r.parent_account_id }))
    );
  } catch (err) {
    console.error("[parent-notifications] notifyParentsOfStudent error:", err);
  }
}
