import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";

const router: IRouter = Router();

router.post("/", async (req, res): Promise<void> => {
  try {
    const { name, email, subject, message } = req.body ?? {};

    if (!name || !email || !subject || !message) {
      res.status(400).json({ error: "All fields are required." });
      return;
    }

    if (typeof email !== "string" || !email.includes("@")) {
      res.status(400).json({ error: "Invalid email address." });
      return;
    }

    if (typeof message !== "string" || message.trim().length < 10) {
      res.status(400).json({ error: "Message must be at least 10 characters." });
      return;
    }

    await pool.query(
      `INSERT INTO contact_submissions (name, email, subject, message, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        String(name).slice(0, 200),
        String(email).slice(0, 320),
        String(subject).slice(0, 300),
        String(message).slice(0, 5000),
      ]
    );

    res.json({ ok: true });
  } catch (err: any) {
    if (err?.code === "42P01") {
      res.status(503).json({ error: "Contact service temporarily unavailable. Please email us directly." });
      return;
    }
    res.status(500).json({ error: "Failed to submit your message. Please try again." });
  }
});

export { router as contactRouter };
