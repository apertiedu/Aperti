import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

async function ensureTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS absence_notify_settings (
      id SERIAL PRIMARY KEY,
      account_id INTEGER NOT NULL UNIQUE,
      sender_name TEXT NOT NULL DEFAULT 'Your Teacher',
      message_template TEXT NOT NULL DEFAULT 'Dear parent, {studentName} was marked {status} from {lessonName} on {date}. Please contact us for more details.',
      whatsapp_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS absence_notify_log (
      id SERIAL PRIMARY KEY,
      account_id INTEGER NOT NULL,
      student_name TEXT NOT NULL,
      parent_phone TEXT NOT NULL,
      status TEXT NOT NULL,
      lesson_name TEXT NOT NULL,
      date TEXT NOT NULL,
      message TEXT NOT NULL,
      channel TEXT NOT NULL DEFAULT 'whatsapp',
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_phone TEXT
  `);
}
ensureTables().catch(console.error);

// GET /absence-notify/settings
router.get("/settings", authenticate, async (req: any, res) => {
  try {
    const rows = await db.execute(
      sql`SELECT * FROM absence_notify_settings WHERE account_id = ${req.user.id}`
    );
    if (rows.rows.length === 0) {
      return res.json({
        senderName: "Your Teacher",
        messageTemplate: "Dear parent, {studentName} was marked {status} from {lessonName} on {date}. Please contact us for more details.",
        whatsappEnabled: true,
      });
    }
    const r = rows.rows[0] as any;
    return res.json({
      senderName: r.sender_name,
      messageTemplate: r.message_template,
      whatsappEnabled: r.whatsapp_enabled,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to load settings" });
  }
});

// PUT /absence-notify/settings
router.put("/settings", authenticate, async (req: any, res) => {
  try {
    const { senderName, messageTemplate, whatsappEnabled } = req.body;
    await db.execute(sql`
      INSERT INTO absence_notify_settings (account_id, sender_name, message_template, whatsapp_enabled, updated_at)
      VALUES (${req.user.id}, ${senderName}, ${messageTemplate}, ${whatsappEnabled}, NOW())
      ON CONFLICT (account_id) DO UPDATE
        SET sender_name = ${senderName},
            message_template = ${messageTemplate},
            whatsapp_enabled = ${whatsappEnabled},
            updated_at = NOW()
    `);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to save settings" });
  }
});

// POST /absence-notify/send — looks up parent phone by studentId, logs + returns WhatsApp URL
router.post("/send", authenticate, async (req: any, res) => {
  try {
    const { studentId, studentName, status, lessonName, date } = req.body;

    // Fetch parent phone from students table
    const studentRows = await db.execute(
      sql`SELECT parent_phone FROM students WHERE id = ${studentId}`
    );
    const parentPhone: string | null = studentRows.rows.length > 0
      ? (studentRows.rows[0] as any).parent_phone
      : null;

    if (!parentPhone) {
      return res.json({ ok: false, waUrl: null, message: null, error: "no_phone" });
    }

    // Load message template
    const settingsRows = await db.execute(
      sql`SELECT message_template FROM absence_notify_settings WHERE account_id = ${req.user.id}`
    );
    const template = settingsRows.rows.length > 0
      ? (settingsRows.rows[0] as any).message_template
      : "Dear parent, {studentName} was marked {status} from {lessonName} on {date}. Please contact the teacher for details.";

    const message = template
      .replace("{studentName}", studentName)
      .replace("{status}", status)
      .replace("{lessonName}", lessonName)
      .replace("{date}", date);

    // Log the notification
    await db.execute(sql`
      INSERT INTO absence_notify_log
        (account_id, student_name, parent_phone, status, lesson_name, date, message, channel)
      VALUES
        (${req.user.id}, ${studentName}, ${parentPhone}, ${status}, ${lessonName}, ${date}, ${message}, 'whatsapp')
    `);

    const cleanPhone = parentPhone.replace(/\D/g, "");
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;

    return res.json({ ok: true, waUrl, message });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to send notification" });
  }
});

// POST /absence-notify/update-phone — update parent phone on student record
router.post("/update-phone", authenticate, async (req: any, res) => {
  try {
    const { studentId, parentPhone } = req.body;
    await db.execute(sql`
      UPDATE students SET parent_phone = ${parentPhone} WHERE id = ${studentId}
    `);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to update phone" });
  }
});

// GET /absence-notify/log
router.get("/log", authenticate, async (req: any, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT * FROM absence_notify_log
      WHERE account_id = ${req.user.id}
      ORDER BY sent_at DESC
      LIMIT 100
    `);
    return res.json(rows.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to load log" });
  }
});

// GET /absence-notify/students-phones — get all students with parent phone info
router.get("/students-phones", authenticate, async (req: any, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT id, student_name, student_code, parent_phone FROM students ORDER BY student_name
    `);
    return res.json(rows.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to load students" });
  }
});

export default router;
