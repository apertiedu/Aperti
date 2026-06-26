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

uploadRouter.post("/", authenticate, requireRole("teacher", "admin"), uploadLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { fileName, fileType, fileData } = req.body as {
      fileName: string;
      fileType: string;
      fileData: string;
    };

    if (!fileData || !fileType) {
      return res.status(400).json({ error: "fileData and fileType required" });
    }

    const ext = ALLOWED_TYPES[fileType];
    if (!ext) {
      return res.status(400).json({ error: "Only PNG, JPG and PDF files are allowed" });
    }

    const sizeEstimate = (fileData.length * 3) / 4;
    if (sizeEstimate > 10 * 1024 * 1024) {
      return res.status(400).json({ error: "File too large (max 10 MB)" });
    }

    try { mkdirSync(UPLOAD_DIR, { recursive: true }); } catch { }

    const base64Data = fileData.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    if (!hasMagicBytes(buffer, fileType)) {
      return res.status(400).json({ error: "File content does not match the declared file type" });
    }

    const uniqueName = `${Date.now()}-${randomBytes(6).toString("hex")}${ext}`;
    const filePath = join(UPLOAD_DIR, uniqueName);

    await writeFile(filePath, buffer);

    // Register in upload_registry for authenticated-only serving + audit trail
    await pool.query(
      `INSERT INTO upload_registry (uploader_id, tenant_id, filename, original_filename, mime_type, size, uploaded_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW())
       ON CONFLICT (filename) DO NOTHING`,
      [
        req.userId,
        req.userId,       // tenant_id defaults to the uploader (teacher) for their own uploads
        uniqueName,
        fileName ?? uniqueName,
        fileType,
        buffer.length,
      ],
    );

    auditFromReq(req, "FILE_UPLOAD", "upload", {
      resourceId: uniqueName,
      metadata: { filename: uniqueName, originalFilename: fileName, size: buffer.length, mimeType: fileType },
    });

    // Return /files/ URL — authenticated access only
    res.json({ url: `/files/${uniqueName}`, fileName: uniqueName });
  } catch {
    res.status(500).json({ error: "File upload failed" });
  }
});
