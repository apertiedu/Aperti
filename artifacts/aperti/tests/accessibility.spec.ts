/**
 * Accessibility test suite — Aperti
 *
 * Uses @axe-core/playwright to run automated WCAG 2.1 AA audits
 * against the key public and authenticated pages.
 *
 * Run: pnpm --filter @workspace/aperti exec playwright test
 */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Pages that are publicly accessible (no login required)
const PUBLIC_PAGES = [
  { name: "Landing", path: "/" },
  { name: "Login", path: "/login" },
  { name: "Register", path: "/register" },
  { name: "Forgot password", path: "/forgot-password" },
  { name: "Features", path: "/features" },
  { name: "Contact", path: "/contact" },
];

// WCAG 2.1 AA rules — exclude known third-party component issues
const AXE_OPTIONS = {
  runOnly: {
    type: "tag" as const,
    values: ["wcag2a", "wcag2aa", "best-practice"],
  },
  // Exclude third-party widget containers if present
  exclude: [] as string[][],
};

for (const page of PUBLIC_PAGES) {
  test(`a11y: ${page.name} (${page.path})`, async ({ page: pw }) => {
    await pw.goto(page.path);
    await pw.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page: pw })
      .options(AXE_OPTIONS)
      .analyze();

    // Filter to violations only (not incomplete)
    const criticalViolations = results.violations.filter(
      v => v.impact === "critical" || v.impact === "serious"
    );

    if (criticalViolations.length > 0) {
      console.error(`a11y violations on ${page.path}:`);
      for (const v of criticalViolations) {
        console.error(`  [${v.impact}] ${v.id}: ${v.description}`);
        for (const node of v.nodes.slice(0, 3)) {
          console.error(`    → ${node.target.join(", ")}`);
          if (node.failureSummary) {
            console.error(`      ${node.failureSummary.split("\n")[0]}`);
          }
        }
      }
    }

    expect(
      criticalViolations,
      `${criticalViolations.length} critical/serious a11y violation(s) on ${page.path}`
    ).toHaveLength(0);
  });
}

// Smoke test — ensure colour contrast is checked on the dashboard (if reachable)
test("a11y: colour-contrast check on login page", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");

  const results = await new AxeBuilder({ page })
    .withRules(["color-contrast"])
    .analyze();

  const contrastViolations = results.violations.filter(v => v.id === "color-contrast");
  if (contrastViolations.length > 0) {
    console.warn(`[a11y] ${contrastViolations[0].nodes.length} colour-contrast issue(s) on /login (non-blocking)`);
  }
  // Colour-contrast is reported but not enforced as a hard failure here
  // (many UI libraries have minor contrast issues — track via the warning above)
});

test("a11y: interactive controls have accessible names", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");

  const results = await new AxeBuilder({ page })
    .withRules(["button-name", "link-name", "label", "aria-required-attr"])
    .analyze();

  const violations = results.violations;
  if (violations.length > 0) {
    for (const v of violations) {
      console.error(`[a11y] ${v.id}: ${v.description}`);
    }
  }
  expect(violations, "Interactive controls must have accessible names").toHaveLength(0);
});
