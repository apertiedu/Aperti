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
- **Deep dive**: Admin OS → Analytics Deep Dive (user growth, revenue, retention, errors)
- **Performance**: Admin OS → Slow Queries / Performance

### 5. Error Monitoring
- **Frontend errors**: Admin OS → Error Intelligence
- **Backend errors**: Admin OS → DB Health → Errors (24h)
- **Launch certification**: Admin OS → Launch Certification

### 6. Platform Health
- **Database**: Admin OS → Database Health (size, slow queries, VACUUM)
- **Route health**: Admin OS → Route Health
- **System uptime**: `/health` endpoint (always-on, no auth)

## FAQs

**Q: A teacher can't log in.**
A: Check Admin OS → Users → find the account → ensure Status is Active.

**Q: The platform feels slow.**
A: Check Admin OS → Performance → top 10 slowest endpoints. Then Admin OS → DB Health → run VACUUM ANALYZE.

**Q: How do I add a new plan?**
A: Admin OS → Plans → New Plan. Set `is_recommended: true` to highlight it on the pricing page.
