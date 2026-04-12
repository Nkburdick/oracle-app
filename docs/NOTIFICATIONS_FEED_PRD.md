# Notifications Feed — In-App Notification Surface

## Overview

Replace Telegram TLDR pings with an in-app notification feed. Bell icon in the header with dropdown panel showing recent notifications. Tapping a notification navigates to the relevant context (project chat, Drive report, etc.). This is step #4 on the Telegram exit critical path — the last real engineering work before the soak.

**Two PRs:**

- **PR 1 (Pennyworth):** `notifications` table + CRUD endpoints + modify existing notification call sites
- **PR 2 (Oracle App):** Bell icon + dropdown panel + proxy routes + SSE integration

## Architecture

### Notification Flow

```
Pennyworth event (chat reply, task done, Drive upload, health alert)
  ↓ writes to notifications table
  ↓ sends Web Push (existing infrastructure)
  ↓ SSE broadcast to Oracle App
  ↓
Oracle App bell updates (unread count badge)
  ↓ user taps bell
  ↓ dropdown shows recent notifications
  ↓ user taps notification → navigates to context URL
```

### Data Model

```sql
CREATE TABLE notifications (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  url         TEXT,                          -- deep link (e.g., /projects/stridemind-ai)
  severity    TEXT NOT NULL DEFAULT 'info',  -- info | warn | critical
  category    TEXT NOT NULL DEFAULT 'chat',  -- chat | task | drive | health
  read        INTEGER NOT NULL DEFAULT 0,   -- boolean
  oracleSlug  TEXT,                          -- optional project/area link
  createdAt   INTEGER NOT NULL              -- unix timestamp
);

CREATE INDEX notifications_read_created_idx ON notifications (read, createdAt DESC);
```

### Notification Types

| Category | When                             | Title Example                         | URL                       |
| -------- | -------------------------------- | ------------------------------------- | ------------------------- |
| `chat`   | Chat response ready (async/long) | "Alfred replied in StrideMind"        | `/projects/stridemind-ai` |
| `task`   | Background task completed        | "Research complete: PWA requirements" | `/projects/oracle`        |
| `drive`  | Drive report uploaded            | "Report uploaded to Drive"            | Drive link                |
| `health` | Credential expiry, sync failure  | "OAuth token expires in 24h"          | null                      |

### Retention

- Max 50 notifications
- Auto-purge older than 7 days
- Purge runs on every write (simple — check count + age, delete excess)

---

## PR 1: Pennyworth Backend

### New Files

| File                            | What                                                                      |
| ------------------------------- | ------------------------------------------------------------------------- |
| `src/db/schema.ts`              | Add `notifications` table                                                 |
| `src/services/notifications.ts` | `createNotification()`, `listNotifications()`, `markRead()`, `purgeOld()` |
| `src/api/server.ts`             | 4 new endpoints                                                           |

### Migration

Add `notifications` table to the schema bootstrap in `src/db/client.ts` (same inline CREATE TABLE pattern as conversations/messages).

### Endpoints

| Method | Path                          | Body/Params         | Response                            |
| ------ | ----------------------------- | ------------------- | ----------------------------------- |
| GET    | `/api/notifications`          | `?unread_only=true` | `{ notifications: Notification[] }` |
| POST   | `/api/notifications/:id/read` | —                   | `{ ok: true }`                      |
| POST   | `/api/notifications/read-all` | —                   | `{ ok: true }`                      |
| DELETE | `/api/notifications/:id`      | —                   | `{ deleted: id }`                   |

Notifications are **created internally** by Pennyworth services (not via a public POST endpoint). The services call `createNotification()` directly.

### Call Site Integration

Modify existing Pennyworth code to create notifications:

1. **`src/services/chat.ts`** — after persisting assistant message, if response is from a background/async context, create a `chat` notification
2. **`src/services/tasks.ts`** — when a task completes, create a `task` notification
3. **Google Drive upload** — after successful upload in chat.ts, create a `drive` notification
4. **Health checks** — credential expiry warnings create `health` notifications

### Acceptance Criteria — PR 1

- AC-B1: `notifications` table exists with id, title, body, url, severity, category, read, oracleSlug, createdAt
- AC-B2: `GET /api/notifications` returns list sorted by createdAt DESC
- AC-B3: `GET /api/notifications?unread_only=true` filters to unread
- AC-B4: `POST /api/notifications/:id/read` marks a notification as read
- AC-B5: `POST /api/notifications/read-all` marks all as read
- AC-B6: `DELETE /api/notifications/:id` removes a notification
- AC-B7: Auto-purge: keeps max 50 notifications, deletes older than 7 days
- AC-B8: `createNotification()` called after Drive upload in chat handler
- AC-B9: `createNotification()` called on task completion
- AC-B10: Bearer auth required on all endpoints
- AC-B11: Existing tests still pass
- AC-B12: At least 6 new integration tests for notification endpoints

---

## PR 2: Oracle App Frontend

### New/Modified Files

| File                                                        | What                                      |
| ----------------------------------------------------------- | ----------------------------------------- |
| **NEW** `src/lib/components/NotificationBell.svelte`        | Bell icon + unread badge + dropdown panel |
| **NEW** `src/routes/api/notifications/+server.ts`           | GET proxy                                 |
| **NEW** `src/routes/api/notifications/[id]/read/+server.ts` | POST proxy                                |
| **NEW** `src/routes/api/notifications/read-all/+server.ts`  | POST proxy                                |
| `src/routes/+layout.svelte`                                 | Add NotificationBell to header            |
| `src/routes/api/events/+server.ts`                          | Add notification event type to SSE        |

### NotificationBell Component

```
┌──────────────────────────────────────┐
│ [Project Title]        🔔(3) [Edit] │  ← header
├──────────────────────────────────────┤
```

When clicked, dropdown appears:

```
         ┌────────────────────────────┐
    🔔   │ Notifications              │
         ├────────────────────────────┤
         │ ● Alfred replied in        │
         │   StrideMind chat          │
         │   2 min ago                │
         ├────────────────────────────┤
         │ ○ Research complete         │
         │   Drive report ready       │
         │   15 min ago               │
         ├────────────────────────────┤
         │ ○ OAuth token expires 24h  │
         │   ⚠ warn                   │
         │   1 hour ago               │
         ├────────────────────────────┤
         │ Mark all read    View all  │
         └────────────────────────────┘
```

- `●` = unread, `○` = read
- Click notification → close dropdown, navigate to `url`
- "Mark all read" → POST read-all
- "View all" → /notifications page (future, for now just shows all in dropdown)
- Click outside → close dropdown
- Severity `warn`/`critical` gets a colored accent

### SSE Integration

The existing `/api/events` SSE endpoint broadcasts file-change events. Add a new event type:

```
event: notification
data: {"id": "abc", "title": "Alfred replied", "unreadCount": 3}
```

When `NotificationBell` receives this event via the existing EventSource in `+layout.svelte`, it:

1. Increments the unread count badge
2. Optionally re-fetches the notification list if the dropdown is open

### Acceptance Criteria — PR 2

- AC-F1: Bell icon visible in header on every page (desktop + mobile)
- AC-F2: Unread count badge shows number when > 0
- AC-F3: Badge hidden when unread count is 0
- AC-F4: Click bell opens dropdown panel
- AC-F5: Dropdown shows last 10 notifications sorted newest first
- AC-F6: Unread notifications show filled dot (●), read show empty (○)
- AC-F7: Click notification navigates to its URL and marks it read
- AC-F8: "Mark all read" button marks all as read
- AC-F9: Click outside dropdown closes it
- AC-F10: SSE notification event updates badge count in real-time
- AC-F11: Severity warn/critical gets visual accent
- AC-F12: Proxy routes forward to Pennyworth with auth
- AC-F13: Dropdown works on mobile (positioned correctly)
- AC-F14: Existing tests pass
- AC-F15: TypeScript compiles clean

---

## UX Decisions Locked

| #   | Decision                                        |
| --- | ----------------------------------------------- |
| Q1  | Bell in header top-right, visible everywhere    |
| Q2  | Dropdown panel (not drawer or full page)        |
| Q3  | Chat + task + Drive + health notification types |
| Q4  | 7-day retention, max 50                         |
| Q5  | Deep links — tap navigates to context           |
| Q6  | Piggyback on existing SSE connection            |
| Q7  | Two PRs: Pennyworth first, then Oracle App      |
