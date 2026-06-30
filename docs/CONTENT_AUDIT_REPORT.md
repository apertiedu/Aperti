# Aperti — Production Content Audit Report

**Audited:** 30 June 2026  
**Auditor:** Automated agent audit + source analysis  
**Scope:** All public-facing pages, SEO/metadata, legal documents, marketing claims, accessibility, PWA, and trust indicators  
**Pages audited:** `/` · `/pricing` · `/trust` · `/features` · `/terms` · `/privacy` · `/legal` · `/data-retention` · `/contact` · `index.html` · `manifest.json` · `robots.txt` · `sitemap.xml`

---

## Executive Summary

The platform is pre-launch with strong bones and well-written legal documents, but has **4 critical defects** that would harm trust or search indexing immediately, **12 high-priority issues** including verifiable false claims and legal contradictions, and **18 medium/low issues** covering polish, accessibility, and SEO gaps. The contact form is currently routing public messages into the error-log endpoint (data loss). Social media sharing is broken because the Open Graph image file does not exist under the referenced name. Two legal documents contradict each other on financial data retention duration.

| Severity | Count |
|---|---|
| Critical | 4 |
| High | 12 |
| Medium | 11 |
| Low | 7 |
| **Total** | **34** |

---

## Critical Issues

### C-01 — Open Graph image is broken (broken social sharing)

**File:** `artifacts/aperti/index.html`  
**Impact:** Every social media share (LinkedIn, Twitter/X, WhatsApp, Slack previews) shows no image. This affects all URLs since the SPA shares one HTML file.

`index.html` declares:
```html
<meta property="og:image" content="https://aperti.ai/og-image.png" />
<meta name="twitter:image" content="https://aperti.ai/og-image.png" />
```

The actual file on disk is `artifacts/aperti/public/opengraph.jpg`. The file `og-image.png` does **not exist**.

**Fix:** Rename the public file to `og-image.png`, or update both meta tags to reference `opengraph.jpg`. Also add `<meta property="og:image:width" content="1200" />` and `<meta property="og:image:height" content="630" />` alongside.

---

### C-02 — Contact form submits to the error-log endpoint (data loss)

**File:** `artifacts/aperti/src/pages/contact.tsx` line 21  
**Impact:** Every contact form submission is silently swallowed into the error log (`/api/errors/log`) and never surfaced to any inbox. A customer writing about billing, enrolment, or a complaint receives no follow-up. Administrators reading error logs will see contact messages mixed with actual platform errors, making both harder to act on.

Current code:
```typescript
await fetch("/api/errors/log", {
  method: "POST",
  body: JSON.stringify({
    message: `[contact-form] ${form.subject}: ${form.message}`,
    browserInfo: `Name: ${form.name} | Email: ${form.email} | Topic: ${form.subject}`,
  }),
});
```

**Fix:** Create a dedicated `POST /api/contact` endpoint that stores submissions in a `contact_submissions` table (name, email, subject, message, created_at) and optionally sends a notification email. Wire the form to this endpoint.

---

### C-03 — Financial data retention period contradicts across three legal documents

**Impact:** Two documents state 7 years; the Privacy Policy states 5 years. This is a legal contradiction. If a regulator or user submits a Subject Access Request or deletion request, the platform cannot give a consistent answer.

| Document | Statement |
|---|---|
| `data-retention.tsx` | "Financial & Billing Data — **7 years** from transaction date (Egyptian tax law No. 91/2005)" |
| `legal.tsx` (FAQ) | "Financial records are legally required to be kept for **7 years** but will be anonymised." |
| `privacy.tsx` (Section 7) | "Payment records: Retained for **5 years** as required by Egyptian financial regulations." |

**Fix:** Decide on the correct retention period (verify against Egyptian Tax Law No. 91/2005), then update `privacy.tsx` Section 7 to match the 7-year figure used in the other two documents. Add a version bump to the Privacy Policy header when updated.

---

### C-04 — Payment activation window contradicts between Terms and Pricing FAQ

**Impact:** A user who reads Terms before subscribing is told 48 hours. A user who reads the Pricing FAQ is told 24 hours. If access is not granted within 24 hours, a user relying on the Terms has a valid complaint about being misled, and vice versa.

| Document | Statement |
|---|---|
| `terms.tsx` (Section 7 — Billing) | "You must submit a valid payment reference within **48 hours** of subscribing." |
| `pricing.tsx` (FAQ) | "Our team reviews and activates your account within **24 hours**, typically much faster." |

**Fix:** Align both to the same figure. If 24 hours is the operational target, update `terms.tsx` to read "within 24 hours". If 48 hours is the safe legal commitment, update `pricing.tsx` FAQ to say "within 48 hours".

---

## High-Priority Issues

### H-01 — "Instant SMS to absent parents" — no SMS integration exists

**File:** `artifacts/aperti/src/pages/landing.tsx` line 614  
**Impact:** This is a false product claim. Searching the entire backend codebase returns zero references to any SMS provider (Twilio, Vonage, AWS SNS, etc.). The claim appears in the comparison table on the landing page: *"QR attendance in seconds, instant SMS to absent parents"*.

**Fix:** Either implement SMS (using a provider such as Twilio), or replace the claim with an accurate one such as *"automated in-platform and push notifications to parents"* until SMS is live.

---

### H-02 — "Trusted by IGCSE & IB educators across Egypt and the Middle East" — database has 0 published courses

**File:** `artifacts/aperti/src/pages/landing.tsx` line 509  
**Impact:** The live database currently has 4 test accounts and **zero published courses**. The social proof claim is not yet earned. If a prospective user or journalist queries the platform and finds no content, trust is damaged more than if the claim had never been made.

The stats API (`/api/landing/stats`) returns: `{"students":0,"teachers":3,"courses":0,"assessments_completed":0}`.

**Fix:** Qualify or remove this claim until real customer counts are available. A softer alternative: *"Built for IGCSE & IB educators across Egypt and the Middle East"*. Once real numbers exist, wire the stats section to display them dynamically.

---

### H-03 — Landing page stat counters show "0+" to the public

**File:** `artifacts/aperti/src/pages/landing.tsx` (stats section)  
**Impact:** The animated stat counters pull from `/api/auth/stats` or `/api/landing/stats`. Both return zeros for courses and assessments. Public visitors see "0+ Active Courses" and "0 assessments completed". This actively undermines the trust the page is designed to build.

**Fix:** Either hide the stats section entirely until real numbers exist (≥ 100 students threshold), or replace the live API call with manually curated figures for the launch period. Do not display a counter that shows "0+".

---

### H-04 — Testimonials are hardcoded fabrications not attributed to real users

**File:** `artifacts/aperti/src/pages/landing.tsx` lines 720–739  
**Impact:** Three testimonials (Rania Khalil, Ahmed Saber, Nadia Ibrahim) are hardcoded strings with no mechanism for sourcing from real user data. The testimonials API (`/api/phase14/testimonials`) returns a 401. They appear indistinguishable from real endorsements. If a potential customer asks to speak with Rania Khalil, there is no person to contact.

Unlike the hero mockup (which carries an "Illustrative" label), the testimonials section carries no disclaimer.

**Fix:** Either collect real testimonials from pilot users and replace these, or add a visible label ("Illustrative quotes — representative of educator feedback during beta") beneath the section until real testimonials can be attributed.

---

### H-05 — Privacy Policy contradicts the cookie consent banner

**File:** `artifacts/aperti/src/pages/privacy.tsx` (Section 3 — Cookies)  
**Impact:** The Privacy Policy states: *"No cookie consent banner is required for strictly essential cookies under applicable law."* However, `artifacts/aperti/src/components/consent-banner.tsx` exists and is rendered on every public page visit. Users see a banner the Privacy Policy says should not appear. This is a contradiction that will confuse users and could draw regulatory attention.

**Fix:** Either remove the consent banner (if only essential cookies are used and Egyptian law does not require it), or update the Privacy Policy to correctly state that a banner is shown for optional/analytics cookies.

---

### H-06 — SPA canonical tag points all pages to the homepage

**File:** `artifacts/aperti/index.html` line 24  
**Impact:** The single-page application shares one `index.html`. That file contains `<link rel="canonical" href="https://aperti.ai" />`. This means `/pricing`, `/trust`, `/terms`, `/privacy`, and `/contact` all declare themselves as the homepage to search engines. Google may de-index or de-prioritize these pages as duplicate content of the root URL.

**Fix:** Use `react-helmet` or `@tanstack/react-router`'s meta management to inject per-page canonical tags, OG titles, and OG descriptions dynamically for each route. At minimum, each public marketing page needs its own canonical, `og:url`, `og:title`, and `meta description`.

---

### H-07 — Sitemap missing five commercially important public pages

**File:** `artifacts/aperti/public/sitemap.xml`  
**Impact:** Google cannot discover and index `/pricing`, `/contact`, `/trust`, `/legal`, or `/data-retention` because they are not in the sitemap. The sitemap currently only includes: `/`, `/features`, `/roadmap`, `/status`, `/courses`, `/terms`, `/privacy`.

Missing pages and their SEO value:
| Page | Priority | Reason |
|---|---|---|
| `/pricing` | 0.9 | Commercial conversion page — highest value |
| `/contact` | 0.7 | Trust signal; support discoverability |
| `/trust` | 0.7 | Security-conscious buyer search queries |
| `/legal` | 0.5 | Legal and compliance due diligence |
| `/data-retention` | 0.4 | GDPR / data privacy search intent |

**Fix:** Add all five missing pages to `sitemap.xml` with appropriate `priority` and `changefreq` values, and add `<lastmod>` dates to all entries.

---

### H-08 — PWA manifest name is inconsistent with the page title

**File:** `artifacts/aperti/public/manifest.json`  
**Impact:** Brand inconsistency across surfaces.

| Surface | Value |
|---|---|
| `manifest.json` → `name` | `"Aperti — Educational OS"` |
| `index.html` → `<title>` | `"Aperti — Intelligent Educational Operating System"` |
| `index.html` → `og:title` | `"Aperti — Intelligent Educational Operating System"` |
| `replit.md` tagline | `"Intelligent Educational Operating System"` |

A user who installs the PWA sees "Educational OS" on their home screen, while every browser tab says "Intelligent Educational Operating System".

**Fix:** Update `manifest.json` `name` to `"Aperti — Intelligent Educational Operating System"` to match the canonical brand name.

---

### H-09 — PWA manifest has no raster icons — iOS and Android will show blank icons

**File:** `artifacts/aperti/public/manifest.json`  
**Impact:** Both icons in the manifest reference `favicon.svg`. iOS Safari does not support SVG icons for PWA home screen installation and will display a blank grey square. Android Chrome may also have issues with SVG maskable icons at small sizes.

**Fix:** Generate PNG icons at 192×192 and 512×512 (with proper padding for maskable), place them in `/public/`, and add them to the manifest:
```json
{ "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
{ "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
```
Also add `<link rel="apple-touch-icon" href="/icon-192.png" />` to `index.html`.

---

### H-10 — Trust Center claims conflict with known security vulnerabilities

**File:** `artifacts/aperti/src/pages/trust.tsx`  
**Impact:** The Trust Center makes security claims that are contradicted by the penetration test findings documented in `docs/PENTEST_REPORT.md`.

Specific conflicts:
1. Trust page: *"Teachers can only see their own students"* — Pentest finding PT-01 confirms teacher IDOR allows cross-teacher data access via crafted requests.
2. Trust page: *"Security scans run on every deployment"* — No CI/CD pipeline or automated scan configuration was found in the codebase. This is an unverifiable claim.
3. Trust page: *"AES-256 encryption at rest"* — This depends on the PostgreSQL hosting provider's disk encryption; it is not implemented at the application layer. The claim is technically dependent on infrastructure the codebase does not control.

**Fix:** Audit each security claim against verified technical reality before going live. Remove or qualify claims that are not demonstrably true. Do not publish the Trust Center in its current form to the public.

---

### H-11 — `/helpdesk` link on the Contact page is an authenticated route

**File:** `artifacts/aperti/src/pages/contact.tsx` line 70  
**Impact:** The Contact page tells public (unauthenticated) visitors to *"Use the HelpDesk inside the platform"* with a hyperlink to `/helpdesk`. Clicking this redirects unauthenticated users to the login page with no explanation. This is a confusing dead end for a visitor who hasn't registered yet and cannot understand why they cannot access the help desk.

**Fix:** Either remove this link from the public Contact page, or replace it with a note that says *"Existing users can access the HelpDesk after logging in."*

---

### H-12 — No JSON-LD structured data on any page

**File:** `artifacts/aperti/index.html`  
**Impact:** Google uses structured data (JSON-LD) to generate rich results — FAQ accordions in search, organization info in the Knowledge Panel, breadcrumb trails, and sitelinks. Without it, Aperti pages appear as plain blue links with no enhancement. Competitors with structured data gain visibility advantages for the same queries.

Missing structured data types:
- `Organization` (name, logo, contactPoint, sameAs social links) — homepage
- `WebSite` with `SearchAction` — homepage
- `FAQPage` — pricing FAQ, landing FAQ, legal FAQ
- `SoftwareApplication` — homepage (EdTech SaaS)

**Fix:** Add a `<script type="application/ld+json">` block to `index.html` with at minimum an `Organization` and `WebSite` schema. For FAQ pages, inject `FAQPage` schema dynamically per route.

---

## Medium-Priority Issues

### M-01 — Hero dashboard mockup shows a hardcoded "26 Jun" date

**File:** `artifacts/aperti/src/pages/landing.tsx`  
The hero mockup panel includes a hardcoded date ("26 Jun") in the classroom dashboard preview. This date will read as stale within weeks of launch. It is also visually inconsistent with the "Illustrative" label that disclaims the data.

**Fix:** Either remove the specific date from the mockup, or replace it with a generic relative date label such as "Today".

---

### M-02 — "Save 3+ hours per week" — unsubstantiated quantified claim

**File:** `artifacts/aperti/src/pages/landing.tsx` line 466 and 720  
The landing page presents "Save 3+ hours per week on admin and marking" as a bullet point and a testimonial quote. Quantified time-saving claims in EdTech marketing are common, but they need either a source ("based on beta user surveys") or softening ("teachers report saving hours each week on admin").

**Fix:** Add a brief qualifier such as *"Based on pilot educator feedback"* or change to *"Spend less time on admin, more time teaching."*

---

### M-03 — "Spaced-repetition flashcards proven to improve retention" — misleading wording

**File:** `artifacts/aperti/src/pages/landing.tsx` line 476  
The word "proven" implies a clinical or scientific study. Spaced repetition as a technique is scientifically supported, but the claim as written implies Aperti's specific implementation has been proven effective. This is a standard FTC/ASA concern for EdTech products.

**Fix:** Rephrase to: *"Flashcards built on spaced-repetition science — shown to improve long-term retention"* and link to a relevant external study or the Wikipedia citation for Ebbinghaus's forgetting curve.

---

### M-04 — Pricing page shows empty state to all visitors ("Plans coming soon")

**File:** `artifacts/aperti/src/pages/pricing.tsx`  
The `/api/plans/public` endpoint returns `[]`. Visitors who navigate to `/pricing` see an empty state that implies nothing is available. This is a conversion dead end — the page exists in the sitemap and is linked from navigation but conveys no value.

**Fix:** Seed at least one subscription plan into the `subscription_plans` table, or replace the empty-state component with a hard-coded pricing fallback that displays planned tiers while the backend is populated.

---

### M-05 — Features page shows empty state to all visitors

**File:** `artifacts/aperti/src/pages/features-showcase.tsx` (via `/api/features/public`)  
Same pattern as M-04. The `/api/features/public` endpoint returns `[]`. The `/features` URL is in the sitemap with priority 0.8, but renders no content.

**Fix:** Seed the features table, or display a hard-coded feature grid as a fallback when the API returns empty.

---

### M-06 — robots.txt does not include Allow entries for key commercial pages

**File:** `artifacts/aperti/public/robots.txt`  
While the file correctly disallows `/login`, `/register`, `/dashboard`, `/admin`, and `/api/`, it does not explicitly list commercial pages as allowed. Although `Allow: /` technically permits crawling all unlisted paths, some crawlers apply conservative interpretations when specific allow/disallow patterns are mixed.

Missing explicit allows:
- `Allow: /pricing` — highest commercial value
- `Allow: /contact` — trust/support signal
- `Allow: /trust` — security-conscious buyer queries
- `Allow: /legal` — compliance due diligence

**Fix:** Add the four `Allow:` lines above before the `Disallow:` block.

---

### M-07 — All sitemap URLs missing `<lastmod>` dates

**File:** `artifacts/aperti/public/sitemap.xml`  
None of the seven URLs include a `<lastmod>` element. Google uses `lastmod` to prioritize crawling and to understand how frequently content changes. Without it, Googlebot cannot distinguish the homepage (updated weekly) from the Terms (updated yearly).

**Fix:** Add `<lastmod>YYYY-MM-DD</lastmod>` to each URL. Use the actual document version dates already present in the legal pages (v2026.06 → `2026-06-26`).

---

### M-08 — PWA shortcuts point to authenticated-only routes

**File:** `artifacts/aperti/public/manifest.json`  
The manifest shortcuts include `/attendance`, `/homework`, and `/admin/os`. A logged-out user who taps these shortcuts from their home screen is redirected to the login page with no explanation of what they were trying to do. The shortcut `url` for unauthenticated users should degrade gracefully.

**Fix:** If the app cannot deep-link post-login, change all shortcuts to point to `/?intent=attendance` style URLs that the login page can read and redirect to after authentication.

---

### M-09 — Privacy Policy section 2b claims GDPR compliance without confirmed EU users

**File:** `artifacts/aperti/src/pages/privacy.tsx`  
Section 2b maps all processing activities to GDPR Article 6 lawful bases. The platform is governed by Egyptian law and targets Egypt and the Middle East. If no EU users are served, adding a GDPR mapping is harmless but can create confusion, and more importantly, creates GDPR obligations if it implies the platform is subject to GDPR.

**Fix:** Add a qualifying clause: *"If you are located in the European Economic Area, we additionally map our processing activities to GDPR Article 6 as follows…"* This makes clear that GDPR applies conditionally, not universally.

---

### M-10 — Hero section "no roadmap items" claim conflicts with the /features page

**File:** `artifacts/aperti/src/pages/landing.tsx`  
The landing page features section contains the line: *"Every feature listed below is live and available today — no roadmap items, no coming-soon placeholders."* However, the `/features` page exists (it is in the sitemap) and presumably contains coming-soon items when populated.

**Fix:** Qualify the claim to refer specifically to the 7-item list shown inline on the landing page: *"Every feature shown on this page is live today."*

---

### M-11 — No physical address or business registration on the Contact page

**File:** `artifacts/aperti/src/pages/contact.tsx`  
The Contact page provides an email address, response time, and business hours (Sunday–Thursday) but no physical address or Egyptian business registration number. The Terms of Service (Section 13) also omits a registered address.

For a platform operating under Egyptian law, processing financial data, and making GDPR compliance claims, a registered business address is expected by users and may be legally required depending on the applicable consumer protection regulations.

**Fix:** Add the legal entity name, registered address, and commercial registration number to both the Contact page and Section 13 of the Terms.

---

## Low-Priority Issues

### L-01 — Twitter card description is very short (42 characters)

**File:** `artifacts/aperti/index.html`  
The Twitter card description reads: *"The intelligent educational operating system."* Twitter cards display up to 200 characters in the summary card format. The description is under-utilized and will not differentiate the platform in a crowded feed.

**Fix:** Expand to: *"Aperti unifies attendance, grading, parent communication, and AI tutoring for IGCSE & IB educators. The educational OS built for teachers in Egypt and the Middle East."*

---

### L-02 — No `og:locale` meta tag

**File:** `artifacts/aperti/index.html`  
The Open Graph spec supports `og:locale` to declare the language and region of the content. Without it, scrapers assume default English.

**Fix:** Add `<meta property="og:locale" content="en_EG" />` (English as used in Egypt) or `en_GB` if the copy follows British conventions (which the terms appear to).

---

### L-03 — No browser favicon fallback for older browsers

**File:** `artifacts/aperti/index.html` and `artifacts/aperti/public/`  
The only favicon is `favicon.svg`. Safari on macOS older than 12, Internet Explorer, and some corporate proxy tools do not render SVG favicons. The browser tab shows a blank placeholder.

**Fix:** Export a 32×32 `favicon.ico` (multi-resolution: 16×16 + 32×32) and add `<link rel="icon" href="/favicon.ico" sizes="any" />` before the SVG icon link.

---

### L-04 — `/api/auth/stats` vs `/api/landing/stats` — two separate stat endpoints return different data

The landing page appears to query both endpoints. `/api/auth/stats` returns `{"activeStudents":4,"activeTeachers":4,"publishedCourses":0}` while `/api/landing/stats` returns `{"students":0,"teachers":3,"courses":0}`. They return inconsistent counts for the same entities. This creates a race condition where whichever resolves first populates the UI.

**Fix:** Consolidate to a single stats endpoint, ensuring the query counts only non-test accounts and published content.

---

### L-05 — `manifest.json` description does not match site description meta tag

| Source | Value |
|---|---|
| `manifest.json` → `description` | `"The intelligent operating system that unifies teaching, learning, and assessment"` |
| `index.html` → `meta description` | `"The all-in-one educational platform for teachers, students, parents, and administrators."` |

Both are reasonable descriptions but they are inconsistent. A user who adds the PWA to their home screen sees a different description than a user who finds the site via Google.

**Fix:** Use the same canonical description in both places. Recommended: the `index.html` version is more specific and user-facing; update `manifest.json` to match.

---

### L-06 — Privacy preferences banner re-appears on every visit

**File:** `artifacts/aperti/src/components/consent-banner.tsx`  
The privacy consent banner appears on every page load. If it is not persisted to localStorage or a cookie on dismissal, users are prompted on every visit. This is a UX failure that actively annoys returning visitors.

**Fix:** On dismiss or accept, set `localStorage.setItem("aperti_consent_v2026.06", "accepted")` and check for this key before rendering the banner.

---

### L-07 — `<title>` and `og:title` are identical — no differentiation

**File:** `artifacts/aperti/index.html`  
Both `<title>` and `<meta property="og:title">` use the full *"Aperti — Intelligent Educational Operating System"*. For pages like `/pricing` or `/contact`, the OG title should reflect the specific page (e.g., *"Pricing — Aperti"*).

This is only fixable with dynamic meta management per route (see H-06), but worth noting as a companion to that fix.

---

## SEO Opportunity Gaps (Informational)

These are not bugs but missed opportunities:

| Gap | Potential Impact |
|---|---|
| No blog or resources section | No long-tail content for "IGCSE grading tool" and similar queries |
| No About page | Users researching the team/company have no destination |
| No structured data for SoftwareApplication | No chance of rich results / Knowledge Panel |
| No `hreflang` for Arabic | Egypt has a large Arabic-first audience; EN-only locks out a segment |
| `/courses` in sitemap but shows empty catalogue | Crawlers index a page with no content |
| No `rel="preconnect"` for Google Fonts or OpenAI CDN | Performance opportunity |

---

## Compliance Checklist

| Item | Status | Notes |
|---|---|---|
| Terms of Service present | ✅ Pass | Well-written, dated, versioned |
| Privacy Policy present | ✅ Pass | GDPR mapping included |
| Data Retention Policy present | ✅ Pass | `/data-retention` dedicated page |
| Cookie Policy / Consent | ⚠️ Conflict | Banner exists but Policy says not needed (H-05) |
| GDPR DPO contact | ✅ Pass | `privacy@aperti.ai` listed |
| Legal contact | ✅ Pass | `legal@aperti.ai` listed |
| Governing law stated | ✅ Pass | Egyptian law, Cairo courts |
| Financial retention period consistent | ❌ Fail | 7 years vs 5 years contradiction (C-03) |
| Payment window consistent | ❌ Fail | 48 hours vs 24 hours contradiction (C-04) |
| Physical business address | ❌ Missing | Required for legal legitimacy (M-11) |
| No fabricated testimonials | ❌ Fail | Hardcoded, unattributed quotes (H-04) |
| Security claims accurate | ❌ Fail | Claims contradict pentest findings (H-10) |

---

## Priority Fix Schedule

### Immediate — before any public launch

| ID | Issue | Effort |
|---|---|---|
| C-01 | Fix OG image filename mismatch | 5 min |
| C-02 | Fix contact form → create `/api/contact` endpoint | 2 hrs |
| C-03 | Align financial retention (5 yr vs 7 yr) | 15 min |
| C-04 | Align payment window (24 hr vs 48 hr) | 10 min |
| H-01 | Remove "instant SMS" claim or implement SMS | 30 min (claim) |
| H-03 | Hide or replace zero-value stat counters | 30 min |
| H-04 | Label testimonials as illustrative | 10 min |
| H-05 | Resolve cookie banner vs Privacy Policy contradiction | 30 min |
| H-10 | Audit and correct Trust Center security claims | 1 hr |

### Pre-launch week

| ID | Issue | Effort |
|---|---|---|
| H-06 | Dynamic per-page canonical, og:title, og:url via react-helmet | 3 hrs |
| H-07 | Add 5 missing URLs to sitemap.xml | 15 min |
| H-08 | Align manifest name to canonical brand name | 5 min |
| H-09 | Generate PNG PWA icons, add apple-touch-icon | 30 min |
| H-11 | Remove /helpdesk link from public Contact page | 10 min |
| H-12 | Add Organization + WebSite JSON-LD structured data | 1 hr |
| M-04 | Seed pricing plans or add hard-coded fallback | 1 hr |
| M-05 | Seed features or add hard-coded feature grid fallback | 1 hr |

### Post-launch polish

| ID | Issue | Effort |
|---|---|---|
| M-01 | Replace "26 Jun" hardcoded date in hero mockup | 15 min |
| M-02 | Qualify "3+ hours" claim with source | 10 min |
| M-03 | Soften "proven" wording on flashcards | 10 min |
| M-06 | Add explicit Allow: entries to robots.txt | 5 min |
| M-07 | Add lastmod dates to sitemap.xml | 10 min |
| M-08 | Fix PWA shortcuts for unauthenticated users | 30 min |
| M-11 | Add physical address to Contact + Terms | 15 min |
| L-06 | Persist consent banner dismissal to localStorage | 20 min |
| L-01–L-05 | OG description, locale, favicon.ico, unified stats, description alignment | 1 hr total |

---

*Report generated: 30 June 2026. Cross-reference with `docs/PENTEST_REPORT.md` for security-specific findings and `docs/QA_REPORT.md` for functional bugs.*
