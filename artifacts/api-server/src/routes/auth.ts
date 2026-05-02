import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, accountsTable, studentsTable } from "@workspace/db";

declare module "express-session" {
  interface SessionData {
    accountId: number;
    username: string;
    displayName: string;
    role: string;
    teacherAccountId: number | null;
    studentId: number | null;
  }
}

const router: IRouter = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const { username, password } = req.body;
  if (!username || !password) { res.status(400).json({ message: "Username and password are required" }); return; }

  const [account] = await db.select().from(accountsTable).where(eq(accountsTable.username, username.trim().toLowerCase()));
  if (!account) { res.status(401).json({ message: "Invalid username or password" }); return; }
  if (account.status === "suspended") { res.status(403).json({ message: "Account suspended. Contact your administrator." }); return; }

  const valid = await bcrypt.compare(password, account.passwordHash);
  if (!valid) { res.status(401).json({ message: "Invalid username or password" }); return; }

  req.session.accountId = account.id;
  req.session.username = account.username;
  req.session.displayName = account.displayName || account.username;
  req.session.role = account.role;
  req.session.teacherAccountId = account.teacherAccountId ?? null;
  req.session.studentId = null;

  // If student role, link to student record
  if (account.role === "student") {
    const [studentRecord] = await db.select().from(studentsTable).where(eq(studentsTable.accountId, account.id));
    if (studentRecord) {
      req.session.studentId = studentRecord.id;
      req.session.teacherAccountId = studentRecord.teacherAccountId;
    }
  }

  res.json({
    username: account.username,
    displayName: account.displayName || account.username,
    role: account.role,
    teacherAccountId: account.teacherAccountId ?? null,
    studentId: req.session.studentId ?? null,
  });
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => res.json({ message: "Logged out" }));
});

router.get("/auth/me", (req, res): void => {
  if (!req.session.accountId) { res.status(401).json({ message: "Not authenticated" }); return; }
  res.json({
    username: req.session.username,
    displayName: req.session.displayName,
    role: req.session.role || "admin",
    teacherAccountId: req.session.teacherAccountId ?? null,
    studentId: req.session.studentId ?? null,
  });
});

export default router;
export { };
