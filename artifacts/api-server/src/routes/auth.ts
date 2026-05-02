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

  if (account.role === "student") {
    const [studentRecord] = await db.select().from(studentsTable).where(eq(studentsTable.accountId, account.id));
    if (studentRecord) {
      req.session.studentId = studentRecord.id;
      req.session.teacherAccountId = studentRecord.teacherAccountId;
    }
  }

  res.json({
    id: account.id,
    username: account.username,
    displayName: account.displayName || account.username,
    role: account.role,
    teacherAccountId: account.teacherAccountId ?? null,
    studentId: req.session.studentId ?? null,
  });
});

router.post("/auth/activate", async (req, res): Promise<void> => {
  const { studentCode, studentName, password, confirmPassword } = req.body;
  if (!studentCode?.trim() || !studentName?.trim() || !password) {
    res.status(400).json({ message: "Student code, name, and password are required" }); return;
  }
  if (password !== confirmPassword) {
    res.status(400).json({ message: "Passwords do not match" }); return;
  }
  if (password.length < 6) {
    res.status(400).json({ message: "Password must be at least 6 characters" }); return;
  }
  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.studentCode, studentCode.trim().toUpperCase()));
  if (!student) { res.status(404).json({ message: "Student code not found. Contact your teacher." }); return; }
  const inputName = studentName.trim().toUpperCase();
  const storedName = (student.studentName || "").toUpperCase();
  if (inputName !== storedName) {
    res.status(400).json({ message: "Name does not match our records. Enter your name exactly as given." }); return;
  }
  if (student.accountId) {
    res.status(409).json({ message: "Account already activated. Please sign in." }); return;
  }
  const username = studentCode.trim().toLowerCase();
  const [existing] = await db.select().from(accountsTable).where(eq(accountsTable.username, username));
  if (existing) { res.status(409).json({ message: "An account with this code already exists. Try signing in." }); return; }
  const passwordHash = await bcrypt.hash(password, 10);
  const [account] = await db.insert(accountsTable).values({
    username,
    passwordHash,
    displayName: student.studentName,
    role: "student",
    status: "active",
    teacherAccountId: student.teacherAccountId ?? null,
  }).returning();
  await db.update(studentsTable).set({ accountId: account.id }).where(eq(studentsTable.id, student.id));
  req.session.accountId = account.id;
  req.session.username = account.username;
  req.session.displayName = account.displayName || account.username;
  req.session.role = "student";
  req.session.teacherAccountId = student.teacherAccountId ?? null;
  req.session.studentId = student.id;
  res.status(201).json({
    id: account.id,
    username: account.username,
    displayName: account.displayName,
    role: "student",
    teacherAccountId: student.teacherAccountId ?? null,
    studentId: student.id,
  });
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => res.json({ message: "Logged out" }));
});

router.get("/auth/me", (req, res): void => {
  if (!req.session.accountId) { res.status(401).json({ message: "Not authenticated" }); return; }
  res.json({
    id: req.session.accountId,
    username: req.session.username,
    displayName: req.session.displayName,
    role: req.session.role || "admin",
    teacherAccountId: req.session.teacherAccountId ?? null,
    studentId: req.session.studentId ?? null,
  });
});

export default router;
export { };
