import { Router } from "express";
import multer from "multer";
import { createWorker } from "tesseract.js";

export const ocrRouter = Router();
const upload = multer({ dest: "uploads/" });

ocrRouter.post("/scan", upload.single("image"), async (req, res) => {
  const worker = await createWorker();
  await worker.load();
  await worker.loadLanguage("eng");
  await worker.initialize("eng");
  const { data: { text } } = await worker.recognize(req.file.path);
  await worker.terminate();
  res.json({ text });
});
