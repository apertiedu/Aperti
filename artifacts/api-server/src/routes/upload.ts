import { Router, Response } from "express";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";
import { mkdirSync } from "fs";
import { writeFile } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";

export const uploadRouter = Router();

const ALLOWED_TYPES: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "application/pdf": ".pdf",
};

const UPLOAD_DIR = join(process.cwd(), "uploads");

uploadRouter.post("/", authenticate, requireRole("teacher", "admin"), async (req: AuthRequest, res: Response): Promise<void> => {
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
    const uniqueName = `${Date.now()}-${randomBytes(6).toString("hex")}${ext}`;
    const filePath = join(UPLOAD_DIR, uniqueName);

    // Non-blocking async write — writeFileSync blocks the Node.js event loop
    // for the entire duration of the file write, stalling ALL concurrent requests.
    await writeFile(filePath, buffer);

    res.json({ url: `/uploads/${uniqueName}`, fileName: uniqueName });
  } catch {
    res.status(500).json({ error: "File upload failed" });
  }
});
