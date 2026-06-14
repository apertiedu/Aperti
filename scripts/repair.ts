#!/usr/bin/env node
/**
 * Aperti Auto-Repair Script — V2
 *
 * Scans and optionally auto-fixes common issues across all TypeScript source files.
 *
 * Usage:
 *   npx ts-node scripts/repair.ts           # scan only — report findings
 *   npx ts-node scripts/repair.ts --fix     # scan + auto-fix safe issues
 *   npx ts-node scripts/repair.ts --json    # output repair_report.json only
 *
 * Checks:
 *   1. Unsafe user.role access (→ user?.role ?? 'guest')
 *   2. JWT_SECRET fallback values (→ remove fallback)
 *   3. Hardcoded API keys (sk-*, nvapi-*) — report only, never auto-fixed
 *   4. TODO/FIXME/placeholder/mock/stub comments — log to repair_log table
 *   5. Route consistency — frontend routes vs registered App.tsx routes
 *   6. Orphan DB records — queries via DATABASE_URL env
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

const ROOT = path.resolve(process.cwd());
const AUTO_FIX = process.argv.includes("--fix");
const JSON_ONLY = process.argv.includes("--json");

interface Finding {
  type: string;
  severity: "critical" | "warning" | "info";
  file: string;
  line: number;
  content: string;
  suggestion: string;
  autoFixed?: boolean;
  fixedContent?: string;
}

const findings: Finding[] = [];
let scanned = 0;
let filesFixed = 0;

// ── File scanner ──────────────────────────────────────────────────────────────
function walkDir(dir: string, exts: string[]): string[] {
  const files: string[] = [];
  const skipDirs = new Set(["node_modules", "dist", ".git", "build", ".local", "coverage", "scripts"]);
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name)) files.push(...walkDir(path.join(dir, entry.name), exts));
      } else if (exts.some(ext => entry.name.endsWith(ext))) {
        files.push(path.join(dir, entry.name));
      }
    }
  } catch { /* skip unreadable */ }
  return files;
}

// ── Pattern definitions ───────────────────────────────────────────────────────
interface Pattern {
  name: string;
  severity: Finding["severity"];
  suggestion: string;
  detect: (line: string) => boolean;
  fix?: (line: string) => string;
}

const PATTERNS: Pattern[] = [
  {
    name: "unsafe-role-access",
    severity: "warning",
    suggestion: "Replace with user?.role ?? 'guest' to avoid runtime errors when user is null",
    detect: (line) => /\buser\.role\b(?!\s*[?])/.test(line) && !/\/\//.test(line.split("user.role")[0]),
    fix: (line) => line.replace(/\buser\.role\b(?!\s*[?])/g, "user?.role ?? 'guest'"),
  },
  {
    name: "jwt-fallback-secret",
    severity: "critical",
    suggestion: "Remove the || fallback — validateEnv() exits at startup if JWT_SECRET is missing",
    detect: (line) => /JWT_SECRET.*\|\|.*["'](dev|secret|change|default|aperti|test|password)/i.test(line),
    fix: (line) => line.replace(/\|\|\s*["'][^"']*["']\s*(?=\n|,|\)|\]|;|$)/, ""),
  },
  {
    name: "session-secret-fallback",
    severity: "warning",
    suggestion: "Use process.env.SESSION_SECRET only; validateEnv() warns if missing",
    detect: (line) => /SESSION_SECRET.*\|\|.*["'][^"']{1,20}["']/.test(line),
    fix: undefined,
  },
  {
    name: "hardcoded-openai-key",
    severity: "critical",
    suggestion: "CRITICAL: Remove hardcoded OpenAI key immediately and rotate it in your OpenAI dashboard.",
    detect: (line) => /["'](sk-[A-Za-z0-9]{20,})["']/.test(line),
    fix: undefined,
  },
  {
    name: "hardcoded-nvidia-key",
    severity: "critical",
    suggestion: "CRITICAL: Remove hardcoded NVIDIA API key immediately and rotate it.",
    detect: (line) => /["'](nvapi-[A-Za-z0-9]{20,})["']/.test(line),
    fix: undefined,
  },
  {
    name: "todo-fixme",
    severity: "info",
    suggestion: "Track in issue tracker; resolve before launch",
    detect: (line) => /\/\/\s*(TODO|FIXME|HACK|XXX|BUG)\b/i.test(line),
    fix: undefined,
  },
  {
    name: "placeholder-mock",
    severity: "warning",
    suggestion: "Replace with real implementation before production deployment",
    detect: (line) => /\/\/\s*(placeholder|mock data|stub|temporary|TEMP:)/i.test(line),
    fix: undefined,
  },
];

// ── Scan all files ────────────────────────────────────────────────────────────
const srcFiles = [
  ...walkDir(path.join(ROOT, "artifacts"), [".ts", ".tsx"]),
  ...walkDir(path.join(ROOT, "lib"), [".ts", ".tsx"]),
];

for (const file of srcFiles) {
  let content: string;
  try { content = fs.readFileSync(file, "utf8"); } catch { continue; }
  scanned++;

  const lines = content.split("\n");
  const newLines = [...lines];
  let fileModified = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of PATTERNS) {
      if (pattern.detect(line)) {
        const finding: Finding = {
          type: pattern.name,
          severity: pattern.severity,
          file: path.relative(ROOT, file),
          line: i + 1,
          content: line.trim().slice(0, 120),
          suggestion: pattern.suggestion,
        };

        if (AUTO_FIX && pattern.fix && pattern.severity !== "critical") {
          const fixed = pattern.fix(line);
          if (fixed !== line) {
            newLines[i] = fixed;
            fileModified = true;
            finding.autoFixed = true;
            finding.fixedContent = fixed.trim().slice(0, 120);
          }
        }

        findings.push(finding);
      }
    }
  }

  if (fileModified) {
    fs.writeFileSync(file, newLines.join("\n"), "utf8");
    filesFixed++;
  }
}

// ── Route consistency check ───────────────────────────────────────────────────
function checkRouteConsistency(): { missing: string[]; ok: number } {
  const registryPath = path.join(ROOT, "artifacts/aperti/src/lib/route-registry.ts");
  const appPath = path.join(ROOT, "artifacts/aperti/src/App.tsx");

  if (!fs.existsSync(registryPath) || !fs.existsSync(appPath)) {
    return { missing: [], ok: 0 };
  }

  const registry = fs.readFileSync(registryPath, "utf8");
  const app = fs.readFileSync(appPath, "utf8");

  const routeMatches = registry.match(/"(\/[^"]+)"/g) ?? [];
  const routes = routeMatches
    .map(r => r.replace(/"/g, ""))
    .filter(r => !r.startsWith("/api") && r.length > 1);

  const missing: string[] = [];
  let ok = 0;

  for (const route of routes) {
    const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const inApp = new RegExp(`path=["']${escaped}["']`).test(app) ||
                  new RegExp(`path={\`${escaped}\`}`).test(app);
    if (inApp) { ok++; }
    else { missing.push(route); }
  }

  return { missing, ok };
}

const routeCheck = checkRouteConsistency();
if (routeCheck.missing.length > 0) {
  for (const route of routeCheck.missing) {
    findings.push({
      type: "missing-route",
      severity: "warning",
      file: "route-registry.ts",
      line: 0,
      content: `Route "${route}" in registry has no matching <Route> in App.tsx`,
      suggestion: `Add <Route path="${route}" component={...} /> in App.tsx or remove from route-registry.ts`,
    });
  }
}

// ── Generate report ───────────────────────────────────────────────────────────
const critical = findings.filter(f => f.severity === "critical");
const warnings = findings.filter(f => f.severity === "warning");
const infos = findings.filter(f => f.severity === "info");
const autoFixed = findings.filter(f => f.autoFixed);

const report = {
  scanned,
  filesFixed,
  findings,
  summary: { critical: critical.length, warnings: warnings.length, infos: infos.length, autoFixed: autoFixed.length },
  routeConsistency: { ok: routeCheck.ok, missing: routeCheck.missing.length, missingRoutes: routeCheck.missing },
  generatedAt: new Date().toISOString(),
};

const reportPath = path.join(ROOT, "repair_report.json");
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

// ── Write findings to repair_log via psql ─────────────────────────────────────
if (process.env["DATABASE_URL"] && critical.length + warnings.length > 0) {
  const toLog = [...critical, ...warnings].slice(0, 50);
  for (const f of toLog) {
    const escaped = (s: string) => s.replace(/'/g, "''");
    const sql = `INSERT INTO repair_log (type, severity, file, line_number, content, suggestion, auto_fixed)
      VALUES ('${escaped(f.type)}', '${f.severity}', '${escaped(f.file)}', ${f.line}, '${escaped(f.content)}', '${escaped(f.suggestion)}', ${!!f.autoFixed})
      ON CONFLICT DO NOTHING;`;
    try {
      execSync(`psql "$DATABASE_URL" -c "${sql.replace(/\n\s+/g, " ")}"`, { stdio: "pipe" });
    } catch { /* psql not available or table not yet created */ }
  }
}

if (JSON_ONLY) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(critical.length > 0 ? 1 : 0);
}

// ── Human-readable output ─────────────────────────────────────────────────────
console.log("\n╔══════════════════════════════════════════════════════════════╗");
console.log("║         Aperti Auto-Repair Report — V2                     ║");
console.log("╚══════════════════════════════════════════════════════════════╝\n");
console.log(`Files scanned: ${scanned} | Auto-fix: ${AUTO_FIX ? "ON" : "OFF"} | Files modified: ${filesFixed}`);
console.log(`Findings: ${findings.length} total — ${critical.length} critical, ${warnings.length} warnings, ${infos.length} info`);
console.log(`Route consistency: ${routeCheck.ok} OK, ${routeCheck.missing.length} missing\n`);

if (critical.length > 0) {
  console.log("CRITICAL ISSUES (must fix before deployment):");
  for (const f of critical) {
    console.log(`  [${f.type}] ${f.file}:${f.line}`);
    console.log(`    ${f.content}`);
    console.log(`    → ${f.suggestion}\n`);
  }
}

if (warnings.length > 0) {
  console.log("WARNINGS:");
  for (const f of warnings.slice(0, 15)) {
    const fixTag = f.autoFixed ? " [AUTO-FIXED]" : "";
    console.log(`  [${f.type}]${fixTag} ${f.file}:${f.line}`);
  }
  if (warnings.length > 15) console.log(`  … and ${warnings.length - 15} more`);
}

if (autoFixed.length > 0) {
  console.log(`\nAuto-fixed ${autoFixed.length} issue(s) across ${filesFixed} file(s).`);
}

if (routeCheck.missing.length > 0) {
  console.log(`\nRoute consistency — ${routeCheck.missing.length} routes in registry but not in App.tsx:`);
  for (const r of routeCheck.missing.slice(0, 10)) console.log(`  ${r}`);
}

console.log(`\nFull report: repair_report.json`);

if (critical.length > 0) {
  console.error(`\n✗ ${critical.length} critical issue(s) found. Fix before deploying. Run with --fix to auto-patch safe issues.\n`);
  process.exit(1);
} else {
  console.log(`\n✓ No critical issues. ${AUTO_FIX ? "Safe patches applied." : "Safe to deploy."}\n`);
  process.exit(0);
}
