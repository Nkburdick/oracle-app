# Phase 2.B.4 — Mobile-First Chat Redesign

**Status:** DRAFT — pending Nick's review
**Author:** Alfred (PAI Algorithm v3.7.0)
**Date:** 2026-04-10
**Prerequisite:** Phase 2.B Minimal Chat (SHIPPED 2026-04-07, ORACLE#24-28)
**Depends on:** No backend changes. Pennyworth API is stable and unchanged.
**Repo:** `Nkburdick/ORACLE` — all changes in `app/` directory
**Stack:** SvelteKit 2.x + TypeScript (strict) + TailwindCSS 4 + shadcn-svelte + Bun

---

## 1. Problem Statement

Oracle App's chat is built desktop-first: a 224px thread rail sits beside a fluid messages pane. On mobile (<768px), both panels compress into an unreadable layout — the thread rail eats screen width, messages become a narrow sliver, and the experience is unusable.

Nick uses Oracle App **primarily on mobile, on the go**. Chat is the highest-value feature. This means mobile chat is not a nice-to-have responsive tweak — it's the primary use case that must work flawlessly.

Phase 2.B.4 redesigns chat as mobile-first: two stacked screens with route-based navigation, then scales UP to the existing desktop two-panel layout at the `md` breakpoint. This is the first step in the Telegram exit plan.

### 1.1 What This PRD Covers

- Mobile thread list (full-width, Screen 1)
- Mobile active thread (full-screen chat, Screen 2)
- Route-based navigation between the two screens
- iOS Safari compatibility (keyboard, safe area, viewport)
- Message composer behavior on mobile
- Chat header with thread management overflow menu
- Desktop layout preservation (zero changes to md+ behavior)

### 1.2 What This PRD Does NOT Cover

- SSE streaming (Phase 2.B.1)
- Markdown rendering in messages (Phase 2.B.1)
- Global FAB chat (Phase 2.B.2)
- Artifacts tab (Phase 2.B.3)
- Pennyworth-suggested thread spinoff (Phase 2.B.5)
- PWA install / service worker (Phase 3)
- Web push notifications UI (separate from Phase 2.B.4)

---

## 2. Architecture

### 2.1 Two-Screen Route-Based Pattern

Mobile chat uses SvelteKit routes for navigation state. This was chosen over component-state toggling because:

- Browser back button works natively (no custom history management)
- URLs are bookmarkable and shareable
- SvelteKit handles page transitions
- State is URL-based, not component-based (survives refresh)

**Routes:**

| Route                               | Mobile (<768px)           | Desktop (768px+)                                                                         |
| ----------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------- |
| `/projects/[slug]` (Chats tab)      | Full-width thread list    | Existing two-panel layout (thread rail + messages)                                       |
| `/projects/[slug]/chats/[threadId]` | Full-screen active thread | Redirect to `/projects/[slug]` with thread pre-selected (desktop doesn't use this route) |

**Key implication:** On desktop, clicking a thread does NOT navigate — it selects inline in the two-panel layout (existing behavior). On mobile, clicking a thread navigates to `/projects/[slug]/chats/[threadId]`. The responsive behavior is determined by viewport width at navigation time.

### 2.2 New Files Required

```
src/routes/projects/[slug]/chats/[threadId]/
  +page.svelte          ← Mobile active thread view
  +page.server.ts       ← Loads thread + messages from Pennyworth API
```

### 2.3 Modified Files

```
src/lib/components/ProjectChats.svelte   ← Conditional render: mobile list vs desktop two-panel
src/routes/projects/[slug]/+page.svelte  ← Thread click handler: navigate on mobile, select on desktop
src/routes/+layout.svelte                ← Composer safe-area handling
src/app.css                              ← dvh, safe-area, overscroll utilities
```

### 2.4 Data Flow

```
Mobile thread list:
  /projects/[slug]/+page.server.ts → loads threads (existing)
  ProjectChats.svelte → renders full-width thread list on mobile

Mobile active thread:
  /projects/[slug]/chats/[threadId]/+page.server.ts → loads thread + messages
  +page.svelte → renders full-screen chat (header + messages + composer)

Desktop (unchanged):
  /projects/[slug]/+page.server.ts → loads threads + messages for most-recent thread
  ProjectChats.svelte → renders two-panel layout (thread rail + messages)
```

---

## 3. Mobile Thread List (Screen 1)

The thread list renders as a full-width vertical list on viewports below 768px. The desktop thread rail (`w-56` side panel) is hidden on mobile — replaced by this full-width list.

### 3.1 Layout

```
┌─────────────────────────────────┐
│ ← Project Name                  │  ← existing project detail header
├─────────────────────────────────┤
│ Chats | Artifacts | SOW         │  ← existing tab bar (Chats active)
├─────────────────────────────────┤
│ [THREADS]              [+ New]  │  ← section label + create button
├─────────────────────────────────┤
│ ● Deploy review          2m ▸  │  ← persistent thread, tap to enter
│ · Quick question about    1h ▸  │  ← ephemeral thread
│ · Research task for St…   3h ▸  │  ← truncated title
│ · New conversation       now ▸  │
│                                 │
│                                 │
├─────────────────────────────────┤
│ 🏠  📁  📖  ⚙️                 │  ← bottom tab bar (visible)
└─────────────────────────────────┘
```

### 3.2 Thread Row Design

Each thread row contains:

- **Left:** Status indicator (● persistent, · ephemeral) + thread title (truncated with ellipsis)
- **Right:** Relative timestamp + chevron (▸) indicating drill-in affordance
- **Height:** Minimum 48px (44px touch target + 4px padding) for comfortable tapping
- **Active state:** Row highlight on tap (background shift, not shadow — per design system)

### 3.3 Interactions

- **Tap row** → Navigate to `/projects/[slug]/chats/[threadId]`
- **Long-press row** → Context sheet with Delete / Promote (existing Phase 2.B behavior)
- **Tap [+ New]** → POST create throwaway thread → navigate to new thread immediately (zero additional taps)
- **Scroll** → Standard vertical scroll, overscroll-behavior: contain

### 3.4 Empty State

When no threads exist:

```
┌─────────────────────────────────┐
│                                 │
│      No conversations yet       │
│                                 │
│      Start a conversation       │
│      with Alfred about this     │
│      project.                   │
│                                 │
│         [+ New Chat]            │  ← prominent CTA button
│                                 │
└─────────────────────────────────┘
```

---

## 4. Mobile Active Thread (Screen 2)

Full-screen chat view at the `/projects/[slug]/chats/[threadId]` route.

### 4.1 Layout

```
┌─────────────────────────────────┐
│ ←  Deploy review            ⋯  │  ← chat header (back + title + overflow)
├─────────────────────────────────┤
│                                 │
│  ┌─────────────────────────┐    │
│  │ Alfred                  │    │  ← assistant message
│  │ Here's the analysis you │    │
│  │ asked for. The deploy   │    │
│  │ looks healthy...        │    │
│  └─────────────────────────┘    │
│                                 │
│       ┌─────────────────────┐   │
│       │ Thanks, can you     │   │  ← user message (right-aligned)
│       │ also check the      │   │
│       │ staging env?        │   │
│       └─────────────────────┘   │
│                                 │
│  ┌─────────────────────────┐    │
│  │ Alfred                  │    │
│  │ Checking staging now... │    │
│  └─────────────────────────┘    │
│                                 │
├─────────────────────────────────┤
│ ┌───────────────────────┐ [▶]  │  ← composer (above tab bar)
│ │ Message...             │      │
│ └───────────────────────┘       │
├─────────────────────────────────┤
│ 🏠  📁  📖  ⚙️                 │  ← bottom tab bar (stays visible)
└─────────────────────────────────┘
```

### 4.2 Chat Header

- **Back arrow (←):** Left-aligned. Navigates to `/projects/[slug]` (thread list). Uses `history.back()` if available, falls back to programmatic navigation.
- **Thread title:** Center-aligned, truncated with ellipsis at viewport width. Displays "New conversation" for unnamed throwaway threads.
- **Overflow menu (⋯):** Right-aligned. Three-dot button opening a dropdown/bottom sheet with:
  - **Rename thread** — enables inline title editing in the header
  - **Promote to persistent** (★) — only shown for ephemeral threads
  - **Delete thread** — shows confirmation dialog for persistent threads only; ephemeral threads delete immediately. After delete, navigates back to thread list.

### 4.3 Messages Container

- Fills the space between the chat header and the composer
- Scrollable with `overflow-y: auto` and `-webkit-overflow-scrolling: touch`
- `overscroll-behavior: contain` — prevents elastic bounce from propagating to the page
- Auto-scrolls to bottom on new messages (user or assistant)
- If user has scrolled up (more than 1 viewport height from bottom), auto-scroll is suppressed
- A "↓ New messages" pill appears at the bottom of the viewport when the user is scrolled up and new messages arrive. Tapping the pill scrolls to bottom.

### 4.4 Message Bubbles

- **User messages:** Right-aligned, primary background (copper tint), rounded corners
- **Assistant messages:** Left-aligned, card/muted background, rounded corners
- **Role label:** "Alfred" above assistant messages (no label on user messages — right alignment is sufficient)
- **Timestamp:** Below each message, muted-foreground, small text
- **Failed message:** Red border, inline "[Retry]" button below the message

### 4.5 Optimistic Send

Matches Phase 2.B behavior:

1. User taps Send → message appears immediately in the UI (optimistic)
2. Background POST to Pennyworth `/api/projects/[slug]/threads/[threadId]/chat`
3. On success: reconcile with server response (update message ID, append assistant reply)
4. On failure: one silent auto-retry after 1s; if still failing, show "[Retry]" button on the message

---

## 5. Message Composer (Mobile)

### 5.1 Position

The composer is positioned **above the bottom tab bar**, which remains visible per Q1 decision. On iOS Safari, this means:

- Composer bottom edge = `env(safe-area-inset-bottom)` + tab bar height (approximately 52px)
- When the virtual keyboard opens, the composer moves up with the keyboard (browser default behavior with `100dvh` layout)

### 5.2 Textarea

- Auto-grows from 1 line to 4 lines, then scrolls internally
- Placeholder text: "Message..."
- `font-family: var(--font-mono)` (Geist Mono, matching the design system)
- `font-size: 16px` minimum — prevents iOS Safari auto-zoom on focus

### 5.3 Send Button

- Positioned to the right of the textarea
- Minimum 44px x 44px touch target
- Primary color (copper) when active
- Muted/disabled when textarea is empty or message is in-flight
- Tapping Send: clears textarea, posts message, focuses textarea for next message

### 5.4 Keyboard Behavior

- **Enter key** inserts a newline (per Phase 2.B Q6 decision — mobile send is button-only)
- When the iOS keyboard opens, the layout adjusts via `100dvh` and the `visualViewport` API
- No layout shift — the messages container shrinks, the composer stays anchored above the keyboard
- When the keyboard closes, the layout restores without jank

---

## 6. Navigation & Transitions

### 6.1 Mobile Navigation Flow

```
Bottom Tab Bar → Projects → /projects
                          → tap project → /projects/[slug]  (thread list)
                                        → tap thread → /projects/[slug]/chats/[threadId]
                                        → ← back → /projects/[slug]
                          → tap + New → create thread → /projects/[slug]/chats/[newId]
```

### 6.2 Browser Back Button

The route-based pattern means the browser back button works natively:

- In active thread → back → thread list
- In thread list → back → projects list (or previous page)

No custom `popstate` listeners needed. SvelteKit handles this.

### 6.3 Thread List Scroll Preservation

When navigating from thread list → active thread → back to thread list, the scroll position must be preserved. Strategy:

- SvelteKit's default `history.scrollRestoration` handles this for page-level scroll
- The thread list is within the main scrollable area (not a separate scroll container), so SvelteKit's built-in scroll restoration should work
- If SvelteKit's restoration is unreliable, fall back to storing `scrollTop` in a Svelte store keyed by project slug, and restoring on mount

### 6.4 Transition Speed

Page transitions should feel instantaneous (<200ms). Strategy:

- The thread's messages are loaded via `+page.server.ts` (SSR), so the page arrives with content
- SvelteKit's client-side navigation prefetches on hover/tap-start (`data-sveltekit-preload-data`)
- Show a skeleton placeholder if the load takes >100ms (rare, messages are small payloads)

### 6.5 Tab Bar Behavior

The bottom tab bar (MobileTabBar.svelte) **remains visible on all screens**, including inside the active thread view. This was a deliberate decision (Q1) for navigation consistency. The composer sits above the tab bar.

### 6.6 Desktop Behavior (Unchanged)

On desktop (md+):

- Thread clicks select inline in the two-panel layout (no route navigation)
- The `/projects/[slug]/chats/[threadId]` route, if accessed on desktop, should redirect to `/projects/[slug]` with the thread pre-selected via a query parameter or store
- The two-panel layout (w-56 thread rail + flex-1 messages) is completely unchanged
- No new CSS, no new components, no behavior changes above 768px

---

## 7. iOS Safari Compatibility

### 7.1 Viewport Height

Use `100dvh` (dynamic viewport height) instead of `100vh` for all full-height containers. This accounts for Safari's collapsible URL bar.

### 7.2 Safe Area Insets

```css
/* Composer needs bottom safe area when tab bar has it */
.chat-composer {
	padding-bottom: env(safe-area-inset-bottom, 0px);
}
```

The MobileTabBar already handles safe area. The composer sits above it, so it inherits the spacing. Only needed if tab bar is ever removed from the flow.

### 7.3 Keyboard Handling

- Use `visualViewport` API to detect keyboard open/close
- The messages container height = viewport height - header height - composer height - tab bar height
- When the keyboard opens, the viewport shrinks, which naturally pushes the composer up
- Ensure `font-size: 16px` minimum on the textarea to prevent Safari's auto-zoom behavior

### 7.4 Overscroll Control

```css
.messages-container {
	overscroll-behavior: contain;
	-webkit-overflow-scrolling: touch;
}
```

Prevents elastic bounce from propagating from the messages scroll area to the page level.

### 7.5 Touch Targets

All interactive elements must be at least 44px x 44px per Apple HIG:

- Thread rows: 48px minimum height
- Send button: 44px x 44px
- Back arrow: 44px touch target (even if icon is smaller)
- Overflow menu button: 44px touch target

---

## 8. Responsive Breakpoint Logic

**Single breakpoint: `md` (768px)**

This matches the existing breakpoints used by:

- `Sidebar.svelte`: `hidden md:flex`
- `MobileTabBar.svelte`: `md:hidden`

| Viewport                | Layout                                          |
| ----------------------- | ----------------------------------------------- |
| <768px (mobile)         | Stacked two-screen: thread list → active thread |
| 768px+ (tablet/desktop) | Two-panel: thread rail + messages (existing)    |

**Testing widths:**

- 375px — iPhone SE, iPhone 13 mini
- 390px — iPhone 14/15 standard
- 414px — iPhone Plus/Max
- 768px — iPad mini (portrait), breakpoint boundary
- 1024px+ — desktop

---

## 9. Acceptance Criteria

### 9.1 Mobile Thread List (Screen 1)

- [ ] AC-1: Thread list renders full-width on viewports below 768px
- [ ] AC-2: Desktop thread rail (w-56 side panel) is hidden below 768px
- [ ] AC-3: Each thread row shows title, relative timestamp, and ephemeral/persistent indicator
- [ ] AC-4: Thread rows have minimum 48px height (44px touch target)
- [ ] AC-5: Thread list sorted by most-recent-activity descending
- [ ] AC-6: "+ New" button visible without scrolling on mobile
- [ ] AC-7: Tapping thread row navigates to /projects/[slug]/chats/[threadId]
- [ ] AC-8: Long-press on thread row opens context menu (delete/promote)
- [ ] AC-9: Thread list preserves scroll position on back-navigation

### 9.2 Mobile Active Thread (Screen 2)

- [ ] AC-10: Active thread renders full-width below 768px
- [ ] AC-11: Back button in header returns to thread list
- [ ] AC-12: Header shows thread title truncated at viewport width
- [ ] AC-13: Messages render chronologically with role indicators
- [ ] AC-14: Messages container fills height between header and composer
- [ ] AC-15: New messages auto-scroll to bottom
- [ ] AC-16: Scrolling up disengages auto-scroll (no snap-back)
- [ ] AC-17: "Scroll to bottom" pill appears when scrolled up and new messages arrive

### 9.3 Chat Header & Thread Management

- [ ] AC-18: Header layout: back arrow (left) + thread title (center) + overflow (right)
- [ ] AC-19: Overflow menu (⋯) opens with Rename, Promote, Delete
- [ ] AC-20: Rename enables inline title editing in header
- [ ] AC-21: Delete shows confirmation for persistent threads only
- [ ] AC-22: Delete navigates back to thread list after completion
- [ ] AC-23: Promote option hidden for already-persistent threads

### 9.4 Message Composer

- [ ] AC-24: Composer positioned above the bottom tab bar on mobile
- [ ] AC-25: Composer visible above iOS virtual keyboard when keyboard opens
- [ ] AC-26: Textarea auto-grows from 1 line to 4 lines, then scrolls
- [ ] AC-27: Send button minimum 44px touch target
- [ ] AC-28: Send disabled when textarea empty or message in-flight
- [ ] AC-29: Send clears textarea and shows optimistic message immediately
- [ ] AC-30: Enter key inserts newline (does not send)

### 9.5 Navigation & Transitions

- [ ] AC-31: Mobile chat uses route /projects/[slug]/chats/[threadId]
- [ ] AC-32: Browser back button returns from thread to thread list
- [ ] AC-33: Bottom tab bar visible on thread list screen
- [ ] AC-34: Bottom tab bar visible on active thread screen
- [ ] AC-35: Thread-to-thread navigation feels instantaneous (<200ms)
- [ ] AC-36: Back-navigation does not trigger full page reload
- [ ] AC-37: "+ New" creates throwaway thread and navigates to it immediately
- [ ] AC-38: Thread list reflects new/deleted threads on back-navigation

### 9.6 Desktop Preservation

- [ ] AC-39: Desktop (md+) retains two-panel layout (thread rail + messages)
- [ ] AC-40: Desktop layout unchanged from Phase 2.B behavior
- [ ] AC-41: Desktop thread selection stays inline (no route navigation)
- [ ] AC-42: Desktop thread rail width remains w-56
- [ ] AC-43: /projects/[slug]/chats/[threadId] on desktop redirects to /projects/[slug]

### 9.7 iOS Safari Compatibility

- [ ] AC-44: Layout uses 100dvh for full-height containers
- [ ] AC-45: Composer respects env(safe-area-inset-bottom) on notch devices
- [ ] AC-46: Overscroll bounce contained within messages container
- [ ] AC-47: No layout shift when iOS virtual keyboard opens or closes
- [ ] AC-48: Textarea font-size >= 16px (prevents iOS auto-zoom)

### 9.8 Responsive Breakpoint

- [ ] AC-49: Single breakpoint at md (768px) separates mobile and desktop
- [ ] AC-50: Mobile layout correct at 375px width
- [ ] AC-51: Mobile layout correct at 414px width
- [ ] AC-52: Tablet (768px-1024px) uses desktop two-panel layout

### 9.9 Error States & Edge Cases

- [ ] AC-53: Empty thread list shows "No conversations yet" with prominent CTA
- [ ] AC-54: Failed message send shows inline retry button
- [ ] AC-55: Loading state shows skeleton while thread messages load
- [ ] AC-56: Invalid/deleted thread ID redirects to thread list

### 9.10 Anti-Criteria

- [ ] AC-A-1: Thread rail and messages NEVER side-by-side below 768px
- [ ] AC-A-2: No horizontal scrolling on any mobile screen
- [ ] AC-A-3: No new Pennyworth API endpoints required
- [ ] AC-A-4: Desktop chat behavior unchanged
- [ ] AC-A-5: No custom swipe gestures conflicting with iOS Safari back

---

## 10. UX Decisions (Locked)

| #   | Question                     | Decision                              | Rationale                                                            |
| --- | ---------------------------- | ------------------------------------- | -------------------------------------------------------------------- |
| Q1  | Tab bar in active thread?    | **Visible**                           | Consistency with rest of app. Composer sits above tab bar.           |
| Q2  | "+ New" behavior on mobile?  | **Create + navigate immediately**     | Zero additional taps. Matches Phase 2.B Q1 (instant throwaway).      |
| Q3  | Chat header content?         | **← Back + Thread title**             | Clean iMessage pattern. One-line header, maximum message area.       |
| Q4  | Thread management in thread? | **⋯ overflow menu in header**         | Rename, Promote, Delete accessible while chatting. Discoverable.     |
| Q5  | Mobile navigation pattern?   | **Route-based** (`/chats/[threadId]`) | Browser back works natively. URL-based state. SvelteKit transitions. |
| Q6  | Breakpoint?                  | **md (768px)**                        | Matches Sidebar and MobileTabBar. Single source of truth.            |
| Q7  | Enter key on mobile?         | **Newline** (button sends)            | Matches Phase 2.B Q6 decision. Consistent across all devices.        |
| Q8  | Long-press on thread list?   | **Context sheet** (delete/promote)    | Matches Phase 2.B Q7 decision. Already implemented in AC-26.         |

---

## 11. Testing Plan

### 11.1 Viewport Testing Matrix

| Device Width | What to Verify                                        |
| ------------ | ----------------------------------------------------- |
| 375px        | Thread list full-width, chat full-screen, no h-scroll |
| 390px        | Same as 375px (iPhone 14 standard)                    |
| 414px        | Same as 375px (iPhone Plus)                           |
| 768px        | Desktop two-panel kicks in, thread rail visible       |
| 1024px       | Full desktop layout, existing behavior unchanged      |

### 11.2 Component Tests

- ProjectChats.svelte: conditional render (thread list on mobile, two-panel on desktop)
- Chat header: back button, title truncation, overflow menu
- Composer: auto-grow, send button state, keyboard behavior
- Thread row: tap navigation, long-press context menu

### 11.3 Integration Tests

- Create thread on mobile → navigate → send message → back → thread visible in list
- Delete thread from overflow menu → navigate back → thread removed from list
- Desktop thread click → stays inline (no route navigation)
- `/chats/[threadId]` on desktop → redirects to `/projects/[slug]`

### 11.4 iOS Safari Manual Testing

- Virtual keyboard open/close: no layout shift
- Safe area inset: composer not occluded on notch devices
- Overscroll bounce: contained in messages area
- Browser back gesture: returns to thread list (not browser history stack conflict)

---

## 12. Implementation Notes

### 12.1 Responsive Conditional in ProjectChats.svelte

The existing `ProjectChats.svelte` needs to detect viewport width and render:

- **Mobile (<md):** Full-width thread list only (no messages pane). Thread click = `goto()`.
- **Desktop (md+):** Existing two-panel layout unchanged. Thread click = state update.

Use Svelte's `$effect` with `matchMedia('(min-width: 768px)')` for reactive breakpoint detection. This is cheaper than Tailwind's `hidden md:block` because it controls which component tree is mounted, not just visibility.

### 12.2 New Route: /projects/[slug]/chats/[threadId]

The `+page.server.ts` loader:

1. Validate `threadId` exists via Pennyworth API
2. Load messages for the thread
3. If thread doesn't exist → redirect to `/projects/[slug]`

The `+page.svelte`:

1. Render chat header + messages + composer
2. On desktop viewport → redirect to `/projects/[slug]?thread=[threadId]`

### 12.3 Composer iOS Keyboard Strategy

```typescript
// In the active thread component
onMount(() => {
	if (window.visualViewport) {
		const handleResize = () => {
			// Adjust composer position based on visual viewport
			const offset = window.innerHeight - window.visualViewport.height;
			composerEl.style.transform = `translateY(-${offset}px)`;
		};
		window.visualViewport.addEventListener('resize', handleResize);
		return () => window.visualViewport.removeEventListener('resize', handleResize);
	}
});
```

This is a starting point — the Forge agent should test and refine based on actual iOS Safari behavior.

### 12.4 Thread List Scroll Restoration

SvelteKit's built-in `afterNavigate` + `scrollTo` should handle this. If not, store `scrollTop` in a Svelte store:

```typescript
const scrollPositions = new Map<string, number>();

// Before navigating away
scrollPositions.set(slug, containerEl.scrollTop);

// On mount (back-navigation)
const saved = scrollPositions.get(slug);
if (saved) containerEl.scrollTo(0, saved);
```

---

## 13. Scope & Sequencing

This PRD is **self-contained** — it can be built without any other Phase 2.B sub-phase. The only prerequisite is Phase 2.B Minimal Chat (already shipped).

**Estimated effort:** 2-3 Forge agent hours. ~600 lines of new/modified code across 4-6 files.

**Files touched:**

1. `src/routes/projects/[slug]/chats/[threadId]/+page.svelte` (NEW)
2. `src/routes/projects/[slug]/chats/[threadId]/+page.server.ts` (NEW)
3. `src/lib/components/ProjectChats.svelte` (MODIFY — responsive conditional)
4. `src/routes/projects/[slug]/+page.svelte` (MODIFY — thread click handler)
5. `src/app.css` (MODIFY — dvh, safe-area, overscroll utilities)
6. Component tests (NEW — thread list, chat header, composer)
