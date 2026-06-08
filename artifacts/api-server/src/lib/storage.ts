import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, extname, basename } from "path";
import { randomBytes } from "crypto";

const CDN_URL = process.env.CDN_URL || "";
const UPLOAD_DIR = join(process.cwd(), "uploads");

if (!existsSync(UPLOAD_DIR)) {
  try { mkdirSync(UPLOAD_DIR, { recursive: true }); } catch {}
}

export interface StorageResult {
  url: string;
  path: string;
  fileName: string;
}

/**
 * Save a file to local disk and return a URL.
 * If CDN_URL is configured, the returned URL will use the CDN prefix.
 */
export async function saveFile(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
): Promise<StorageResult> {
  const ext = extname(originalName) || mimeTypeToExt(mimeType);
  const fileName = `${Date.now()}-${randomBytes(6).toString("hex")}${ext}`;
  const filePath = join(UPLOAD_DIR, fileName);

  writeFileSync(filePath, buffer);

  const url = CDN_URL ? `${CDN_URL.replace(/\/$/, "")}/uploads/${fileName}` : `/uploads/${fileName}`;

  return { url, path: filePath, fileName };
}

/**
 * Save a base64-encoded file string.
 */
export async function saveBase64File(
  fileData: string,
  mimeType: string,
  originalName = "file",
): Promise<StorageResult> {
  const base64 = fileData.replace(/^data:[^;]+;base64,/, "");
  const buffer = Buffer.from(base64, "base64");
  return saveFile(buffer, originalName, mimeType);
}

/**
 * Rewrite a local /uploads/ URL to use CDN prefix if configured.
 */
export function cdnUrl(localUrl: string): string {
  if (!CDN_URL || !localUrl) return localUrl;
  if (localUrl.startsWith("http")) return localUrl;
  return `${CDN_URL.replace(/\/$/, "")}${localUrl}`;
}

function mimeTypeToExt(mimeType: string): string {
  const map: Record<string, string> = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
    "video/mp4": ".mp4",
    "audio/mpeg": ".mp3",
  };
  return map[mimeType] || ".bin";
}
