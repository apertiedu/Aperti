import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { pool } from "@workspace/db";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("[auth] FATAL: JWT_SECRET environment variable is not set. The server cannot operate securely without it.");
  process.exit(1);
}

export interface AuthRequest extends Request<Record<string, string>> {
  userId?: number;
  role?: string;
}

// Short-lived in-memory cache: userId → { status, expiresAt }
// Prevents a DB query on every single authenticated request while still
// invalidating within 60 s of a suspension/deletion event.
const statusCache = new Map<number, { status: string; expiresAt: number }>();
const STATUS_TTL_MS = 60_000;

async function checkAccountActive(userId: number): Promise<boolean> {
  const now = Date.now();
  const cached = statusCache.get(userId);
  if (cached && cached.expiresAt > now) {
    return cached.status === "active";
  }
  try {
    const { rows } = await pool.query("SELECT status FROM accounts WHERE id=$1 LIMIT 1", [userId]);
    const status: string = rows[0]?.status ?? "deleted";
    statusCache.set(userId, { status, expiresAt: now + STATUS_TTL_MS });
    return status === "active";
  } catch {
    // On DB error fall through — don't lock users out due to transient failures
    return true;
  }
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const cookieToken = (req as any).cookies?.aperti_token as string | undefined;
  const header = req.headers.authorization;
  const raw = cookieToken || (header?.startsWith("Bearer ") ? header.slice(7) : null);

  if (!raw) {
    return res.status(401).json({ error: "Missing token" });
  }
  try {
    const payload = jwt.verify(raw, JWT_SECRET) as any;
    if (!payload || typeof payload !== "object" || !payload.id || !payload.role) {
      return res.status(401).json({ error: "Invalid token payload" });
    }
    // Reject pre-auth (MFA-pending) tokens from accessing protected resources
    if (payload.stage === "mfa_pending") {
      return res.status(401).json({ error: "MFA verification required" });
    }
    req.userId = payload.id;
    req.role = payload.role;

    // Check account is still active (suspended/deleted accounts are rejected
    // even if their JWT has not expired yet)
    checkAccountActive(payload.id).then((active) => {
      if (!active) {
        return res.status(401).json({ error: "Account suspended or deleted", suspended: true });
      }
      next();
    }).catch(() => next());
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.role || !roles.includes(req.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}
