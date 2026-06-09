---
name: Phase 17 Mobile Ecosystem
description: PWA, responsive layout, push notifications (web-push), offline sync, mobile dashboards, Flashcard 3.0 swipe, admin push page, push triggers on key events.
---

## DB tables added (PHASE17_MIGRATIONS)
- `push_subscriptions` — user_id, endpoint, auth, p256dh; UNIQUE(user_id, endpoint)
- `offline_sync_queue` — user_id, action, payload(jsonb), status(pending/synced/failed)

## Backend API (all in routes/mobile.ts)
- `GET /api/push/vapid-key` — public, returns VAPID public key for browser subscription
- `POST /api/push/subscribe` — save push subscription object
- `POST /api/push/unsubscribe` — remove by endpoint
- `POST /api/admin/push/send` — target: "user"|"role"|"all", title, body, url
- `GET /api/admin/push/stats` — byRole subscriber counts + total
- `POST /api/offline/sync` — apply queued actions (submit_answer, update_note)
- `GET /api/offline/pending` — list pending queue items
- `GET /api/mobile/student-home` — todayTasks, upcomingAssessments, notifications, goals
- `GET /api/mobile/teacher-home` — todayLessons, pendingGrading, todayAttendance
- `GET /api/mobile/parent-home` — children, attendance, recentGrades, announcements
- `GET /api/mobile/admin-home` — totalUsers, mrr, pendingPayments, status (admin only)
- `POST /api/upload/camera` — base64 image upload helper

## Web Push utility (lib/push.ts)
- Uses web-push npm package (installed in api-server)
- VAPID keys loaded from VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY env vars
- If not set: auto-generates ephemeral keys on startup (not persistent across restarts)
- Expired subs (410/404 from sendNotification) are auto-deleted
- Key functions: saveSubscription, removeSubscription, sendPushToUser, sendPushToRole, sendPushToAll

## Push triggers on existing routes (added Phase 17 completion)
- **Homework published** (`routes/homework.ts` POST `/`) → `sendPushToRole("student", ...)`
- **Homework graded** (`routes/homework.ts` POST `/:id/submissions/:subId/grade`) → `sendPushToUser(studentId, ...)`
- **Subscription verified** (`routes/commerce.ts` PUT `/admin/commerce/payment-requests/:id/verify`) → `sendPushToUser(pr.user_id, ...)`
- **Announcement created** (`routes/comm-threads.ts` POST `/announcements`) → `sendPushToRole(audience_type, ...)` or `sendPushToAll()` for "all"; skipped for scheduled

## requireRole middleware
- `requireRole` DOES exist in `middleware/auth.ts` — used in homework.ts, comm-threads.ts, commerce.ts etc.
- Earlier note saying it doesn't exist was WRONG. It is a valid export.

## Frontend components
- `components/mobile-bottom-nav.tsx` — role-specific 5-tab bottom nav, hidden on `lg:` screens; uses Framer Motion `layoutId` indicator
- `components/pwa-install-banner.tsx` — beforeinstallprompt banner + push permission banner (both dismissible, persisted in localStorage)
- `hooks/use-pwa.ts` — usePWA() hook: canInstall, triggerInstall, pushSupported, pushPermission, isSubscribed, subscribeToPush, unsubscribeFromPush; also exports openOfflineDB(), queueOfflineAction(), saveOfflineContent(), getOfflineContent()

## Camera capture on handwritten-submit.tsx
- Two hidden `<input type="file">` elements: one with `capture="environment"` (camera), one without (gallery picker)
- FileReader converts file to data URL — fed into imageUrl state for preview + AI processing
- Process button appears only when imageUrl is set
- URL input still present as fallback (shows empty if data URL is selected)

## Layout changes (layout.tsx)
- Desktop sidebar: `hidden lg:flex` — hidden on mobile
- Added hamburger (Menu icon) button in topbar — `lg:hidden`, opens Sheet drawer
- SidebarContent extracted as inner component accepting `isMobile` prop
- Main content: `pb-20 lg:pb-7` to clear bottom nav on mobile
- Padding: `p-4 lg:p-7` responsive
- MobileBottomNav rendered at bottom of Layout

## Mobile pages
- `pages/mobile/student-home.tsx` — today tasks, progress ring, quick actions, upcoming exams
- `pages/mobile/teacher-home.tsx` — today schedule, attendance bar, grading count
- `pages/mobile/parent-home.tsx` — child cards with attendance ring, recent grades, announcements
- `pages/mobile/admin-home.tsx` — metric cards (users/MRR/ARR/pending), quick admin action list
- All at route `/mobile/home` (role-aware routing in App.tsx picks the right component)

## Flashcard 3.0 (`pages/student/flashcard-swipe.tsx`)
- Full-screen drag-to-swipe (Framer Motion drag)
- Right swipe = "easy" (green), left swipe = "hard" (red)
- Tap card to flip front/back
- 3 button ratings: Got it / Almost / Again
- Visual confidence dots tracking last 12 cards
- Session summary screen with per-category counts

## Admin Push page (`pages/admin/admin-push.tsx`)
- Live subscriber stats from `/api/admin/push/stats`
- Target selector: All / Role / User ID
- Compose form with preview
- POST to `/api/admin/push/send`

## PWA / Service Worker
- `public/sw.js` v3 — cache-first static, network-first HTML, offline fallback to /offline.html
- Push event handler → `self.registration.showNotification`
- Background sync tag `offline-sync` → calls syncOfflineQueue()
- `public/offline.html` — styled offline fallback page
- `public/manifest.json` — already present with correct theme_color and standalone display
- SW registered only in PROD (`import.meta.env.PROD`) in main.tsx

## Student layout cleanup
- Removed deprecated nav items: `/live-class` (LiveClass removed Ph16), `/inkspace` (InkSpace removed Ph16)
- Removed unused Video, Pencil icon imports
