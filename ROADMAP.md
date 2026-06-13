# Aperti Roadmap — Recommended Next Actions

Generated: 2026-06-13

## Immediate (Pre-Launch Blockers)

### 1. Set OPENAI_API_KEY
- Go to Replit Secrets and add `OPENAI_API_KEY` via the AI Integration.
- This unlocks: Mentor AI, TutorCraft, SnapGrade OCR+AI, flashcard generation, revision planning.

### 2. Configure Email
- Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (or `SENDGRID_API_KEY`) in Replit Secrets.
- Test password reset and brute-force alert emails.

### 3. Set VAPID_PRIVATE_KEY
- Already have `VAPID_PUBLIC_KEY`. Generate matching private key and set in secrets.
- Test push notifications on mobile.

### 4. Change Default Admin Password
- Log in as `admin` with `admin123` and change the password immediately.
- The `mustChangePassword` flag forces this on first login.

---

## Short-Term (Phase 45 — 1-2 weeks)

### Performance
- [ ] Lazy-load `@react-three/fiber` and `three.js` (saves ~300KB from initial bundle)
- [ ] Add Redis URL for persistent background job queues
- [ ] Implement `Cache-Control` headers on public routes (`/api/landing`, `/api/plans/public`)

### Security
- [ ] Enforce MFA for admin accounts
- [ ] Set `SESSION_SECRET` separately from `JWT_SECRET`
- [ ] Add `Referrer-Policy` and `Permissions-Policy` headers to Helmet config

### UX
- [ ] Add keyboard shortcut hints to command palette
- [ ] Improve empty states on student dashboard (first-time user onboarding flow)
- [ ] Add pagination to all admin tables (currently limited to 50 rows)

---

## Medium-Term (Phase 46 — 1 month)

### Features
- [ ] **Mobile App** — Expo wrapper around student portal
- [ ] **Parent Dashboard v2** — Real-time grade alerts, one-tap meeting booking
- [ ] **Assessment Analytics** — Question-level item analysis (difficulty, discrimination)
- [ ] **Multi-language Support** — Arabic RTL layout (already have `i18n.ts` skeleton)
- [ ] **School Network** — Multi-school org management, cross-school leaderboards

### Infrastructure
- [ ] Set up PostgreSQL connection pooling (PgBouncer) for production
- [ ] Add database read replica for analytics queries
- [ ] Set up error monitoring (Sentry or equivalent)
- [ ] Add CloudFlare CDN for static assets

---

## Long-Term (Phase 47+ — 3-6 months)

### AI Evolution
- [ ] **Adaptive Curriculum** — AI dynamically adjusts lesson pace based on student performance
- [ ] **AI Co-teacher** — Autonomous lesson plan generation from syllabus
- [ ] **Voice Mentor** — Text-to-speech for The Mentor chat
- [ ] **Visual Question Recognition** — Improved SnapGrade with diagram understanding

### Platform
- [ ] **API v2** — Public REST API for school ERP integration
- [ ] **WhatsApp Integration** — Parent notifications via WhatsApp Business
- [ ] **Offline Mode** — Service worker + IndexedDB for exam vault offline
- [ ] **Marketplace** — Teachers can sell question banks and course templates

---

## Technical Debt

| Item | Priority | Effort |
|------|----------|--------|
| Replace `localStorage` token storage with HttpOnly cookies (full CSRF protection) | High | 3 days |
| Extract shared `AuthenticatedFetch` hook used across 50+ pages | Medium | 1 day |
| Remove `focus-zone.tsx` (superseded by `focus-zone-v2.tsx`) | Low | 1 hour |
| Consolidate `flashcards.ts` + `flashcard-v3.ts` routes | Medium | 2 hours |
| Add TypeScript strict mode to frontend | Medium | 2 days |
