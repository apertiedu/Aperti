import { Router } from "express";
import { pool } from "@workspace/db";
import { authenticate, AuthRequest } from "../middleware/auth";

export const workspaceRouter = Router();

(async () => {
  const migrations = [
    `CREATE TABLE IF NOT EXISTS workspaces (
      id          serial PRIMARY KEY,
      name        text NOT NULL,
      type        text NOT NULL DEFAULT 'teacher',
      owner_id    integer NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      description text,
      created_at  timestamptz NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS workspace_roles (
      id            serial PRIMARY KEY,
      workspace_id  integer NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name          text NOT NULL,
      permissions   text[] NOT NULL DEFAULT '{}',
      is_default    boolean NOT NULL DEFAULT false,
      created_at    timestamptz NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS workspace_members (
      id            serial PRIMARY KEY,
      workspace_id  integer NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      account_id    integer NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      role_id       integer REFERENCES workspace_roles(id),
      joined_at     timestamptz NOT NULL DEFAULT NOW(),
      UNIQUE(workspace_id, account_id)
    )`,
  ];
  for (const m of migrations) await pool.query(m).catch(() => {});
})();

const PERMISSIONS_LIST = [
  { name: "create_course",      label: "Create Course" },
  { name: "edit_course",        label: "Edit Course" },
  { name: "delete_course",      label: "Delete Course" },
  { name: "create_assignment",  label: "Create Assignment" },
  { name: "grade_assignment",   label: "Grade Assignment" },
  { name: "view_students",      label: "View Students" },
  { name: "manage_students",    label: "Manage Students" },
  { name: "manage_attendance",  label: "Manage Attendance" },
  { name: "view_analytics",     label: "View Analytics" },
  { name: "view_finance",       label: "View Finance" },
  { name: "manage_users",       label: "Manage Users" },
  { name: "manage_workspace",   label: "Manage Workspace" },
  { name: "send_messages",      label: "Send Messages" },
];

workspaceRouter.get("/permissions", (_req: AuthRequest, res: any) => {
  res.json(PERMISSIONS_LIST);
});

workspaceRouter.get("/mine", authenticate, async (req: AuthRequest, res: any) => {
  try {
    const { rows } = await pool.query(
      `SELECT w.*, a.display_name AS owner_name,
         (SELECT COUNT(*) FROM workspace_members WHERE workspace_id=w.id) AS member_count
       FROM workspaces w
       JOIN accounts a ON w.owner_id=a.id
       WHERE w.owner_id=$1
          OR w.id IN (SELECT workspace_id FROM workspace_members WHERE account_id=$1)
       ORDER BY w.created_at DESC`,
      [req.userId]
    );
    res.json(rows);
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

workspaceRouter.post("/", authenticate, async (req: AuthRequest, res: any) => {
  try {
    const { name, type, description } = req.body;
    if (!name?.trim()) { res.status(400).json({ error: "Workspace name is required" }); return; }
    const { rows } = await pool.query(
      `INSERT INTO workspaces (name, type, owner_id, description) VALUES ($1, $2, $3, $4) RETURNING *`,
      [name.trim(), type || "teacher", req.userId, description || null]
    );
    await pool.query(
      `INSERT INTO workspace_members (workspace_id, account_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [rows[0].id, req.userId]
    );
    res.status(201).json(rows[0]);
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

workspaceRouter.get("/:id", authenticate, async (req: AuthRequest, res: any) => {
  try {
    const { rows } = await pool.query(
      `SELECT w.*, a.display_name AS owner_name FROM workspaces w
       JOIN accounts a ON w.owner_id=a.id WHERE w.id=$1`,
      [parseInt(req.params.id)]
    );
    if (!rows.length) { res.status(404).json({ error: "Workspace not found" }); return; }
    res.json(rows[0]);
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

workspaceRouter.get("/:id/roles", authenticate, async (req: AuthRequest, res: any) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM workspace_roles WHERE workspace_id=$1 ORDER BY name ASC`,
      [parseInt(req.params.id)]
    );
    res.json(rows);
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

workspaceRouter.post("/:id/roles", authenticate, async (req: AuthRequest, res: any) => {
  try {
    const { name, permissions } = req.body;
    if (!name?.trim()) { res.status(400).json({ error: "Role name is required" }); return; }
    const { rows } = await pool.query(
      `INSERT INTO workspace_roles (workspace_id, name, permissions) VALUES ($1, $2, $3) RETURNING *`,
      [parseInt(req.params.id), name.trim(), permissions || []]
    );
    res.status(201).json(rows[0]);
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});

workspaceRouter.get("/:id/members", authenticate, async (req: AuthRequest, res: any) => {
  try {
    const { rows } = await pool.query(
      `SELECT wm.*, a.display_name, a.username, a.role, a.email, wr.name AS role_name
       FROM workspace_members wm
       JOIN accounts a ON wm.account_id=a.id
       LEFT JOIN workspace_roles wr ON wm.role_id=wr.id
       WHERE wm.workspace_id=$1 ORDER BY wm.joined_at ASC`,
      [parseInt(req.params.id)]
    );
    res.json(rows);
  } catch (err: any) { res.status(500).json({ error: "An unexpected error occurred" }); }
});
