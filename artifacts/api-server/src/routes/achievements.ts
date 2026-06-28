import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { requireStudentAccess, requireTenantAccess } from "../middleware/tenant";

const router: IRouter = Router();

const ACHIEVEMENT_DEFS = [
  { key: "first_login",    name: "First Step",       desc: "Welcome to Aperti!",                      xp: 10,  icon: "🎉" },
  { key: "perfect_week",   name: "Perfect Week",     desc: "100% attendance for a full week",          xp: 50,  icon: "⭐" },
  { key: "streak_7",       name: "7-Day Streak",     desc: "7 consecutive days of flashcard reviews",  xp: 75,  icon: "🔥" },
  { key: "streak_30",      name: "30-Day Warrior",   desc: "Consistent learner for 30 days",          xp: 200, icon: "💪" },
  { key: "consistent",     name: "Consistent",       desc: "Maintained 80%+ attendance",               xp: 75,  icon: "📅" },
  { key: "top_scorer",     name: "Top Scorer",       desc: "Achieved the highest exam score",          xp: 100, icon: "🏆" },
  { key: "rising_star",    name: "Rising Star",      desc: "Improved exam score by 15%+",              xp: 80,  icon: "🌟" },
  { key: "flash_master",   name: "Flash Master",     desc: "Reviewed 20+ flashcards",                  xp: 40,  icon: "🧠" },
  { key: "exam_ready",     name: "Exam Ready",       desc: "Completed 3+ practice sessions",           xp: 60,  icon: "📝" },
  { key: "goal_achieved",  name: "Goal Achieved",    desc: "Hit a personal target",                    xp: 100, icon: "🎯" },
  { key: "attendance_90",  name: "Attendance Hero",  desc: "90%+ overall attendance rate",             xp: 150, icon: "🦸" },
  { key: "full_marks",     name: "Full Marks",       desc: "Scored 100% on an exam",                   xp: 120, icon: "💯" },
];

function xpToLevel(xp: number): { level: number; title: string; nextXp: number } {
  const thresholds = [
    { level: 1, title: "Beginner",   nextXp: 100 },
    { level: 2, title: "Learner",    nextXp: 300 },
    { level: 3, title: "Student",    nextXp: 600 },
    { level: 4, title: "Scholar",    nextXp: 1000 },
    { level: 5, title: "Academic",   nextXp: 2000 },
    { level: 6, title: "Elite",      nextXp: 99999 },
  ];
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (i === 0 || xp >= thresholds[i - 1].nextXp) {
      return thresholds[i];
    }
  }
  return thresholds[0];
}

async function awardAchievement(studentId: number, key: string): Promise<boolean> {
  const def = ACHIEVEMENT_DEFS.find(a => a.key === key);
  if (!def) return false;
  try {
    const { rowCount } = await pool.query(
      `INSERT INTO student_achievements (student_id, achievement_key, achievement_name, description, xp_points)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (student_id, achievement_key) DO NOTHING`,
      [studentId, key, def.name, def.desc, def.xp]
    );
    if (rowCount && rowCount > 0) {
      await pool.query(`
        INSERT INTO student_xp (student_id, total_xp, level, updated_at)
        VALUES ($1, $2, 1, NOW())
        ON CONFLICT (student_id) DO UPDATE SET
          total_xp = student_xp.total_xp + $2,
          updated_at = NOW()
      `, [studentId, def.xp]);
      const { rows } = await pool.query(`SELECT total_xp FROM student_xp WHERE student_id=$1`, [studentId]);
      const totalXp = parseInt(rows[0]?.total_xp ?? "0", 10);
      const { level } = xpToLevel(totalXp);
      await pool.query(`UPDATE student_xp SET level=$1 WHERE student_id=$2`, [level, studentId]);
      return true;
    }
    return false;
  } catch { return false; }
}

router.get("/portal/achievements", requireStudentAccess, async (req, res): Promise<void> => {
  
  const studentId: number = (req as any).studentId;

  const [{ rows: earned }, { rows: xpRows }] = await Promise.all([
    pool.query(`SELECT * FROM student_achievements WHERE student_id=$1 ORDER BY earned_at DESC`, [studentId]),
    pool.query(`SELECT * FROM student_xp WHERE student_id=$1`, [studentId]),
  ]);

  const totalXp = parseInt(xpRows[0]?.total_xp ?? "0", 10);
  const { level, title, nextXp } = xpToLevel(totalXp);
  const earnedKeys = new Set(earned.map((a: any) => a.achievement_key));
  const prevNextXp = level > 1 ? [0, 100, 300, 600, 1000, 2000][level - 1] : 0;
  const progressInLevel = totalXp - prevNextXp;
  const rangeInLevel = nextXp - prevNextXp;
  const levelProgress = Math.min(100, Math.round((progressInLevel / rangeInLevel) * 100));

  const allDefs = ACHIEVEMENT_DEFS.map(def => ({
    ...def,
    earned: earnedKeys.has(def.key),
    earnedAt: earned.find((a: any) => a.achievement_key === def.key)?.earned_at ?? null,
  }));

  res.json({ totalXp, level, levelTitle: title, nextLevelXp: nextXp, levelProgress, achievements: allDefs });
});

router.post("/portal/achievements/check", requireStudentAccess, async (req, res): Promise<void> => {
  
  const studentId: number = (req as any).studentId;
  const teacherId: number = (req as any).teacherAccountId;
  const newlyEarned: string[] = [];

  await awardAchievement(studentId, "first_login");

  const { rows: attRows } = await pool.query(`
    SELECT 
      ROUND(COUNT(CASE WHEN status='present' THEN 1 END)::numeric / NULLIF(COUNT(*),0)*100,1) AS overall_rate,
      COUNT(CASE WHEN DATE_TRUNC('week', date::date) = DATE_TRUNC('week', CURRENT_DATE) AND status='present' THEN 1 END) AS week_present,
      COUNT(CASE WHEN DATE_TRUNC('week', date::date) = DATE_TRUNC('week', CURRENT_DATE) THEN 1 END) AS week_total
    FROM attendance WHERE student_id=$1
  `, [studentId]);

  const overallRate = parseFloat(attRows[0]?.overall_rate ?? "0");
  const weekPresent = parseInt(attRows[0]?.week_present ?? "0", 10);
  const weekTotal = parseInt(attRows[0]?.week_total ?? "0", 10);

  if (weekTotal > 0 && weekPresent === weekTotal) {
    if (await awardAchievement(studentId, "perfect_week")) newlyEarned.push("Perfect Week");
  }
  if (overallRate >= 80) {
    if (await awardAchievement(studentId, "consistent")) newlyEarned.push("Consistent");
  }
  if (overallRate >= 90) {
    if (await awardAchievement(studentId, "attendance_90")) newlyEarned.push("Attendance Hero");
  }

  const { rows: examRows } = await pool.query(`
    SELECT 
      ROUND(SUM(sm.marks_scored) / NULLIF(SUM(eq.max_marks),0)*100, 1) AS pct,
      e.id AS exam_id
    FROM student_marks sm
    JOIN exam_questions eq ON eq.id=sm.question_id
    JOIN exams e ON e.id=sm.exam_id
    WHERE sm.student_id=$1
    GROUP BY e.id ORDER BY e.id DESC LIMIT 6
  `, [studentId]);

  if (examRows.length >= 2) {
    const latest = parseFloat(examRows[0]?.pct ?? "0");
    const prev = parseFloat(examRows[1]?.pct ?? "0");
    if (prev > 0 && latest >= prev * 1.15) {
      if (await awardAchievement(studentId, "rising_star")) newlyEarned.push("Rising Star");
    }
    if (latest >= 99.9) {
      if (await awardAchievement(studentId, "full_marks")) newlyEarned.push("Full Marks");
    }
  }

  if (examRows.length >= 1 && teacherId) {
    const { rows: topRows } = await pool.query(`
      SELECT student_id, ROUND(SUM(sm.marks_scored)/NULLIF(SUM(eq.max_marks),0)*100,1) AS pct
      FROM student_marks sm
      JOIN exam_questions eq ON eq.id=sm.question_id
      JOIN exams e ON e.id=sm.exam_id
      JOIN students st ON st.id=sm.student_id
      WHERE e.id=$1 AND st.teacher_account_id=$2
      GROUP BY student_id ORDER BY pct DESC LIMIT 1
    `, [examRows[0]?.exam_id, teacherId]);
    if (topRows[0]?.student_id === studentId) {
      if (await awardAchievement(studentId, "top_scorer")) newlyEarned.push("Top Scorer");
    }
  }

  const { rows: flashRows } = await pool.query(`
    SELECT SUM(reps)::int AS total_reviews FROM flashcard_progress WHERE student_id=$1
  `, [studentId]);
  if (parseInt(flashRows[0]?.total_reviews ?? "0", 10) >= 20) {
    if (await awardAchievement(studentId, "flash_master")) newlyEarned.push("Flash Master");
  }

  const { rows: practiceRows } = await pool.query(`
    SELECT COUNT(*)::int AS sessions FROM practice_sessions WHERE student_id=$1 AND completed_at IS NOT NULL
  `, [studentId]);
  if (parseInt(practiceRows[0]?.sessions ?? "0", 10) >= 3) {
    if (await awardAchievement(studentId, "exam_ready")) newlyEarned.push("Exam Ready");
  }

  const { rows: goalRows } = await pool.query(`
    SELECT COUNT(*)::int AS cnt FROM student_goals WHERE student_id=$1 AND is_active=false
  `, [studentId]);
  if (parseInt(goalRows[0]?.cnt ?? "0", 10) >= 1) {
    if (await awardAchievement(studentId, "goal_achieved")) newlyEarned.push("Goal Achieved");
  }

  res.json({ newlyEarned });
});

router.get("/portal/leaderboard", requireStudentAccess, async (req, res): Promise<void> => {
  
  const studentId: number = (req as any).studentId;
  const teacherId: number = (req as any).teacherAccountId;

  const { rows } = await pool.query(`
    SELECT 
      sx.student_id,
      sx.total_xp,
      sx.level,
      st.student_name,
      st.student_code,
      RANK() OVER (ORDER BY sx.total_xp DESC)::int AS rank
    FROM student_xp sx
    JOIN students st ON st.id = sx.student_id
    WHERE st.teacher_account_id = $1
    ORDER BY sx.total_xp DESC
    LIMIT 20
  `, [teacherId]);

  res.json({ leaderboard: rows, myStudentId: studentId });
});

router.get("/achievements/badges", requireStudentAccess, async (req, res): Promise<void> => {
  const studentId: number = (req as any).studentId;

  const { rows: earned } = await pool.query(
    `SELECT achievement_key FROM student_achievements WHERE student_id=$1`,
    [studentId],
  );
  const earnedKeys = new Set(earned.map((a: any) => a.achievement_key));

  const ICON_TYPE_MAP: Record<string, string> = {
    flash_master: "flashcard",
    streak_7: "streak",
    streak_30: "streak",
    top_scorer: "trophy",
    full_marks: "trophy",
    rising_star: "target",
    exam_ready: "exam",
    goal_achieved: "target",
    attendance_90: "attendance",
    consistent: "attendance",
    perfect_week: "attendance",
    first_login: "circuit",
  };

  const badges = ACHIEVEMENT_DEFS.map((def) => ({
    id: def.key,
    name: def.name,
    description: def.desc,
    xp: def.xp,
    icon_type: ICON_TYPE_MAP[def.key] ?? "trophy",
    earned: earnedKeys.has(def.key),
  }));

  res.json(badges);
});

export default router;
