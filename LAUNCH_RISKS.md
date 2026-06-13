# Aperti Launch Risks

Generated: 2026-06-13

## Risk Register

### 🔴 HIGH PRIORITY

#### R1: OPENAI_API_KEY Not Configured
- **Risk**: AI features (Mentor, TutorCraft, SnapGrade AI, revision planning, flashcard generation) fall back to rule-based responses. Students and teachers will see degraded AI quality.
- **Impact**: Core value proposition diminished; users may churn.
- **Mitigation**: Set `OPENAI_API_KEY` via Replit AI Integration before public launch.
- **Status**: OPEN

#### R2: Email Service Not Configured
- **Risk**: Password reset emails, brute-force alerts, and parent notifications will not be delivered.
- **Impact**: Users cannot self-recover accounts; security alerts silently fail.
- **Mitigation**: Configure SMTP credentials in `.env` / Replit secrets. The codebase uses `nodemailer` with a configured transport.
- **Status**: OPEN

#### R3: Web Push Not Fully Tested
- **Risk**: `VAPID_PRIVATE_KEY` not set; push notifications may not work on mobile.
- **Impact**: Student engagement drops without real-time notifications.
- **Mitigation**: Generate VAPID keys and set `VAPID_PRIVATE_KEY` in secrets.
- **Status**: OPEN

---

### 🟡 MEDIUM PRIORITY

#### R4: Redis Not Connected
- **Risk**: In-memory fallback is used for caching; data is lost on server restart. BullMQ queues are in-memory only.
- **Impact**: Background job persistence is lost on restart; cold cache on every server restart.
- **Mitigation**: Add Redis URL to environment if Redis is provisioned.
- **Status**: ACCEPTABLE for MVP

#### R5: Single Server / No Redundancy
- **Risk**: Server restart causes downtime. No load balancing.
- **Impact**: Momentary outage during deploys.
- **Mitigation**: Use Replit autoscale deployment or PM2 cluster mode.
- **Status**: ACCEPTABLE for MVP

#### R6: Backup Not Verified
- **Risk**: `BackupScheduler` runs at 02:00 UTC but backup destination is not confirmed.
- **Impact**: Data loss in disaster scenario.
- **Mitigation**: Verify PostgreSQL backup process and test restore.
- **Status**: OPEN

#### R7: LiveKit Not Configured
- **Risk**: Live class feature (`livekit-server-sdk`) requires a LiveKit server URL and credentials.
- **Impact**: Live classes will not function.
- **Mitigation**: Set `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` or disable the feature.
- **Status**: OPEN

---

### 🟢 LOW PRIORITY

#### R8: Default Admin Password
- **Risk**: Admin account created with default password `admin123`.
- **Impact**: Anyone knowing the default can access admin panel if the password is not changed.
- **Mitigation**: Force password change on first admin login (already implemented via `mustChangePassword` flag).
- **Status**: MITIGATED (must-change-password enforced)

#### R9: MFA Not Enforced
- **Risk**: Admin and teacher accounts can operate without MFA.
- **Impact**: Account takeover risk via credential stuffing.
- **Mitigation**: Enforce MFA for admin role in `POST /auth/login`.
- **Status**: OPEN

#### R10: Bundle Size
- **Risk**: API bundle is 6.4MB (uncompressed). With `compression()` middleware this is ~1.5MB.
- **Impact**: Slow cold starts; high memory usage.
- **Mitigation**: Implement code splitting, lazy-load 3D components (`@react-three/fiber`).
- **Status**: OPEN (non-blocking)

---

## Launch Readiness Score

| Category | Score | Notes |
|----------|-------|-------|
| Security | 87/100 | JWT hardened, rate limiting, role enforcement |
| Authentication | 90/100 | MFA available, device limits, brute-force protection |
| Database | 85/100 | Schema complete, indexes in place, migrations automated |
| AI Features | 60/100 | Fallbacks work, but no API key configured |
| Email/Notifications | 55/100 | Code ready, credentials not configured |
| Performance | 78/100 | Compression, caching, indexes — no Redis |
| Monitoring | 82/100 | Health endpoints, error logging, audit trail |
| **Overall** | **77/100** | Ready for beta; address R1-R3 before full launch |
