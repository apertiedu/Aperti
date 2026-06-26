import { Router, Response } from "express";
import { createReadStream, existsSync } from "fs";
import { join, extname, basename } from "path";
import { pool } from "@workspace/db";
import { authenticate, AuthRequest } from "../middleware/auth";
import { audit, getIp, getUa } from "../lib/audit";
import { fileDownloadLimiter } from "../middleware/rate-limit";

export const filesRouter = Router();

const UPLOAD_DIR = join(process.cwd(), "uploads");

const MIME_MAP: Record<string, string> = {
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".pdf":  "application/pdf",
};

filesRouter.get(
  "/files/:filename",
  authenticate,
  fileDownloadLimiter,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { filename } = req.params;

      // Prevent path traversal
      if (!filename || /[/\\%]/.test(filename) || filename.includes("..")) {
        res.status(400).json({ error: "Invalid filename" });
        return;
      }

      const { rows } = await pool.query(
        `SELECT uploader_id, tenant_id, original_filename, mime_type, size
         FROM upload_registry WHERE filename=$1 LIMIT 1`,
        [filename],
      );

      if (!rows.length) {
        res.status(404).json({ error: "File not found" });
        return;
      }

      const record = rows[0];
      const isAdmin = req.role === "admin" || req.role === "super_admin";
      const isOwner = record.uploader_id === req.userId;

      // Tenant check: requesting user must belong to the same teacher/tenant
      let isSameTenant = false;
      if (!isAdmin && !isOwner && record.tenant_id !== null) {
        const { rows: tenantRows } = await pool.query(
          `SELECT 1 FROM accounts WHERE id=$1 AND teacher_account_id=$2 LIMIT 1
           UNION ALL
           SELECT 1 FROM students WHERE account_id=$1 AND teacher_account_id=$2 LIMIT 1`,
          [req.userId, record.tenant_id],
        );
        isSameTenant = tenantRows.length > 0;
      }

      if (!isAdmin && !isOwner && !isSameTenant) {
        void audit({
          actorId: req.userId!,
          actorRole: req.role!,
          action: "FILE_ACCESS_DENIED",
          resource: "upload",
          resourceId: filename,
          ip: getIp(req),
          userAgent: getUa(req),
          result: "blocked",
          metadata: { filename, uploaderId: record.uploader_id },
        });
        res.status(403).json({ error: "Access denied" });
        return;
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
      res.setHeader("X-Request-Id", (req as any).correlationId ?? "");

      void audit({
        actorId: req.userId!,
        actorRole: req.role!,
        action: "FILE_DOWNLOAD",
        resource: "upload",
        resourceId: filename,
        tenantId: record.tenant_id ?? undefined,
        ip: getIp(req),
        userAgent: getUa(req),
        result: "success",
        metadata: { filename, size: record.size, mimeType: record.mime_type },
      });

      createReadStream(filePath).pipe(res);
    } catch {
      res.status(500).json({ error: "File retrieval failed" });
    }
  },
);
