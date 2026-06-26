import { Router, Response } from "express";
import { createReadStream, existsSync } from "fs";
import { join, extname, basename } from "path";
import { pool } from "@workspace/db";
import { authenticate, AuthRequest } from "../middleware/auth";
import { auditLog, getClientIp } from "../lib/financial-audit";

export const filesRouter = Router();

const UPLOAD_DIR = join(process.cwd(), "uploads");

const MIME_MAP: Record<string, string> = {
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".pdf":  "application/pdf",
};

filesRouter.get("/files/:filename", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { filename } = req.params;

    if (!filename || /[\/\\]/.test(filename)) {
      res.status(400).json({ error: "Invalid filename" });
      return;
    }

    const { rows } = await pool.query(
      `SELECT uploader_id, tenant_id, original_filename, mime_type, size
       FROM upload_registry WHERE filename=$1 LIMIT 1`,
      [filename]
    );

    if (!rows.length) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const record = rows[0];
    const isAdmin = req.role === "admin" || req.role === "super_admin";
    const isOwner = record.uploader_id === req.userId;
    const isSameTenant = record.tenant_id !== null && record.tenant_id === req.userId;

    if (!isAdmin && !isOwner && !isSameTenant) {
      const { rows: tenantRows } = await pool.query(
        `SELECT 1 FROM accounts WHERE id=$1 AND teacher_account_id=$2 LIMIT 1
         UNION ALL
         SELECT 1 FROM students WHERE account_id=$1 AND teacher_account_id=$2 LIMIT 1`,
        [req.userId, record.tenant_id]
      );
      if (!tenantRows.length) {
        auditLog({
          actorId: req.userId!,
          actorRole: req.role!,
          action: "FILE_ACCESS_DENIED",
          targetId: filename,
          targetType: "upload",
          ip: getClientIp(req),
          result: "blocked",
          metadata: { filename, uploaderId: record.uploader_id },
        });
        res.status(403).json({ error: "Access denied" });
        return;
      }
    }

    const filePath = join(UPLOAD_DIR, filename);
    if (!existsSync(filePath)) {
      res.status(404).json({ error: "File not found on disk" });
      return;
    }

    const ext = extname(filename).toLowerCase();
    const contentType = MIME_MAP[ext] ?? "application/octet-stream";
    const disposition = contentType.startsWith("image/")
      ? "inline"
      : `attachment; filename="${record.original_filename ?? basename(filename)}"`;

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", disposition);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("X-Content-Type-Options", "nosniff");

    auditLog({
      actorId: req.userId!,
      actorRole: req.role!,
      action: "FILE_DOWNLOAD",
      targetId: filename,
      targetType: "upload",
      ip: getClientIp(req),
      result: "success",
      metadata: { filename, size: record.size, mime_type: record.mime_type },
    });

    createReadStream(filePath).pipe(res);
  } catch {
    res.status(500).json({ error: "File retrieval failed" });
  }
});
