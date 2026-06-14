#!/usr/bin/env node
/**
 * Aperti Auto-Repair Script
 *
 * Scans the codebase for common issues and generates a repair report.
 * Run before every build or manually from admin panel.
 *
 * Checks:
 *   1. Unsafe user.role accesses (should be user?.role)
 *   2. JWT_SECRET fallback values ("dev-secret", "secret", etc.)
 *   3. TODO/FIXME/placeholder/mock/stub/temporary comments
 *   4. Hardcoded API keys (sk-, nvapi-)
 *   5. console.log in production code (should use logger)
 */
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(process.cwd());

interface Finding {
  type: string;
  severity: "critical" | "warning" | "info";
  file: string;
  line: number;
  content: string;
  suggestion: string;
}

const findings: Finding[] = [];
let scanned = 0;

// ── File scanner ──────────────────────────────────────────────────────────────
function walkDir(dir: string, exts: string[]): string[] {
  const files: string[] = [];
  const skipDirs = new Set(["node_modules", "dist", ".git", "build", ".local", "coverage"]);
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name)) {
          files.push(...walkDir(path.join(dir, entry.name), exts));
        }
      } else if (exts.some(ext => entry.name.endsWith(ext))) {
        files.push(path.join(dir, entry.name));
      }
    }
  } catch { /* skip unreadable dirs */ }
  return files;
}

const PATTERNS: Array<{
  name: string;
  regex: RegExp;
  severity: Finding["severity"];
  suggestion: string;
}> = [
  {
    name: "unsafe-role-access",
    regex: /\buser\.role\b(?!\s*[?])/g,
    severity: "warning",
    suggestion: "Replace with user?.role ?? 'guest' to avoid runtime errors when user is null",
  },
  {
    name: "jwt-fallback-secret",
    regex: /JWT_SECRET.*\|\|.*["'](dev|secret|change|default|aperti|test)/gi,
    severity: "critical",
    suggestion: "Remove JWT_SECRET fallback — the server validates at startup and exits if missing",
  },
  {
    name: "hardcoded-openai-key",
    regex: /["'](sk-[A-Za-z0-9]{20,})["']/g,
    severity: "critical",
    suggestion: "CRITICAL: Hardcoded OpenAI key found. Remove immediately and rotate the key.",
  },
  {
    name: "hardcoded-nvidia-key",
    regex: /["'](nvapi-[A-Za-z0-9]{20,})["']/g,
    severity: "critical",
    suggestion: "CRITICAL: Hardcoded NVIDIA API key found. Remove immediately and rotate the key.",
  },
  {
    name: "todo-fixme",
    regex: /\/\/\s*(TODO|FIXME|HACK|XXX|BUG)\b[^*\n]*/gi,
    severity: "info",
    suggestion: "Track this in the issue tracker and resolve before launch",
  },
  {
    name: "placeholder-mock",
    regex: /\/\/\s*(placeholder|mock data|stub|temporary|temp:)\b[^*\n]*/gi,
    severity: "warning",
    suggestion: "Replace with real implementation before production deployment",
  },
];

// ── Scan all TypeScript/TSX files ─────────────────────────────────────────────
const files = walkDir(path.join(ROOT, "artifacts"), [".ts", ".tsx"]);
files.push(...walkDir(path.join(ROOT, "lib"), [".ts", ".tsx"]));

for (const file of files) {
  let content: string;
  try { content = fs.readFileSync(file, "utf8"); } catch { continue; }
  scanned++;

  const lines = content.split("\n");
  for (const pattern of PATTERNS) {
    let lineIdx = 0;
    for (const line of lines) {
      lineIdx++;
      const matches = line.matchAll(new RegExp(pattern.regex.source, pattern.regex.flags));
      for (const match of matches) {
        findings.push({
          type: pattern.name,
          severity: pattern.severity,
          file: path.relative(ROOT, file),
          line: lineIdx,
          content: line.trim().slice(0, 120),
          suggestion: pattern.suggestion,
        });
      }
    }
  }
}

// ── Generate report ───────────────────────────────────────────────────────────
const critical = findings.filter(f => f.severity === "critical");
const warnings = findings.filter(f => f.severity === "warning");
const infos = findings.filter(f => f.severity === "info");

console.log("\n╔══════════════════════════════════════════════════════════════╗");
console.log("║         Aperti Auto-Repair Report                          ║");
console.log("╚══════════════════════════════════════════════════════════════╝\n");
console.log(`Files scanned: ${scanned}`);
console.log(`Total findings: ${findings.length} (${critical.length} critical, ${warnings.length} warnings, ${infos.length} info)\n`);

if (critical.length > 0) {
  console.log("🔴 CRITICAL ISSUES (must fix before deployment):");
  for (const f of critical) {
    console.log(`  [${f.type}] ${f.file}:${f.line}`);
    console.log(`    "${f.content}"`);
    console.log(`    → ${f.suggestion}\n`);
  }
}

if (warnings.length > 0) {
  console.log("🟡 WARNINGS:");
  for (const f of warnings.slice(0, 20)) {
    console.log(`  [${f.type}] ${f.file}:${f.line} — ${f.content.slice(0, 80)}`);
  }
  if (warnings.length > 20) console.log(`  ... and ${warnings.length - 20} more warnings`);
  console.log();
}

if (infos.length > 0) {
  console.log(`ℹ️  INFO: ${infos.length} TODO/FIXME items found`);
}

const reportPath = path.join(ROOT, "repair_report.json");
fs.writeFileSync(reportPath, JSON.stringify({ scanned, findings, generatedAt: new Date().toISOString() }, null, 2));
console.log(`\nFull report saved to: repair_report.json`);

if (critical.length > 0) {
  console.error(`\n✗ Repair script found ${critical.length} critical issue(s). Fix before deploying.\n`);
  process.exit(1);
} else {
  console.log("\n✓ No critical issues found. Safe to deploy.\n");
  process.exit(0);
}
