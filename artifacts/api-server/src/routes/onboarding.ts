import { Router, Response } from "express";
import { pool } from "@workspace/db";
import { authenticate, AuthRequest } from "../middleware/auth";

export const onboardingRouter = Router();

(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS onboarding_progress (
      id           serial PRIMARY KEY,
      account_id   integer NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
      current_step integer NOT NULL DEFAULT 1,
      completed    boolean NOT NULL DEFAULT false,
      data         jsonb NOT NULL DEFAULT '{}',
      completed_at timestamptz,
      created_at   timestamptz NOT NULL DEFAULT NOW(),
      updated_at   timestamptz NOT NULL DEFAULT NOW()
    )
  `).catch(() => {});
})();

async function ensureProgress(accountId: number) {
  const { rows } = await pool.query(
    `INSERT INTO onboarding_progress (account_id, current_step, completed)
     VALUES ($1, 1, false)
     ON CONFLICT (account_id) DO UPDATE SET account_id=$1
     RETURNING *`,
    [accountId]
  );
  return rows[0];
}

onboardingRouter.get("/progress", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const row = await ensureProgress(req.userId!);
    res.json(row);
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

onboardingRouter.post("/save-step", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { step, data } = req.body;
    await pool.query(
      `INSERT INTO onboarding_progress (account_id, current_step, data, updated_at)
       VALUES ($1, $2, $3::jsonb, NOW())
       ON CONFLICT (account_id) DO UPDATE
         SET current_step = GREATEST(onboarding_progress.current_step, $2),
             data = onboarding_progress.data || $3::jsonb,
             updated_at = NOW()`,
      [req.userId, step ?? 1, JSON.stringify(data ?? {})]
    );
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

onboardingRouter.post("/complete", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query(
      `INSERT INTO onboarding_progress (account_id, current_step, completed, completed_at, updated_at)
       VALUES ($1, 99, true, NOW(), NOW())
       ON CONFLICT (account_id) DO UPDATE SET completed=true, completed_at=NOW(), updated_at=NOW()`,
      [req.userId]
    );
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

/**
 * GET /api/onboarding/checklist
 *
 * Returns a structured school-setup checklist with completion status for each
 * required step. Used by the onboarding wizard to render progress indicators.
 *
 * Required steps:
 *   1. Profile complete    — display_name + email set
 *   2. Email verified      — email_verified = true
 *   3. First subject       — at least 1 subject row for this teacher
 *   4. First student       — at least 1 student row for this teacher
 *   5. First lesson        — at least 1 lesson row
 *   6. Terms accepted      — consent_records has ToS entry with granted=true
 */
onboardingRouter.get("/checklist", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const [
      acctRows,
      subjectRows,
      studentRows,
      lessonRows,
      tosRows,
      progressRows,
    ] = await Promise.all([
      pool.query(
        `SELECT display_name, email, email_verified FROM accounts WHERE id = $1`,
        [userId],
      ),
      pool.query(
        `SELECT COUNT(*)::int AS cnt FROM subjects WHERE teacher_account_id = $1`,
        [userId],
      ).catch(() => ({ rows: [{ cnt: 0 }] })),
      pool.query(
        `SELECT COUNT(*)::int AS cnt FROM students WHERE teacher_account_id = $1 AND status = 'active'`,
        [userId],
      ).catch(() => ({ rows: [{ cnt: 0 }] })),
      pool.query(
        `SELECT COUNT(*)::int AS cnt FROM lessons WHERE teacher_account_id = $1`,
        [userId],
      ).catch(() => ({ rows: [{ cnt: 0 }] })),
      pool.query(
        `SELECT COUNT(*)::int AS cnt
         FROM consent_records
         WHERE user_id = $1 AND consent_type IN ('tos', 'terms_of_service', 'terms') AND granted = true`,
        [userId],
      ).catch(() => ({ rows: [{ cnt: 0 }] })),
      pool.query(
        `SELECT current_step, completed, data FROM onboarding_progress WHERE account_id = $1`,
        [userId],
      ).catch(() => ({ rows: [] })),
    ]);

    const acct = acctRows.rows[0] ?? {};
    const progress = progressRows.rows[0] ?? { current_step: 1, completed: false, data: {} };

    const steps = [
      {
        step: 1,
        key: "profile",
        title: "Complete your profile",
        description: "Set your display name and email address",
        complete: !!(acct.display_name && acct.email),
      },
      {
        step: 2,
        key: "email_verified",
        title: "Verify your email",
        description: "Click the link in the verification email we sent you",
        complete: !!acct.email_verified,
      },
      {
        step: 3,
        key: "first_subject",
        title: "Create your first subject",
        description: "Add a subject you teach (e.g., Mathematics, Science)",
        complete: (subjectRows.rows[0]?.cnt ?? 0) > 0,
      },
      {
        step: 4,
        key: "first_student",
        title: "Add your first student",
        description: "Enrol at least one student to your school",
        complete: (studentRows.rows[0]?.cnt ?? 0) > 0,
      },
      {
        step: 5,
        key: "first_lesson",
        title: "Create your first lesson",
        description: "Set up a lesson session for your students",
        complete: (lessonRows.rows[0]?.cnt ?? 0) > 0,
      },
      {
        step: 6,
        key: "terms_accepted",
        title: "Accept Terms of Service",
        description: "Review and accept the Aperti Terms of Service",
        complete: (tosRows.rows[0]?.cnt ?? 0) > 0,
      },
    ];

    const completedCount = steps.filter(s => s.complete).length;
    const totalCount = steps.length;
    const completionPct = Math.round((completedCount / totalCount) * 100);
    const isFullyComplete = completedCount === totalCount;

    // Auto-mark onboarding complete if all steps done
    if (isFullyComplete && !progress.completed) {
      pool.query(
        `INSERT INTO onboarding_progress (account_id, current_step, completed, completed_at, updated_at)
         VALUES ($1, 99, true, NOW(), NOW())
         ON CONFLICT (account_id) DO UPDATE SET completed=true, completed_at=NOW(), updated_at=NOW()`,
        [userId],
      ).catch(() => {});
    }

    res.json({
      steps,
      completedCount,
      totalCount,
      completionPct,
      isComplete: isFullyComplete,
      currentStep: progress.current_step,
      onboardingCompleted: progress.completed,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch onboarding checklist" });
  }
});

/**
 * POST /api/onboarding/school-setup
 *
 * Wizard step handler. Saves step data and advances the current_step pointer.
 * Body: { step: number, data: object }
 * Returns the updated checklist.
 */
onboardingRouter.post("/school-setup", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { step, data } = req.body as { step: number; data?: Record<string, unknown> };
    if (!step || typeof step !== "number") {
      res.status(400).json({ error: "step (number) is required" });
      return;
    }

    await pool.query(
      `INSERT INTO onboarding_progress (account_id, current_step, data, updated_at)
       VALUES ($1, $2, $3::jsonb, NOW())
       ON CONFLICT (account_id) DO UPDATE
         SET current_step = GREATEST(onboarding_progress.current_step, $2),
             data = onboarding_progress.data || $3::jsonb,
             updated_at = NOW()`,
      [req.userId, step, JSON.stringify(data ?? {})],
    );

    res.json({ ok: true, step, message: `Step ${step} saved` });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to save setup step" });
  }
});
