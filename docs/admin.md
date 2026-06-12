# Admin Guide — Aperti

## Getting Started
Sign in at `/login` with your admin credentials. You'll land on the Admin OS dashboard at `/admin/os`.

## Key Workflows

### 1. Managing Users
- **Create users**: Admin OS → Users → Invite User
- **Change roles**: Users → Edit → set Role
- **Suspend/reactivate**: Users → ⋯ menu → Suspend

### 2. Managing Courses
- **View all courses**: Admin OS → Courses
- **Approve a course**: Courses → select course → Set Visibility → Published
- **Monitor quality**: Courses → Course Health badge per course

### 3. Plans & Subscriptions
- **View plans**: Admin OS → Plans
- **Manage subscriptions**: Admin OS → Subscriptions → filter by status

### 4. Analytics
- **Overview**: Admin OS → Analytics → Dashboard tab
- **User growth**: Analytics → Users tab — growth chart, role breakdown
- **Course data**: Analytics → Courses tab — enrollment growth
- **AI usage**: Analytics → AI tab — monthly interaction trend
- **Retention**: Analytics → Retention tab — 30/60/90-day retention rates and engagement funnel

### 5. Error Monitoring
- **Frontend errors**: Admin OS → Error Intelligence
- **Backend errors**: Admin OS → DB Health → Errors (24h)
- **Launch certification**: Admin OS → Launch Certification

### 6. Platform Health
- **System health**: Founder Control Center → System Health section
- **DB health**: Admin OS → DB Health — table sizes, slow queries, connection counts
- **Health API**: `GET /api/health` — returns db latency, memory, uptime, table count

### 7. Search System
- All searches use ILIKE matching with pg_trgm fuzzy similarity when the extension is enabled
- Syllabus codes (0625, 9709, etc.) are mapped to subject names for richer results
- Question text content is included in search

### 8. Founder Insight Center
Path: `/admin/os/founder`
Shows real-time: active users, revenue MTD/YTD, open tickets, content counts, platform quality score, launch certification readiness, and health checks.

Quick links to: Revenue Deep Dive, Growth Analytics, Content Quality, AI Costs, Founder Alerts, Launch Command.

### 9. Performance Monitoring
Admin OS → DB Health → Slow Queries section shows the top 10 slowest endpoints in the last 24 hours.
All API requests are timed — routes over 500ms are flagged.

### 10. Feature Flags
Table `platform_feature_flags` controls graduated feature rollout by percentage.
Currently active: pg_trgm_search, ai_question_extract, smart_flashcards.

## Security & Compliance
- **Audit logs**: every admin action is logged in `audit_logs` with IP and user ID
- **ShieldCore**: Admin OS → ShieldCore for access control and security settings
- **Password resets**: Admin OS → Users → Reset Password for any account
- **Session security**: sessions expire after inactivity; JWT tokens expire after 24h

## Tips
- Use **WorldPilot** for a bird's eye view of all organizations on the platform.
- **QuickSwitch** lets you impersonate another user for debugging (admin only, fully audited).
- The **Founder Control Center** at `/admin/os/founder` is your single source of truth for platform health.
