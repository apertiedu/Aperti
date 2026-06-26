import { Router, Response } from "express";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { mkdirSync } from "fs";
import { writeFile } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";
import { pool } from "@workspace/db";
import { auditFromReq } from "../lib/audit";
import { uploadLimiter } from "../middleware/rate-limit";

export const uploadRouter = Router();

const ALLOWED_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "application/pdf": ".pdf",
};

const MAGIC_BYTES: Record<string, number[]> = {
  "image/png":       [0x89, 0x50, 0x4e, 0x47],
  "image/jpeg":      [0xff, 0xd8, 0xff],
  "image/jpg":       [0xff, 0xd8, 0xff],
  "application/pdf": [0x25, 0x50, 0x44, 0x46],
};

function hasMagicBytes(buf: Buffer, fileType: string): boolean {
  const sig = MAGIC_BYTES[fileType];
  if (!sig) return false;
  return sig.every((byte, i) => buf[i] === byte);
}

const UPLOAD_DIR = join(process.cwd(), "uploads");

/**
 * Resolve the correct tenant_id for a given uploader.
 *
 * - For teachers / admins   → their own account ID is the tenant root.
 * - For assistants          → they belong to a teacher; use that teacher's ID.
 *
 * This prevents assistants from creating upload records with the wrong tenant,
 * which would break the tenant-isolation check in the file-serving endpoint.
 */
async function resolveTenantId(uploaderRole: string, uploaderId: number): Promise<number> {
  if (uploaderRole === "assistant") {
    const { rows } = await pool.query(
      `SELECT teacher_account_id FROM accounts WHERE id=$1 LIMIT 1`,
      [uploaderId],
    );
    const linked = rows[0]?.teacher_account_id;
    if (linked) return linked;
  }
  // Teachers, admins — they are their own tenant root
  return uploaderId;
}

uploadRouter.post(
  "/",
  authenticate,
  requireRole("teacher", "admin", "assistant"),
  uploadLimiter,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { fileName, fileType, fileData } = req.body as {
        fileName: string;
        fileType: string;
        fileData: string;
      };

      if (!fileData || !fileType) {
        res.status(400).json({ error: "fileData and fileType required" });
        return;
      }

      const ext = ALLOWED_TYPES[fileType];
      if (!ext) {
        res.status(400).json({ error: "Only PNG, JPG and PDF files are allowed" });
        return;
      }

      const sizeEstimate = (fileData.length * 3) / 4;
      if (sizeEstimate > 10 * 1024 * 1024) {
        res.status(400).json({ error: "File too large (max 10 MB)" });
        return;
      }

      try { mkdirSync(UPLOAD_DIR, { recursive: true }); } catch { }

      const base64Data = fileData.replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      if (!hasMagicBytes(buffer, fileType)) {
        res.status(400).json({ error: "File content does not match the declared file type" });
        return;
      }

      const uniqueName = `${Date.now()}-${randomBytes(6).toString("hex")}${ext}`;
      const filePath = join(UPLOAD_DIR, uniqueName);

      await writeFile(filePath, buffer);

      // Resolve tenant correctly — assistants link to their teacher's account
      const tenantId = await resolveTenantId(req.role!, req.userId!);

      // Register in upload_registry for authenticated-only serving + audit trail
      await pool.query(
        `INSERT INTO upload_registry
           (uploader_id, tenant_id, filename, original_filename, mime_type, size, uploaded_at)
         VALUES ($1,$2,$3,$4,$5,$6,NOW())
         ON CONFLICT (filename) DO NOTHING`,
        [req.userId, tenantId, uniqueName, fileName ?? uniqueName, fileType, buffer.length],
      );

      auditFromReq(req, "FILE_UPLOAD", "upload", {
        resourceId: uniqueName,
        tenantId,
        metadata: {
          filename: uniqueName,
          originalFilename: fileName,
          size: buffer.length,
          mimeType: fileType,
        },
      });

      // Return /files/ URL — authenticated access only
      res.json({ url: `/files/${uniqueName}`, fileName: uniqueName });
    } catch {
      res.status(500).json({ error: "File upload failed" });
    }
  },
);
