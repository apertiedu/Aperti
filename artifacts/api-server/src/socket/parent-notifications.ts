import type { Server as SocketServer } from "socket.io";
import { pool } from "@workspace/db";
import * as jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "";

let _io: SocketServer | null = null;

function parseCookieHeader(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  header.split(";").forEach(part => {
    const idx = part.indexOf("=");
    if (idx < 0) return;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  });
  return out;
}

export function setupParentNotifications(io: SocketServer) {
  _io = io;

  const parentNs = io.of("/parent");

  parentNs.use((socket, next) => {
    const rawCookie = socket.handshake.headers.cookie || "";
    const cookies = parseCookieHeader(rawCookie);
    const token = cookies["aperti_token"];
    if (!token) return next(new Error("Unauthorized"));
    try {
      const payload = jwt.verify(token, JWT_SECRET) as Record<string, unknown>;
      if (!payload.id || payload.role !== "parent") return next(new Error("Forbidden"));
      socket.data.userId = payload.id as number;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  parentNs.on("connection", (socket) => {
    socket.on("join", (parentId: number) => {
      if (parentId && socket.data.userId === parentId) {
        socket.join(`parent:${parentId}`);
      }
    });

    socket.on("disconnect", () => {});
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
