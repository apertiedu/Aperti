import { pool } from "@workspace/db";

let _cache: boolean | null = null;
let _lastChecked = 0;
const CACHE_TTL_MS = 30_000;

export async function isSafeModeEnabled(): Promise<boolean> {
  const now = Date.now();
  if (_cache !== null && now - _lastChecked < CACHE_TTL_MS) return _cache;

  try {
    const { rows } = await pool.query(
      `SELECT enabled FROM feature_flags WHERE name = 'safe_mode' LIMIT 1`,
    );
    _cache = rows[0]?.enabled ?? false;
    _lastChecked = now;
    return _cache;
  } catch {
    return false;
  }
}

export async function setSafeMode(enabled: boolean): Promise<void> {
  await pool.query(
    `INSERT INTO feature_flags
       (name, description, enabled, status, created_at, updated_at)
     VALUES ('safe_mode', 'Platform safe mode — reduces AI complexity, disables non-critical features', $1, 'enabled', NOW(), NOW())
     ON CONFLICT (name) DO UPDATE SET enabled = $1, updated_at = NOW()`,
    [enabled],
  );
  _cache = enabled;
  _lastChecked = Date.now();
}

export function invalidateSafeModeCache(): void {
  _cache = null;
  _lastChecked = 0;
}

export async function getSafeModeStatus(): Promise<{
  enabled: boolean;
  since: string | null;
}> {
  try {
    const { rows } = await pool.query(
      `SELECT enabled, updated_at FROM feature_flags WHERE name = 'safe_mode' LIMIT 1`,
    );
    return {
      enabled: rows[0]?.enabled ?? false,
      since: rows[0]?.updated_at ?? null,
    };
  } catch {
    return { enabled: false, since: null };
  }
}
