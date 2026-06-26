# Aperti — Compliance & Trust Layer Report
**Phase 4 — Privacy by Design / GDPR Readiness**
**Policy Version:** v2026.06
**Date:** 26 June 2026
**Prepared by:** Aperti Engineering

---

## Executive Summary

Phase 4 delivers a complete Compliance & Trust Layer for the Aperti platform. The implementation follows Privacy by Design and Privacy by Default principles. It provides GDPR-aligned data subject rights, a publicly accessible legal documentation hub, granular consent capture with database persistence, and an admin-facing compliance management dashboard.

---

## 1. Legal Documents Published

| Document | URL | Policy Version |
|---|---|---|
| Privacy Policy | `/privacy` | v2026.06 |
| Terms of Service | `/terms` | v2026.06 |
| Data Retention Policy | `/data-retention` | v2026.06 |
| Legal Contact & DPO | `/legal` | v2026.06 |
| Trust Center | `/trust` | — |

All documents display a `v2026.06` version badge in the page header. Cross-links between related documents are present on each page.

---

## 2. Data Subject Rights (GDPR Articles 15–22)

### 2.1 Self-Service Rights (Settings page)
- **Right of Access / Data Portability (Art. 15, 20):** Users can export all personal data as a structured JSON file via `POST /api/user/export`. The export includes account info, enrollments, attendance, student marks, homework, exam results, and activity logs.
- **Right to Erasure (Art. 17):** Users can submit an account deletion request via `POST /api/user/deletion-request`. Requests are logged in the `compliance_requests` table and processed by admin.

### 2.2 Formal Requests (Legal page `/legal`)
- Users and guardians can submit formal GDPR requests (Access, Erasure, Portability, Restriction, Objection, Correction) via the DPO Contact form.
- Requests are received at `privacy@aperti.ai` with a structured subject line.
- Response SLA: 30 days (as required by GDPR Art. 12).

### 2.3 Admin Processing
All requests appear in `/admin/compliance` → Requests tab. Admins can:
- Mark requests as In Review, Completed, or Rejected
- Add internal processing notes
- Track SLA compliance via request timestamps

---

## 3. Consent Management

### 3.1 Consent Banner
- Displayed to all new visitors (not previously consented) via `ConsentBanner` component
- Granular consent controls: Essential (always on), Analytics, Marketing
- First-party cookie: `aperti_consent` — stores consent state in browser localStorage
- On acceptance/rejection, consent is recorded to the backend

### 3.2 Consent Recording (Backend)
**Table:** `consent_records`
```
id, user_id (nullable), session_id, ip_address, consent_type,
granted (boolean), policy_version, user_agent, created_at
```

**Endpoints:**
- `POST /api/compliance/consent` — authenticated users
- `POST /api/compliance/consent/public` — anonymous visitors
- `GET /api/compliance/consent` — retrieve own consent history
- `GET /api/admin/compliance/consent-stats` — aggregate stats for admin

**Indexes:**
- `consent_records_user_idx` — per-user lookup
- `consent_records_session_idx` — anonymous session lookup
- `consent_records_type_idx` — consent type analytics
- `consent_records_created_idx` — time-range queries

### 3.3 Admin Consent Stats
The Consent tab in `/admin/compliance` shows:
- Granted vs. denied counts per consent type
- Acceptance rate percentage with a visual progress bar

---

## 4. Data Retention Policy

Published at `/data-retention`. Key retention schedules:

| Category | Retention Period | Basis |
|---|---|---|
| Account data | Subscription + 12 months | Contractual |
| Student records | 7 years | Regulatory (KHDA / Ministry) |
| Session recordings | 90 days | Operational |
| Payment records | 7 years | Tax / regulatory |
| Activity logs | 12 months | Security |
| Marketing preferences | Until withdrawal | Consent |
| Anonymised analytics | 36 months | Legitimate interest |

---

## 5. Admin Compliance Dashboard (`/admin/compliance`)

Four tabs:

| Tab | Contents |
|---|---|
| Requests | All data subject requests with status management modal |
| Consent | Per-type consent rates with acceptance rate visualisation |
| Backups | Backup log with manual trigger capability |
| Checklist | 17-item GDPR compliance checklist with progress bar |

**KPI strip:** Pending / In Review / Completed / Total request counts.

---

## 6. Trust Center Additions

The Trust Center (`/trust`) now links to:
- Platform Status (live)
- Release Notes
- Public Roadmap
- Terms of Service
- Privacy Policy
- **Data Retention Policy** (new)
- **Legal Contact & DPO** (new)
- Contact

---

## 7. Footer & Navigation

Landing page footer Legal column updated to include:
- Terms of Service
- Privacy Policy
- **Data Retention**
- **Legal / DPO**
- Contact

Admin sidebar includes a **Compliance** entry under the Admin section.

---

## 8. Technical Implementation

| Component | File |
|---|---|
| Consent routes | `artifacts/api-server/src/routes/compliance-consent.ts` |
| Admin compliance router | `artifacts/api-server/src/routes/admin-compliance.ts` |
| Consent Banner | `artifacts/aperti/src/components/consent-banner.tsx` |
| Data Retention page | `artifacts/aperti/src/pages/data-retention.tsx` |
| Legal Contact page | `artifacts/aperti/src/pages/legal.tsx` |
| Compliance Dashboard | `artifacts/aperti/src/pages/admin/compliance-dashboard.tsx` |
| App routing | `artifacts/aperti/src/App.tsx` |
| Admin nav | `artifacts/aperti/src/components/layout.tsx` |

---

## 9. Compliance Checklist Status

| Item | Status |
|---|---|
| Privacy Policy published | Complete |
| Terms of Service published | Complete |
| Data Retention Policy published | Complete |
| Legal/DPO contact page | Complete |
| Trust Center | Complete |
| Consent banner | Complete |
| Consent recording in database | Complete |
| Self-service data export | Complete |
| Account deletion request workflow | Complete |
| Admin compliance request management | Complete |
| Policy version displayed on all legal pages | Complete |
| Footer links to all legal pages | Complete |
| DPO email configured (privacy@aperti.ai) | Complete |
| Automated retention review schedule | Pending (manual process) |
| PDPC registration (Egypt) | Pending (legal action) |
| Data Protection Impact Assessment (DPIA) | Pending (legal action) |
| Policies reviewed by qualified attorney | Pending (legal action) |

13 of 17 items complete (76%).

---

## 10. Outstanding Legal Actions

The following items require engagement with a qualified Egyptian attorney and/or regulatory action before accepting payments from EU/UK residents or processing data at scale:

1. **Automated data retention enforcement** — schedule a cron job or stored procedure to purge expired data per the published schedule.
2. **PDPC registration** — determine whether Aperti is required to register with Egypt's Personal Data Protection Centre under Law No. 151 of 2020.
3. **DPIA** — conduct a Data Protection Impact Assessment for high-risk processing activities (student biometric data, AI-driven grading, automated profiling).
4. **Legal review** — have all published policies reviewed and approved by a qualified attorney familiar with Egyptian and EU data protection law.

---

## 11. DPO & Legal Contact

| Role | Email |
|---|---|
| Data Protection Officer | privacy@aperti.ai |
| Legal & Compliance | legal@aperti.ai |
| General Contact | contact@aperti.ai |

Response SLA: 30 calendar days for all formal data subject requests.

---

*This report reflects the state of the Aperti platform as of 26 June 2026. It is an internal engineering document and does not constitute legal advice.*
