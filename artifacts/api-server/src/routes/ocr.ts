import { Router } from "express";
import multer from "multer";
import { createWorker } from "tesseract.js";

export const ocrRouter = Router();
const upload = multer({ dest: "uploads/" });

ocrRouter.post("/scan", upload.single("image"), async (req, res) => {
  if (!req.file) { res.status(400).json({ error: "No image file provided" }); return; }
  const worker = await createWorker("eng");
  const { data: { text } } = await worker.recognize(req.file.path);
  await worker.terminate();
  res.json({ text });
});
