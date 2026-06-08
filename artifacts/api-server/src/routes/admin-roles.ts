import { Router, Request, Response } from "express";
import { requireRole } from "../middleware/auth";

export const adminRolesRouter = Router();
adminRolesRouter.use(requireRole("admin", "super_admin"));

const SYSTEM_ROLES = [
  { id: "admin", name: "Admin", description: "Full platform access", isSystem: true, permissions: ["all"] },
  { id: "teacher", name: "Teacher", description: "Manage own classes, students, content", isSystem: true, permissions: ["courses:manage", "students:view", "lessons:manage", "homework:manage", "exams:manage", "attendance:manage"] },
  { id: "student", name: "Student", description: "Access learning content", isSystem: true, permissions: ["courses:view", "homework:submit", "exams:take", "flashcards:use"] },
  { id: "parent", name: "Parent", description: "Monitor child progress", isSystem: true, permissions: ["children:view", "grades:view", "attendance:view", "messages:send"] },
  { id: "assistant", name: "Assistant", description: "Limited teacher capabilities", isSystem: true, permissions: ["students:view", "attendance:manage", "homework:view"] },
];

const PERMISSIONS_BY_MODULE: Record<string, string[]> = {
  users: ["users:view", "users:create", "users:edit", "users:delete", "users:suspend"],
  courses: ["courses:view", "courses:create", "courses:manage", "courses:publish", "courses:delete"],
  students: ["students:view", "students:create", "students:manage", "students:export"],
  homework: ["homework:view", "homework:create", "homework:manage", "homework:grade"],
  exams: ["exams:view", "exams:create", "exams:manage", "exams:take", "exams:grade"],
  attendance: ["attendance:view", "attendance:manage", "attendance:export"],
  payments: ["payments:view", "payments:verify", "payments:manage"],
  analytics: ["analytics:view", "analytics:export"],
  settings: ["settings:view", "settings:manage"],
  audit: ["audit:view", "audit:export"],
};

adminRolesRouter.get("/", (_req, res) => {
  res.json(SYSTEM_ROLES);
});

adminRolesRouter.get("/permissions", (_req, res) => {
  res.json(PERMISSIONS_BY_MODULE);
});
