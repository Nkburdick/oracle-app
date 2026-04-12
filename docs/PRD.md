# Oracle App — MVP Shell PRD

**Status:** Draft
**Owner:** Nick Burdick
**Created:** 2026-04-05
**Target:** Forge dispatch (implementation-ready)
**Phase:** MVP Shell (navigation + project list + doc view, no chat)

---

## 1. Overview

### What

Oracle is Nick's personal operations PWA — a SvelteKit application that renders his ORACLE PARA data (`Projects/`, `Areas/`, `Archives/`) as a navigable, beautiful UI. It's the frontend face of the Pennyworth system.

### Who

Single user: Nick Burdick. No auth, no multi-tenancy. Internal tool.

### Why

Replace ad-hoc navigation of markdown files in GitHub/filesystem with a proper app interface. Make the ORACLE data feel alive. Set the foundation for chat integration (Phase 2) and mobile PWA install (Phase 3).

### MVP Shell Scope

**IN SCOPE:**

- Navigation shell: project/area tree sidebar
- Project list view (dashboard)
- Project detail view (renders PROJECT.md as wiki)
- Area detail view (renders AREA.md as wiki)
- Darkmatter theme (dark + light mode toggle)
- Geist Mono typography throughout
- Responsive: works on desktop + mobile browser
- Reads ORACLE data directly (filesystem or via build-time transform)

**OUT OF SCOPE (for this MVP):**

- Chat interface (Phase 2 — requires Pennyworth API)
- Artifacts tab (Phase 2)
- Task queue view (Phase 2)
- PWA manifest / service worker / offline (Phase 3)
- Search (Phase 2)
- Real-time updates (Phase 3)
- Mobile install as PWA (Phase 3)

---

## 2. Tech Stack

| Layer              | Choice                   | Version                                     |
| ------------------ | ------------------------ | ------------------------------------------- |
| Framework          | SvelteKit                | 2.x                                         |
| Language           | TypeScript               | 5.x                                         |
| Styling            | TailwindCSS              | 4.x (already installed)                     |
| UI Primitives      | shadcn-svelte            | latest                                      |
| Icons              | Lucide                   | via lucide-svelte                           |
| Font (UI)          | Geist Mono               | via `@fontsource/geist-mono` or self-hosted |
| Font (Code)        | JetBrains Mono           | already in design spec                      |
| Markdown Parser    | `mdsvex` or `marked`     | TBD in section 6                            |
| Frontmatter Parser | `gray-matter`            | TBD in section 6                            |
| Package Manager    | Bun                      | already installed                           |
| Build Adapter      | `@sveltejs/adapter-node` | Runtime SSR, decided 2026-04-06             |
| File Watcher       | `chokidar`               | For SSE live updates                        |

### Dependencies to Install

```
bun add -d @fontsource/geist-mono
bun add -d lucide-svelte
bun add -d mdsvex gray-matter
bunx shadcn-svelte@latest init
```

---

## 3. Design System — Darkmatter

> **NOTE:** This section will be drafted collaboratively with the frontend-design-expert agent. See `DESIGN_SYSTEM.md` for the full spec once generated.

### 3.1 Color Tokens (from tweakcn Darkmatter — actual values)

Darkmatter is NOT pure grayscale. It's a restrained palette with a warm copper primary (`#D87943`) and muted teal secondary (`#527575`) on a slightly slate-tinted neutral base. See `DESIGN_SYSTEM.md` for the full spec and usage rules.

**Dark Mode:**

```css
--background: oklch(0.1797 0.0043 308.1928); /* slate-tinted near-black */
--foreground: oklch(0.8109 0 0); /* warm off-white */
--primary: oklch(0.7214 0.1337 49.9802); /* copper #E28856 */
--primary-foreground: oklch(0.1797 0.0043 308.1928);
--secondary: oklch(0.594 0.0443 196.0233); /* teal #6A9091 */
--muted: oklch(0.252 0 0);
--muted-foreground: oklch(0.683 0 0);
--border: oklch(0.252 0 0);
--ring: oklch(0.7214 0.1337 49.9802); /* copper focus ring */
--radius: 0.75rem;
```

**Light Mode:**

```css
--background: oklch(1 0 0);
--foreground: oklch(0.2101 0.0318 264.6645);
--primary: oklch(0.6716 0.1368 48.513); /* copper #D87943 */
--primary-foreground: oklch(1 0 0);
--secondary: oklch(0.536 0.0398 196.028); /* teal #527575 */
--muted: oklch(0.967 0.0029 264.5419);
--muted-foreground: oklch(0.551 0.0234 264.3637);
--border: oklch(0.9276 0.0058 264.5313);
--ring: oklch(0.6716 0.1368 48.513);
```

**Accent usage rules:** Copper is reserved for primary CTAs, focus rings, active sidebar routes, progress bars, and the brand mark. Teal is secondary-only (outlined buttons, meta badges). Everything else is neutral. Never use copper for status indicators — that dilutes its meaning as "the primary action".

### 3.2 Typography

**Primary font:** Geist Mono (monospace terminal aesthetic throughout)

- H1: 28px Geist Mono 700, tracking 0em
- H2: 22px Geist Mono 600
- H3: 18px Geist Mono 600
- Body: 14px Geist Mono 400
- Small/meta: 12px Geist Mono 400
- Section labels: 10px Geist Mono 600 UPPERCASE with `[brackets]`

### 3.3 Status Indicators (Shape + Luminance, never hue)

Status encoding uses shape and luminance, NOT color — copper stays reserved for the primary CTA:

- **Active:** filled disc `●`, `foreground` color
- **Paused:** filled disc `●`, `muted-foreground` color
- **Planning:** outlined circle `○`, `foreground` color
- **Complete:** checkmark `✓`, `muted-foreground` color
- **Area:** outlined square `▢`, `muted-foreground` color

### 3.4 Component Library (shadcn-svelte)

Components needed for MVP Shell:

- `Button`, `Input`, `Card`, `Separator`, `ScrollArea`
- `Sidebar` (custom, shadcn-svelte sidebar primitives)
- `Tabs` (for Chat/Docs/Artifacts — Docs only active in MVP)
- `Badge` (for status)
- `Tooltip`
- `ThemeProvider` / mode toggle

### 3.5 Theme Toggle — DECIDED 2026-04-06

Toggle lives in the **sidebar footer**, as a small icon button pinned next to the Settings link. Single click toggles dark ↔ light.

- Sun icon in dark mode, moon icon in light mode (lucide-svelte `sun` / `moon`)
- Preference persisted to `localStorage` under key `oracle:theme`
- On first load, respects system preference (`prefers-color-scheme`) if no stored preference
- Toggle applies instantly with a 150ms CSS transition on `background-color` and `color`
- No flash of wrong theme on page load: inline script in `app.html` reads `localStorage` before hydration and sets `class="dark"` on `<html>` synchronously

In Phase 2+ the Settings page will also expose a labeled theme control for discoverability, but the sidebar footer icon remains the primary quick-toggle.

---

## 4. Information Architecture — DECIDED 2026-04-06

### 4.1 The Shell Concept

Oracle is **one persistent two-panel shell**, not a multi-page site. The sidebar is always visible and never reloads. Only the center panel content swaps when you click a sidebar item. This gives the app a native feel — instant navigation, preserved scroll positions, and the sidebar is a permanent anchor.

### 4.2 Routes

Routes exist for deep-linking and URL sharing, but navigating between them never reloads the shell — only the center panel content.

```
/                          → Dashboard (project completeness cards)
/projects/[slug]           → Project detail (PROJECT.md rendered)
/areas/[slug]              → Area detail (AREA.md rendered)
/settings                  → Settings (MVP: theme toggle only; Phase 2+: workflows, heartbeat, integrations)
```

All routes render inside the same `+layout.svelte` shell. The sidebar is defined in the root layout and never remounts.

### 4.3 Layout — UPDATED 2026-04-06

**Desktop (≥1024px):**

- **Two-panel layout**, always visible
- Left: 260px sidebar (fixed)
- Center: main content (fluid, fills remaining width)
- **No right panel.** Removed in favor of multi-thread chats inside each project's Chats tab (Section 4.7). Global throwaway chat moved to a Phase 2 FAB (Section 4.8).

**Tablet (768-1024px):**

- Two-panel
- Sidebar fixed at 240px
- Center content fills the rest

**Mobile (<768px):**

- Single column
- **Bottom tab bar** with 4 tabs: **Dashboard**, **Projects**, **Areas**, **Settings**
  - Dashboard: project completeness cards
  - Projects: full-screen scrollable list of projects (same content as desktop sidebar's PROJECTS section)
  - Areas: full-screen scrollable list of areas
  - Settings: settings page (theme toggle in MVP)
- Tapping a project/area opens the detail view, with a back arrow in top-left returning to the tab list
- **Quick chat FAB** (Phase 2): floating action button in the bottom-right opens the global throwaway "help chat" (see Section 4.8). Not in MVP.

### 4.4 Sidebar Ordering — DECIDED 2026-04-06

**Manual ordering via `sort_order` frontmatter field.** PARA stays flat (no nesting, no sub-projects, no categories). Visual order in the sidebar is controlled per-item.

**Data model:**
Each PROJECT.md / AREA.md adds an optional `sort_order` field to its frontmatter:

```yaml
---
title: Pennyworth
state: active
sort_order: 100
---
```

**Sort rules:**

- Sidebar renders Projects section sorted by `sort_order` ascending
- Same for Areas section (independent ordering)
- Tiebreaker: alphabetical by slug
- Missing field: treated as `sort_order: 999` (appears at bottom, backwards-compatible)
- Use multiples of 100 (100, 200, 300...) so values can be inserted between items without renumbering

**Default for new projects:** When Pennyworth creates a new project via the GitHub API, it sets `sort_order: 999` so the new item appears at the bottom of its section. Nick can reorder later. **Pennyworth's project template needs a one-line update to include this field.**

**MVP Shell scope:**

- Backend: parse `sort_order` from frontmatter, sort the project/area lists in the sidebar load function
- Frontend: render in sorted order
- **No drag-and-drop UI in MVP.** Reordering happens by:
  - Asking Alfred in the terminal ("move stridemind above pennyworth") → Alfred edits the frontmatter
  - Editing frontmatter directly via the "Edit in GitHub →" link on the project page
  - One-off scripts

**Phase 2 plan (drag-and-drop reorder):**

- Library: `svelte-dnd-action` (well-maintained, idiomatic Svelte 5)
- Interaction: click-hold-drag a sidebar item, drop it in a new position within the same section (Projects can't be dragged into Areas or vice versa)
- Persistence: on drop, Oracle App POSTs to Pennyworth's write API → Pennyworth updates the moved item's `sort_order` field → SSE broadcasts the change → all connected clients re-render
- Optimistic UI: the move is reflected in the sidebar instantly; reverts on API error
- Smart sort_order calculation: insert between adjacent items by averaging their values (e.g., between 100 and 200 = 150). When values get too tight (gap < 1), trigger a background rebalance that renumbers the section to clean multiples of 100.

**One-time migration (optional):**
A small script (`scripts/init-sort-order.ts`) walks all existing PROJECT.md and AREA.md files, adds `sort_order` if missing, and assigns initial values based on a starting state (alphabetical or Nick's stated preference). Run once before MVP launch. Optional because the default-999 fallback means missing fields work fine.

### 4.5 Sidebar Structure

The sidebar has a fixed structure with three zones: top nav, content, bottom nav. Settings is pinned to the bottom regardless of content height.

```
┌─────────────────────────┐
│ [O] oracle              │ ← logo (top)
│ [search...]             │ ← (MVP: disabled placeholder)
├─────────────────────────┤
│ ▸ Dashboard             │ ← top nav link (ABOVE sections)
├─────────────────────────┤
│ [PROJECTS]              │ ← section label
│ ● pennyworth            │
│ ● stridemind-ai         │
│ ○ aptoforge             │
│ · psi-odoo-migration    │
│ ✓ docubot               │
│ ...                     │
│                         │
│ [AREAS]                 │ ← section label
│ □ alfred                │
│ □ psi-operations        │
│ □ health-fitness        │
│ ...                     │
├─────────────────────────┤
│  (spacer — flex-1)      │ ← pushes settings to bottom
├─────────────────────────┤
│ ⚙ Settings              │ ← bottom nav link (pinned)
│ 🌓 Theme toggle          │ ← (MVP has this; Phase 2 moves into Settings)
└─────────────────────────┘
```

**Why Dashboard is above the section labels:** it's a top-level navigation destination, not a project or area. It sits visually apart from the PROJECTS/AREAS lists.

**Why Settings is pinned to the bottom:** it's system-level (config, preferences, workflows), not a daily-use nav item. Out of the way but always one click away.

### 4.6 Center Panel Content by Route

| Route              | Center Panel Content                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| `/`                | Dashboard: grid of project completeness cards (MVP — see Section 5.1)                                        |
| `/projects/[slug]` | Project workspace: header, tab bar (Chats/Artifacts/SOW), SOW tab renders PROJECT.md (MVP — see Section 5.2) |
| `/areas/[slug]`    | Area workspace: same tab structure, SOW tab renders AREA.md (MVP — see Section 5.3)                          |
| `/settings`        | Settings placeholder (MVP: theme toggle only; Phase 2+: workflows, heartbeat config, integrations)           |

### 4.7 Project Chats — Multi-Thread Architecture (Phase 2) — UPDATED 2026-04-06

The project Chats tab is a **multi-thread workspace**. A single project can have many concurrent chat threads, each with its own purpose and lifecycle. This replaces the previously-planned "right panel ephemeral chat" — all chat lives inside its project.

#### Layout

The Chats tab is itself a two-panel layout (a panel-within-the-panel):

```
┌─────────────────────────────────────────────────────┐
│ StrideMind AI                        [Edit GitHub]  │
│ [Chats] | Artifacts | SOW                           │
├─────────┬───────────────────────────────────────────┤
│ THREADS │  Active thread: "push notification..."    │
│         │                                           │
│ ★ push  │  Pennyworth: 13:42                        │
│   notif │  iOS 18.4 changes the push subscription   │
│         │  expiry behavior...                       │
│ ★ coach │                                           │
│   mike  │  Nick: 13:43                              │
│         │  Confirm — does this break our existing   │
│ · quick │  subscriptions?                           │
│   q     │                                           │
│         │  Pennyworth: 13:44                        │
│ · debug │  No, but new ones expire in 30 days...    │
│   help  │                                           │
│         │  ─────────────────────────────────────    │
│ [+ New] │  [ Type a message...           ] [Send]   │
└─────────┴───────────────────────────────────────────┘
```

**Left sub-panel (~220px):** Thread list, scrollable, with `[+ New]` button at the bottom.
**Right sub-panel (fluid):** Active thread — message history scrolls vertically, message input is **sticky at the bottom**.

#### Thread Types

Two visual + behavioral distinctions:

| Type           | Glyph | Persistence                                                                   | Naming                                                      | Use Case                                                                               |
| -------------- | ----- | ----------------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Persistent** | `★`   | Saved server-side, full history forever                                       | User-named when created (e.g. "push notification research") | Committed work — research, council debates, refining the SOW, long-running discussions |
| **Throwaway**  | `·`   | Not persisted server-side; lives in session only OR auto-deletes after N days | Auto-named with timestamp (e.g. "Quick question 14:23")     | Disposable — quick questions, debugging help, one-shot lookups                         |

**Creating threads:**

- `[+ New]` button opens a small dialog: "New thread for StrideMind AI" with a name field. If left blank → throwaway thread auto-named. If named → persistent thread.
- Pennyworth can also suggest creating a thread (e.g. "I noticed this conversation is getting long, want me to spin off a focused thread for it?")

**Deleting threads:**

- Persistent threads: explicit delete with confirmation dialog
- Throwaway threads: one-tap delete from the thread list (Phase 3+: swipe-to-delete on mobile)

**Default state:**

- A new project has zero threads. The Chats tab shows an empty state: "No threads yet. Start one." with a `[+ New thread]` button.

#### Storage

- **Persistent threads:** SQLite on Pennyworth, linked to project slug + thread ID. Full message history, metadata (created, updated, message count).
- **Throwaway threads:** Same SQLite storage but flagged as ephemeral. Auto-purge after configurable period (e.g. 7 days). Or session-only — TBD when Phase 2 lands.

#### Streaming UX (when implemented)

- New messages stream in via SSE from Pennyworth's chat API
- Auto-scroll to bottom on new message UNLESS user has scrolled up (then show "↓ new message" pill)
- Message input is sticky at the bottom of the active thread panel
- Pressing Enter sends, Shift+Enter for newline
- Loading state: subtle "Pennyworth is thinking..." indicator above the input

#### Mobile Chat Flow (Phase 2) — DECIDED 2026-04-06

The desktop two-panel layout (thread list + active thread side by side) doesn't fit on a phone. Mobile uses a **two-screen pattern**:

**Screen A — Thread list (full-width):**

- User taps the Chats tab on a project
- Thread list takes the full content area
- `[+ New thread]` button at the bottom
- Tapping a thread → navigates to Screen B

**Screen B — Active thread (full-width):**

- Back arrow in the top-left returns to Screen A (the thread list)
- Thread title at the top (truncates if long)
- Scrollable message area
- Sticky message input at the bottom (above the bottom tab bar)
- Optional: ellipsis menu in the top-right for thread actions (rename, delete, etc.)

This is the standard mobile pattern (matches Mail, iMessage, Slack mobile, etc.). State preserved on back navigation so scroll position in the thread list is retained.

Not implemented in MVP Shell — both the thread list and the active thread are placeholder content. The two-screen pattern is documented here so the Phase 2 implementation has a clear spec.

#### MVP Shell Scope

**Chats tab is visible but non-functional in MVP.** It renders the two-panel layout (thread list + active thread area) with a placeholder thread or two (e.g. "Sample thread — Phase 2") and the message input is disabled with a "Phase 2" tooltip. This lets us validate the layout and visual design now without building the chat backend.

When Phase 2 lands, Pennyworth gets a chat HTTP API + SSE streaming, and Oracle App wires it up to the existing UI shell — no layout refactor needed.

### 4.8 Global Throwaway Chat — Phase 2 FAB

A floating action button (FAB) in the bottom-right of every view opens a **throwaway "help chat"** that is global and unscoped.

**Purpose:**

- Ask Pennyworth anything that isn't tied to a specific project
- Create a new project or area on the fly ("Hey PW, create a new project for my new home reno")
- General PARA system questions ("What projects are blocked on me right now?")
- One-shot lookups that don't need to be saved

**Behavior:**

- FAB icon: chat bubble (lucide `message-circle`) in the bottom-right corner of every view
- Click to open a slide-up panel (mobile) or floating dialog (desktop)
- Always-throwaway — never persisted, no thread list
- Closing the panel discards the conversation
- Pennyworth has the ability to create new projects/areas directly from this chat (one of the few "write" actions in this surface)

**Phase 2 — not in MVP.** No FAB rendered in MVP Shell.

---

## 5. Screens

### 5.1 Dashboard (`/`) — DECIDED 2026-04-06

**Dead-simple for MVP.** A grid of cards, one per **project only** (no areas). Each card shows:

- **Status dot** (active / paused / planning / complete)
- **Project name** (clickable, routes to `/projects/[slug]`)
- **Phase or subtitle** (from PROJECT.md, optional)
- **Completion %** — percentage of DoD checkboxes marked `[x]` out of total DoD checkboxes
- **Progress bar** — horizontal bar showing the completion %, copper fill on neutral track

**Layout:**

- Responsive grid: 1 col mobile, 2 col tablet, 3 col desktop, 4 col wide desktop
- Cards use the standard Darkmatter card styling (card bg, border, 0.75rem radius)
- Card hover state: subtle luminance lift (no shadow)
- Clicking a card navigates to the project detail view

**Intentionally NOT in MVP:**

- Recent activity feed
- Today's tasks
- Hero/summary card
- Area cards
- Filters or sorting controls
- Search

**Why minimal:** Nick doesn't know yet how he'll use the dashboard. Ship the simplest thing that shows "where am I on each project" and iterate based on actual usage.

**Data requirement:** The DoD completion % requires parsing PROJECT.md's `## Definition of Done` section, counting `- [x]` and `- [ ]` items, and computing the ratio. This parsing happens server-side in the load function.

**Card example (pseudo-markup):**

```
┌────────────────────────────────┐
│ ●  pennyworth                  │
│    Phase 3 — Oracle as App     │
│                                │
│    ████████████░░░░░░░   68%   │
└────────────────────────────────┘
```

### 5.2 Project Detail (`/projects/[slug]`) — DECIDED 2026-04-06

A project is not "a page with tabs" — it's a **workspace**. The three tabs represent the three modes of working on a project:

| Tab           | Purpose                                                                                                                                                                                                  | MVP Status                     |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| **Chats**     | Where the work happens — persistent chat threads with Pennyworth, scoped to this project. Council debates, research, refining the SOW, day-to-day collaboration.                                         | Phase 2 — disabled placeholder |
| **Artifacts** | What gets produced — files Pennyworth creates (research reports, generated docs, drafts) AND files Nick uploads (screenshots, references, source material). Synced to the project's Google Drive folder. | Phase 2 — disabled placeholder |
| **SOW**       | Statement of Work — the project's definition document, rendered from PROJECT.md. The anchor that defines what this project IS.                                                                           | **MVP — active**               |

**Tab order:** Chats | Artifacts | SOW (Chats is most important and goes first in Phase 2)

**MVP default tab:** SOW (the only active tab). When Phase 2 ships, default tab becomes Chats.

**Page Header (always visible above tabs — minimal):**

- Project title (h1, from PROJECT.md frontmatter or first h1)
- Status badge (active / paused / planning / complete) — neutral colors per design system
- "Edit in GitHub →" link/button on the right side
- **No metadata card here** — metadata lives inside the SOW tab (see below). Header stays clean across all three tabs.

**SOW Tab Content (MVP) — UPDATED 2026-04-06:**

The SOW tab is the only place the metadata card appears. When the user is on Chats or Artifacts tabs, the metadata is hidden — those tabs are about working _on_ the project, not viewing its definition.

Layout inside SOW tab:

1. **Metadata card** (top of SOW content, above the markdown body)
2. **Rendered markdown body** (PROJECT.md content)

**Metadata Card (lives inside SOW tab):**

A compact card at the top of the SOW tab content surfacing the most-used frontmatter fields. Built with shadcn-svelte `Card` primitive, Darkmatter styling.

**Always visible (when present):**
| Field | Source | Notes |
|---|---|---|
| State | frontmatter `state` | Renders as status badge (active/paused/planning/complete) using design system status indicators |
| Area | frontmatter `area` or Platform IDs table | Clickable link to `/areas/[slug]` for the parent area |
| Owner | frontmatter `owner` | Plain text |
| Created | frontmatter `created` | ISO date, formatted as `2026-03-16` |

**Conditionally visible (only if set in frontmatter):**
| Field | Source | Notes |
|---|---|---|
| Target Date | frontmatter `target_date` | Hidden if missing |
| Phase | frontmatter `phase` | Hidden if missing |

**Collapsible "Platform IDs" section:**

- Below the main metadata fields, a `[+ Platform IDs]` disclosure toggle
- Expanded reveals the full Platform IDs table from PROJECT.md (Todoist, GitHub Repo, Local Code, VPS, Drive folder, Telegram bot, ORACLE slug, etc.)
- Each platform ID is clickable when applicable:
  - `GitHub Repo` → opens the GitHub repo in a new tab
  - `Drive folder` → opens the Google Drive folder in a new tab
  - `Telegram bot` → opens the bot in Telegram
  - `Local Code` → not clickable (it's a path on Nick's Mac)
  - Others handled per platform
- Collapsed by default to keep the header clean
- Disclosure state persists per-session in localStorage (if user expands once, stays expanded)

**Markdown Body (below the metadata card, inside SOW tab):**

- Renders PROJECT.md body as a wiki page
- Body markdown rendered with Darkmatter typography rules (see DESIGN_SYSTEM.md):
  - Headings, paragraphs, bullet lists, ordered lists
  - DoD checkboxes rendered as styled checkboxes (NOT interactive in MVP — read-only)
  - Code blocks with muted syntax highlighting (Shiki)
  - Tables, blockquotes, links
- Max prose width: 68ch (per design system)

**Why metadata is inside SOW tab (not the page header):**

- Page header stays clean and consistent across all three tabs (Chats, Artifacts, SOW)
- When working in Chats, you don't need the metadata in your face — it's a distraction
- When working in Artifacts, same logic — the metadata isn't relevant to managing files
- Metadata IS part of the SOW (it's the definition of the project), so it lives where the definition lives
- This also gives the page header a single, focused job: identify the project and let you switch tabs

**Chats Tab (MVP placeholder — see Section 4.7 for full Phase 2 spec):**

- Visible with the two-panel multi-thread layout rendered (thread list + active thread)
- Sample/placeholder threads shown (e.g. "Sample thread — Phase 2")
- Message input disabled with "Phase 2" tooltip
- This validates the visual layout in MVP without requiring chat backend
- Subtle styling to indicate it's not yet available, not broken

**Artifacts Tab (MVP placeholder):**

- Same treatment — visible but disabled, "Artifacts — Phase 2" label

### 5.3 Area Detail (`/areas/[slug]`) — DECIDED 2026-04-06

Areas use the **same tab structure** as projects: Chats | Artifacts | SOW.

The semantic meaning is slightly different:

- **Chats** for an area = ongoing conversations about that domain (e.g., the Alfred area chat is for general PAI discussion)
- **Artifacts** for an area = files related to that area's responsibility
- **SOW** for an area = the AREA.md definition document (rendered the same way PROJECT.md is rendered)

Same MVP scope: only SOW tab is active. Chats and Artifacts are placeholders for Phase 2.

### 5.4 Tab Naming Note

The terminology "SOW" (Statement of Work) is used instead of "Docs" because:

1. It accurately describes what the document is (a definition/spec)
2. It avoids confusion with "documentation" (which it isn't)
3. It anchors the project in the language of work scope, which matches Nick's mental model of PARA

### 5.5 Settings (`/settings`)

MVP scope: extremely minimal. A single page with:

- Theme toggle (with label, mirroring the sidebar footer toggle)
- Oracle App version (read from `package.json`)
- Build info (commit SHA from `import.meta.env.VITE_BUILD_SHA` if set during CI build)

Phase 2+ extensions (NOT in MVP):

- Pennyworth heartbeat configuration
- Workflow management (AptoFlow integration)
- Integration credentials (Drive, Todoist, GitHub tokens)
- Memory sync controls
- Notification preferences

---

## 6. Data Layer

### 6.1 How Oracle Reads ORACLE Data — DECIDED 2026-04-06

**Runtime SSR with SSE file-watcher push updates.**

Oracle App runs as a SvelteKit Node server (adapter-node) co-located with Pennyworth on **KVM 2**. A local clone of the ORACLE repo lives at `/opt/oracle/data/` (or similar), kept in sync via GitHub webhooks.

**Read path (per page request):**

1. Browser requests `/projects/:slug`
2. SvelteKit `+page.server.ts` load function reads `/opt/oracle/data/Projects/:slug/PROJECT.md` directly via `fs.readFile`
3. Parse frontmatter + body with `gray-matter` + markdown parser
4. Return data to the page component, render HTML, send to browser

**Live update path (SSE push):**

1. On server startup, a `chokidar` watcher monitors `/opt/oracle/data/Projects/**/*.md` and `/opt/oracle/data/Areas/**/*.md`
2. A SvelteKit API route `/api/events` holds open an SSE connection per connected client
3. When a file changes, the server broadcasts `{"type": "project-updated", "slug": "<slug>"}` to all clients
4. Client listens via `EventSource` and calls SvelteKit's `invalidate('oracle:project:<slug>')` which re-runs the load function and updates the DOM in place — no full page reload

**Sync path (from Alfred/Pennyworth writes to the server):**

1. Alfred or Pennyworth commits/pushes to `Nkburdick/ORACLE` on GitHub
2. GitHub webhook hits an endpoint on KVM 2 (or Pennyworth's existing server)
3. Server runs `git pull` on `/opt/oracle/data/`
4. `chokidar` sees the file changes → broadcasts SSE events → browsers update

**Why this architecture:**

- Markdown files stay the source of truth (no database, preserves ORACLE's portability and git history)
- Always-current reads (no rebuild needed)
- Real-time push updates (the "magic" experience — edit in terminal, see it in browser in ~3-8s)
- Foundation for Phase 2: the same SSE pipe carries chat messages and write-ack events
- Runs next to Pennyworth on existing infra (no new server)
- Single-user means no concurrency headaches

**Rejected alternatives:**

- Build-time static: no live updates, requires rebuild per change
- GitHub API reads: rate limits, network latency, auth complexity
- Database (Postgres/SQLite as source of truth): undermines ORACLE-as-markdown-moat, breaks Alfred's `cat PROJECT.md` workflow

**Phase 2 extension:** When chat + in-app editing arrive, Oracle App will POST to Pennyworth's HTTP API for writes. Pennyworth writes the file, commits, and broadcasts an SSE event that Oracle App already knows how to handle. No architectural rework needed.

### 6.2 Markdown Parsing

- `gray-matter` for frontmatter extraction
- `mdsvex` or `marked` + custom renderer for body
- Need to handle: headings, lists, checkboxes (DoD), code blocks, tables, links

### 6.3 Data Schema — UPDATED 2026-04-06

TypeScript types for parsed ORACLE data. Used by the server load functions and client components. Lives at `src/lib/types/oracle.ts`.

```typescript
/** Project state — drives the sidebar status indicator */
export type ProjectState = 'active' | 'planning' | 'paused' | 'complete';

/** Frontmatter shape — what we read from PROJECT.md / AREA.md YAML */
export interface ProjectFrontmatter {
	/** URL slug — derived from folder name, not stored in frontmatter */
	slug: string;
	/** Display title from frontmatter `title` or first H1 of body */
	title: string;
	/** Current state — defaults to 'active' if missing */
	state: ProjectState;
	/** Sort position in the sidebar — lower = higher in list. Defaults to 999. */
	sort_order: number;
	/** Linked area slug — clickable in metadata card. Optional. */
	area?: string;
	/** Owner display name */
	owner: string;
	/** ISO date when the project was created */
	created: string;
	/** ISO date target. Optional — only shown when set. */
	target_date?: string;
	/** Phase label like "Phase 3 — Oracle as App". Optional. */
	phase?: string;
	/** Platform IDs table — flexible key/value (Todoist, GitHub, Drive, etc.) */
	platform_ids?: Record<string, string>;
	/** Reserved for Phase 2+ category grouping — not used in MVP */
	category?: string;
}

/** Same shape for areas — areas use AREA.md but the structure mirrors projects */
export type AreaFrontmatter = Omit<ProjectFrontmatter, 'state' | 'target_date' | 'phase'>;

/** Definition of Done item — parsed from `## Definition of Done` section */
export interface DoDItem {
	/** The text label of the checkbox */
	text: string;
	/** Whether the box is checked */
	checked: boolean;
	/** Section header it belongs to (e.g., "Phase 1: Service Layer") */
	section?: string;
	/** Line number in the source file (for future edit support) */
	line: number;
}

/** Aggregated DoD stats for the dashboard cards */
export interface DoDStats {
	checked: number;
	total: number;
	/** Integer 0-100 */
	percent: number;
}

/** Full parsed project — what the server load function returns */
export interface Project {
	frontmatter: ProjectFrontmatter;
	/** Raw markdown body (frontmatter stripped) */
	bodyMarkdown: string;
	/** Rendered HTML from the body (server-rendered with Shiki + custom renderer) */
	bodyHtml: string;
	/** Parsed DoD items, in document order */
	dod: DoDItem[];
	/** Aggregated DoD stats for the dashboard */
	dodStats: DoDStats;
	/** Filesystem path to the source file (for "Edit in GitHub" deep link) */
	filePath: string;
	/** GitHub web editor URL — derived from filePath + repo info */
	githubEditUrl: string;
}

/** Same for areas */
export interface Area {
	frontmatter: AreaFrontmatter;
	bodyMarkdown: string;
	bodyHtml: string;
	filePath: string;
	githubEditUrl: string;
}

/** Sidebar list item — minimal shape for the sidebar component */
export interface SidebarItem {
	slug: string;
	title: string;
	state: ProjectState | 'area';
	sort_order: number;
	/** Optional subtitle shown under the title (e.g., phase, completion %) */
	subtitle?: string;
}

/** Dashboard card data — minimal shape for the project completeness grid */
export interface DashboardCard {
	slug: string;
	title: string;
	state: ProjectState;
	phase?: string;
	dodStats: DoDStats;
}

/** SSE event payload — broadcast when a watched file changes */
export interface OracleEvent {
	type:
		| 'project-updated'
		| 'area-updated'
		| 'project-created'
		| 'area-created'
		| 'project-deleted'
		| 'area-deleted';
	/** The slug of the affected item */
	slug: string;
	/** ISO timestamp of the change */
	timestamp: string;
}
```

**Notes:**

- Field names match the YAML frontmatter exactly (`sort_order`, `target_date`, `platform_ids` use snake_case to match `gray-matter`'s default behavior — no transformation needed)
- `category` is **reserved** in the type but unused in MVP — it's there so we don't have to widen the type later when Phase 2 wants visual grouping
- `slug` is **derived from the folder name**, never stored in frontmatter — single source of truth is the directory structure
- `bodyHtml` is rendered server-side so the client doesn't bundle a markdown parser
- `dod` and `dodStats` are computed once during parse, cached in memory, invalidated on file change

---

## 7. Interactions & States

### 7.1 Loading States

- Skeleton loaders for sidebar project list on initial load
- Skeleton for project detail content area

### 7.2 Error States

- Project not found → 404 page
- Failed to parse PROJECT.md → error message with link to raw file

### 7.3 Empty States

- No projects → "No active projects — create one via Todoist"
- No areas → similar

### 7.4 Navigation States

- Active route highlighted in sidebar
- Breadcrumb or back button on detail pages (mobile)

---

## 8. Deployment — DECIDED 2026-04-06

### 8.1 Target Environment

**KVM 2 (same VPS as Pennyworth)** — Hostinger Docker VPS at 31.220.21.243.

- Deployed as a Docker container managed by Dockge alongside Pennyworth
- Traefik routes traffic via HTTPS
- Production domain: **`oracle.aptoworks.cloud`**
- Local dev: `bun run dev` on Nick's Mac, reads from `~/Code/ORACLE/` directly

### 8.2 Data Directory

- Production container mounts or maintains a local ORACLE repo clone at `/opt/oracle/data/`
- Sync strategy: GitHub webhook → `git pull` → chokidar detects changes → SSE broadcast (see Section 6.1)
- Either shares Pennyworth's existing ORACLE clone or maintains its own — decide during implementation

### 8.3 Deployment Pipeline

- GitHub Actions workflow builds Docker image from `app/` directory on merge to main
- Image pushed to registry (GitHub Container Registry)
- Dockge on KVM 2 pulls and restarts the Oracle container
- Same pattern as Pennyworth (reference `Nkburdick/pennyworth/.github/workflows/` for the template)

### 8.4 PWA Config

**Out of scope for MVP Shell.** No manifest, no service worker, no offline support. Those arrive in Phase 3 (PWA install + offline).

---

## 9. Testing Strategy — DECIDED 2026-04-06

Three layers, all of which must pass for the Forge to consider implementation complete.

### 9.1 Static Checks (every commit)

- **TypeScript strict mode:** `strict: true` in `tsconfig.json`, no `any` without justification, no `// @ts-ignore` without comment
- **svelte-check:** zero errors, zero warnings — runs in CI
- **ESLint + Prettier:** project-standard rules, runs in CI
- **`bun run build`:** must succeed with zero errors

### 9.2 Unit Tests — Vitest (`bun run test`)

The data parsing layer is the critical surface. A bug here breaks every page. Required tests:

**Markdown parser (`src/lib/server/markdown.ts` or similar):**

- Parses frontmatter via `gray-matter` correctly
- Extracts `title`, `state`, `area`, `owner`, `created`, `target_date`, `phase`, `sort_order` from typical PROJECT.md frontmatter
- Handles missing fields gracefully (no crashes, sensible defaults)
- Returns the markdown body separated from frontmatter

**DoD checkbox counter:**

- Counts `- [x]` and `- [ ]` items in a markdown body correctly
- Returns `{ checked: N, total: M, percent: P }`
- Handles markdown with no DoD section (returns 0/0)
- Handles markdown with multiple checkbox-style sections (counts all)
- Edge cases: nested checkboxes, indented checkboxes, checkboxes with trailing whitespace

**Sort order logic:**

- Items with explicit `sort_order` sort correctly ascending
- Items without `sort_order` default to 999
- Tiebreaker is alphabetical by slug
- Mixed (some with, some without) sorts correctly

**File watcher / SSE broadcast (if practical to test in isolation):**

- File change events trigger broadcast
- Path filtering works (changes to `Projects/**/*.md` and `Areas/**/*.md` only)

### 9.3 End-to-End Smoke Test — Playwright

**One critical-path test** that exercises the whole app top to bottom. Runs in CI on every PR.

```
test('Oracle MVP smoke test', async ({ page }) => {
  // 1. Load the home page (dashboard)
  await page.goto('/');
  await expect(page.locator('h1')).toContainText(/oracle|dashboard/i);
  await expect(page.locator('[data-testid="project-card"]').first()).toBeVisible();

  // 2. Verify the sidebar rendered with projects and areas
  await expect(page.locator('[data-testid="sidebar-project"]').first()).toBeVisible();
  await expect(page.locator('[data-testid="sidebar-area"]').first()).toBeVisible();

  // 3. Click a project in the sidebar
  await page.locator('[data-testid="sidebar-project"]').first().click();
  await expect(page).toHaveURL(/\/projects\//);
  await expect(page.locator('[data-testid="sow-content"]')).toBeVisible();

  // 4. Click an area in the sidebar
  await page.locator('[data-testid="sidebar-area"]').first().click();
  await expect(page).toHaveURL(/\/areas\//);
  await expect(page.locator('[data-testid="sow-content"]')).toBeVisible();

  // 5. Toggle the theme
  const html = page.locator('html');
  const initialClass = await html.getAttribute('class');
  await page.locator('[data-testid="theme-toggle"]').click();
  await expect(html).not.toHaveAttribute('class', initialClass || '');

  // 6. Navigate back to dashboard
  await page.locator('[data-testid="nav-dashboard"]').click();
  await expect(page).toHaveURL('/');
});
```

**Setup requirements:**

- Playwright config with `bun run dev` as the web server
- Test data: a fixture ORACLE directory with at least 2 projects and 2 areas (or use the real `~/Code/ORACLE` data in CI)
- All target elements use stable `data-testid` attributes — implementer must add these as components are built

### 9.4 What's Intentionally NOT Tested in MVP

These are deferred to Phase 2+ when the relevant features ship:

- Interactive checkbox toggles (no editing in MVP)
- Chat functionality (Phase 2)
- Drag-and-drop reordering (Phase 2)
- SSE live updates beyond connection establishment (hard to E2E test reliably; manual verification acceptable for MVP)
- Visual regression (no screenshot diffing — overkill for MVP)
- Accessibility audits (basic semantic HTML only; full WCAG AA audit in Phase 2)
- Cross-browser testing (Chromium only in MVP)

### 9.5 CI Requirements

GitHub Actions workflow `app/.github/workflows/ci.yml` runs on every PR:

1. `bun install`
2. `bun run check` (svelte-check)
3. `bun run lint`
4. `bun run test` (Vitest unit tests)
5. `bun run build`
6. `bun run test:e2e` (Playwright smoke test against built output)

All six steps must pass for the PR to be merge-eligible.

---

## 10. Acceptance Criteria — FORGE DISPATCH BASELINE

These are the verifiable criteria the Forge implementation must satisfy. Grouped by area. Each criterion is binary (pass/fail) and atomic. When the Forge dispatches, every checkbox here must be marked complete with evidence before the build is accepted.

### 10.1 Project Setup & Build

- [ ] **AC-1:** SvelteKit project initialized at `~/Code/ORACLE/app/` with TypeScript strict mode (`strict: true` in `tsconfig.json`)
- [ ] **AC-2:** TailwindCSS 4 installed and configured via `@tailwindcss/vite` plugin
- [ ] **AC-3:** shadcn-svelte initialized via `bunx shadcn-svelte@latest init`
- [ ] **AC-4:** `bun run build` succeeds with zero errors and zero warnings
- [ ] **AC-5:** `bun run check` (svelte-check) passes with zero errors and zero warnings
- [ ] **AC-6:** `bun run lint` passes (ESLint + Prettier configured)
- [ ] **AC-7:** Vite config has `server.fs.allow: ['..']` for cross-boundary file reads
- [ ] **AC-8:** Adapter set to `@sveltejs/adapter-node` (NOT adapter-static)
- [ ] **AC-9:** `chokidar` and `gray-matter` installed as dependencies

### 10.2 Design System Tokens

- [ ] **AC-10:** Darkmatter CSS custom properties present in `src/app.css` for both light and dark modes — exact OKLCH values from DESIGN_SYSTEM.md Section 2.1
- [ ] **AC-11:** Tailwind 4 `@theme inline` block maps custom properties to Tailwind tokens
- [ ] **AC-12:** Border radius set to `0.75rem` (12px)
- [ ] **AC-13:** Geist Mono loaded via `@fontsource-variable/geist-mono`, applied to `html, body` as `font-family`
- [ ] **AC-14:** JetBrains Mono loaded via `@fontsource-variable/jetbrains-mono`, applied to `code, pre, kbd, samp`
- [ ] **AC-15:** Letter-spacing is `0em` globally (no tightening of headings, no loosening of labels)

### 10.3 Theme Toggle

- [ ] **AC-16:** Theme toggle button renders in the sidebar footer next to Settings link
- [ ] **AC-17:** Toggle uses lucide-svelte `sun` (in dark mode) and `moon` (in light mode) icons
- [ ] **AC-18:** Clicking the toggle flips the `dark` class on `<html>` element
- [ ] **AC-19:** Theme preference persists to `localStorage` under key `oracle:theme`
- [ ] **AC-20:** On first load with no stored preference, app respects `prefers-color-scheme` system preference
- [ ] **AC-21:** No flash of wrong theme on page load (inline script in `app.html` reads localStorage before hydration and sets `dark` class synchronously)
- [ ] **AC-22:** Theme transition animates `background-color` and `color` over 150ms

### 10.4 Data Layer & Markdown Parsing

- [ ] **AC-23:** Server load function reads PROJECT.md files from `Projects/{slug}/PROJECT.md` via `fs.readFile` (relative path: `../Projects/{slug}/PROJECT.md` from `app/`)
- [ ] **AC-24:** Server load function reads AREA.md files from `Areas/{slug}/AREA.md`
- [ ] **AC-25:** Frontmatter parsed with `gray-matter` into typed `ProjectFrontmatter` / `AreaFrontmatter` objects (matching schema in PRD Section 6.3)
- [ ] **AC-26:** Body markdown rendered to HTML server-side (no client-side markdown parser bundled)
- [ ] **AC-27:** DoD checkboxes parsed from `## Definition of Done` section into `DoDItem[]` per FRONTMATTER_SPEC.md rules
- [ ] **AC-28:** DoD stats (`{ checked, total, percent }`) computed correctly for each project
- [ ] **AC-29:** Missing frontmatter fields use spec defaults (e.g., `sort_order: 999`, `state: 'active'`)
- [ ] **AC-30:** `slug` is derived from folder name, never from frontmatter

### 10.5 SSE Live Updates

- [ ] **AC-31:** `chokidar` watcher initialized on server startup, watching `Projects/**/*.md` and `Areas/**/*.md`
- [ ] **AC-32:** SvelteKit API route `/api/events` opens an SSE connection per client
- [ ] **AC-33:** File change events trigger SSE broadcast with shape `{ type, slug, timestamp }` matching `OracleEvent` type
- [ ] **AC-34:** Client subscribes to `/api/events` via `EventSource` on app mount
- [ ] **AC-35:** Client receives an SSE event for the currently-viewed project → SvelteKit `invalidate('oracle:project:<slug>')` is called → load function re-runs → DOM updates without page reload
- [ ] **AC-36:** SSE connection auto-reconnects if dropped (use `EventSource` default behavior + reconnect-on-error logic)

### 10.6 Sidebar (Persistent Shell)

- [ ] **AC-37:** Sidebar renders in the root layout (`src/routes/+layout.svelte`) and never remounts on navigation
- [ ] **AC-38:** Sidebar width is 260px on desktop (≥1024px)
- [ ] **AC-39:** Sidebar background uses `card` token; right border uses `border` token
- [ ] **AC-40:** Oracle logo renders at the top of the sidebar (text "Oracle" in proper case Geist Mono with a small `[O]` outlined-square brand mark to its left)
- [ ] **AC-41:** Dashboard link renders ABOVE the PROJECTS section header
- [ ] **AC-42:** PROJECTS section renders all projects from `Projects/` directory, sorted by `sort_order` ASC then alphabetical
- [ ] **AC-43:** AREAS section renders all areas from `Areas/` directory, sorted by `sort_order` ASC then alphabetical
- [ ] **AC-44:** Each project row shows: status indicator (per state) + slug name
- [ ] **AC-45:** Each area row shows: outlined-square indicator + slug name
- [ ] **AC-46:** Active project (currently-viewed) highlighted with `secondary` background and 3px copper left border
- [ ] **AC-47:** Settings link pinned to the bottom of the sidebar (uses `flex: 1` spacer above)
- [ ] **AC-48:** Theme toggle icon button renders next to Settings link in the footer
- [ ] **AC-49:** Tiny vertical space reserved above PROJECTS header for future search input (no input rendered in MVP)
- [ ] **AC-50:** Sidebar items use `data-testid="sidebar-project"` and `data-testid="sidebar-area"` for E2E tests

### 10.7 Status Indicators

- [ ] **AC-51:** Active state renders as filled disc (`●`) at 6px in `foreground` color
- [ ] **AC-52:** Planning state renders as outlined circle (`○`) at 6px in `foreground` color
- [ ] **AC-53:** Paused state renders as filled disc (`●`) at 6px in `muted-foreground` color
- [ ] **AC-54:** Complete state renders as checkmark (`✓`) in `muted-foreground` color
- [ ] **AC-55:** Area state renders as outlined square (`▢`) at 6px in `muted-foreground` color
- [ ] **AC-56:** Status indicators NEVER use copper (`primary`) — that's reserved for CTAs only

### 10.8 Dashboard (`/`)

- [ ] **AC-57:** Route `/` renders the dashboard view in the center panel
- [ ] **AC-58:** Dashboard shows a responsive grid: 1 column mobile, 2 columns tablet, 3 columns desktop, 4 columns wide desktop
- [ ] **AC-59:** Each project (NOT areas) renders as a card
- [ ] **AC-60:** Each card shows: status dot, project name (clickable to `/projects/[slug]`), phase/subtitle (if present), DoD completion %, and progress bar
- [ ] **AC-61:** Progress bar uses copper fill on neutral track
- [ ] **AC-62:** Card hover state lifts luminance slightly (no shadow)
- [ ] **AC-63:** Card uses `data-testid="project-card"` for E2E test
- [ ] **AC-64:** Empty state: if zero projects exist, dashboard shows "No projects found" with a hint to create one via Pennyworth
- [ ] **AC-65:** Card area on dashboard does NOT include areas (areas are sidebar-only in MVP)

### 10.9 Project Workspace (`/projects/[slug]`)

- [ ] **AC-66:** Route `/projects/[slug]` renders project workspace in center panel
- [ ] **AC-67:** Page header shows project title (h1, 28px, font-bold) + status badge (pill, see AC-86) + "Edit in GitHub →" button. NO metadata card in the header — metadata lives inside the SOW tab (see AC-75).
- [ ] **AC-68:** Tab bar renders THREE tabs in order: **Chats** | **Artifacts** | **SOW**
- [ ] **AC-69:** Chats tab is visible but disabled with subtle "Chat — Phase 2" label
- [ ] **AC-70:** Artifacts tab is visible but disabled with subtle "Artifacts — Phase 2" label
- [ ] **AC-71:** SOW tab is the default active tab in MVP
- [ ] **AC-72:** Active tab indicator: 2px copper underline below the tab label
- [ ] **AC-73:** SOW tab content renders the parsed PROJECT.md body as formatted wiki
- [ ] **AC-74:** Body uses `max-width: 68ch` for prose readability
- [ ] **AC-75:** Metadata card renders **inside the SOW tab content** (not the page header) — at the top of the SOW body, above the rendered markdown. Shows: State (badge), Area (link), Owner, Created, plus Target Date and Phase if present. Hidden when user is on Chats or Artifacts tabs.
- [ ] **AC-76:** Metadata card has a `[+ Platform IDs]` collapsible toggle that reveals the platform_ids object as a key/value table
- [ ] **AC-77:** Platform IDs are clickable when the platform is recognized (github_repo → GitHub URL, telegram_bot → Telegram URL, etc., per FRONTMATTER_SPEC.md)
- [ ] **AC-78:** "Edit in GitHub →" link renders in the top-right of the page header, deep-linking to `https://github.com/Nkburdick/ORACLE/edit/main/Projects/{slug}/PROJECT.md`
- [ ] **AC-79:** SOW content uses `data-testid="sow-content"` for E2E test
- [ ] **AC-80:** Project not found → 404 page with link back to dashboard

### 10.10 Area Workspace (`/areas/[slug]`)

- [ ] **AC-81:** Route `/areas/[slug]` renders area workspace in center panel
- [ ] **AC-82:** Same tab structure as projects: Chats | Artifacts | SOW (Chats and Artifacts disabled in MVP)
- [ ] **AC-83:** SOW tab renders the parsed AREA.md body
- [ ] **AC-84:** Same metadata card pattern as projects (no state/target_date/phase fields for areas)
- [ ] **AC-85:** Area not found → 404 page

### 10.11 Status Badge in Header

- [ ] **AC-86:** Status badge uses `rounded-full` (pill shape — explicit carve-out per design system)
- [ ] **AC-87:** Badge text is the state value uppercased (`ACTIVE`, `PAUSED`, `PLANNING`, `COMPLETE`)
- [ ] **AC-88:** Badge background is `muted` token; text is `muted-foreground`
- [ ] **AC-89:** Badge does NOT use color encoding for state — all states use the same neutral pill (the status DOT in the sidebar carries the visual encoding)

### 10.12 Markdown Rendering

- [ ] **AC-90:** Headings (h1-h6) render with type scale from DESIGN_SYSTEM.md Section 3
- [ ] **AC-91:** Unordered lists use standard bullet character `•` rendered via `::before { content: '•'; }`
- [ ] **AC-92:** Ordered lists render with default numbering, monospace alignment
- [ ] **AC-93:** DoD checkboxes render as styled checkboxes (12px square, 2px border, copper fill when checked) — read-only in MVP
- [ ] **AC-94:** Inline code uses `font-code` (JetBrains Mono), `bg-muted` background, `border-border` border, neutral text
- [ ] **AC-95:** Code blocks use Shiki with `github-dark-dimmed` (dark mode) and `github-light` (light mode) themes
- [ ] **AC-96:** Code blocks support TypeScript, JavaScript, Svelte, Bash, JSON, YAML, Markdown, CSS, HTML languages
- [ ] **AC-97:** Tables render with `border-collapse`, `border-border` borders, monospace cell content
- [ ] **AC-98:** Blockquotes use `border-l-2 border-l-border pl-4 italic text-muted-foreground/80`
- [ ] **AC-99:** Links use neutral foreground color + underline by default, copper on hover, with `↗` arrow appended to external links via `::after`

### 10.13 Settings (`/settings`)

- [ ] **AC-100:** Route `/settings` renders settings page in center panel
- [ ] **AC-101:** Page shows theme toggle (mirroring sidebar footer toggle) with label
- [ ] **AC-102:** Page shows Oracle App version from `package.json`
- [ ] **AC-103:** Page shows commit SHA from `import.meta.env.VITE_BUILD_SHA` if set

### 10.14 Responsive Layout

- [ ] **AC-104:** Desktop (≥1024px): two-panel layout — sidebar (260px) + center (fluid). NO right panel.
- [ ] **AC-105:** Tablet (768-1024px): two-panel — sidebar (240px) + center (fluid).
- [ ] **AC-106:** Mobile (<768px): single column. Sidebar hidden. Bottom tab bar visible.
- [ ] **AC-107:** Mobile bottom tab bar has 4 tabs: Dashboard, Projects, Areas, Settings
- [ ] **AC-108:** Mobile "Projects" tab opens a full-screen scrollable list (same content as desktop sidebar's PROJECTS section)
- [ ] **AC-109:** Mobile "Areas" tab opens a full-screen scrollable list
- [ ] **AC-110:** Mobile project/area detail views have a back arrow in top-left to return to the list

### 10.15 Project Chats Tab — MVP Placeholder

- [ ] **AC-111:** Chats tab renders the two-panel layout: thread list (~220px) + active thread area (fluid)
- [ ] **AC-112:** Thread list shows at least one placeholder thread (e.g. "Sample thread — Phase 2") with the persistent ★ glyph
- [ ] **AC-113:** Active thread area shows placeholder messages and a message input that is disabled with a "Phase 2" tooltip
- [ ] **AC-114:** Message input is **sticky at the bottom** of the active thread area (CSS: flex column with scrolling messages above and pinned input)

### 10.16 Testing

- [ ] **AC-114:** Vitest unit tests for markdown parser (frontmatter extraction, sensible defaults for missing fields)
- [ ] **AC-115:** Vitest unit tests for DoD counter (checkbox counting, edge cases)
- [ ] **AC-116:** Vitest unit tests for sort_order logic (explicit values, defaults, tiebreaker)
- [ ] **AC-117:** Vitest unit tests for the SSE event broadcast logic
- [ ] **AC-118:** Playwright smoke test runs end-to-end and passes (load home → click project → click area → toggle theme → return to dashboard)
- [ ] **AC-119:** All `data-testid` attributes referenced in tests are present in the components
- [ ] **AC-120:** GitHub Actions CI workflow runs all 6 steps (install, check, lint, test, build, test:e2e) and passes

### 10.17 Deployment

- [ ] **AC-121:** `Dockerfile` builds a production image with the Node adapter output
- [ ] **AC-122:** Image runs and serves the app on port 3000 (or configurable)
- [ ] **AC-123:** Image expects an `ORACLE_DATA_PATH` environment variable pointing to the local ORACLE clone
- [ ] **AC-124:** Image includes a healthcheck endpoint `/api/health` returning 200 OK
- [ ] **AC-125:** GitHub Actions workflow builds the Docker image on merge to main and pushes to GitHub Container Registry
- [ ] **AC-126:** Dockge stack file (`compose.yml`) defined in `app/deploy/` for KVM 2 deployment
- [ ] **AC-127:** Traefik labels in compose file route `oracle.aptoworks.cloud` to the container with HTTPS

### 10.18 Documentation

- [ ] **AC-128:** `app/README.md` updated with setup instructions, dev commands, deploy instructions
- [ ] **AC-129:** `app/docs/PRD.md` (this document) committed to the repo
- [ ] **AC-130:** `app/docs/DESIGN_SYSTEM.md` committed to the repo
- [ ] **AC-131:** `app/docs/FRONTMATTER_SPEC.md` committed to the repo

---

**Total: 131 atomic acceptance criteria.** All must pass for the Forge dispatch to be considered complete.

---

## Open Questions — RESOLVED 2026-04-06

All 8 questions resolved. Decisions captured in their respective sections.

| #   | Question               | Decision                                                         | Section |
| --- | ---------------------- | ---------------------------------------------------------------- | ------- |
| 1   | Data layer             | Runtime SSR + SSE file-watcher push updates                      | 6.1     |
| 2   | Deploy target          | KVM 2 (alongside Pennyworth), `oracle.aptoworks.cloud`           | 8       |
| 3   | Dashboard content      | Dead-simple project completeness cards (projects only, no areas) | 5.1     |
| 4   | Theme toggle placement | Sidebar footer, icon button next to Settings                     | 3.5     |
| 5   | Mobile navigation      | Bottom tab bar: Dashboard, Projects, Areas, Settings             | 4.3     |
| 6   | Search                 | Not in MVP. Tiny vertical space reserved for future              | 4.5     |
| 7   | Metadata card fields   | 4-6 visible fields + collapsible Platform IDs                    | 5.2     |
| 8   | Testing strategy       | Static checks + Vitest unit tests + 1 Playwright smoke test      | 9       |

Additional decisions made during Q&A:

- **Sidebar ordering:** Manual via `sort_order` frontmatter field. Drag-and-drop reorder UI deferred to Phase 2 (Section 4.4).
- **PARA flatness:** Confirmed flat — no sub-projects, no sub-areas, no categories. Honors Tiago Forte's PARA philosophy.
- **Project workspace tabs renamed:** Chats | Artifacts | SOW (was Chat | Docs | Artifacts). SOW = Statement of Work / definition document. (Section 5.2)
- **Multi-thread chat architecture:** Project Chats tab supports multiple threads — persistent (★) for committed work, throwaway (·) for quick questions. Right panel removed entirely. Global FAB chat planned for Phase 2. (Sections 4.7, 4.8)
- **Single shell:** Oracle is one persistent two-panel shell, not a multi-page site. Sidebar never reloads. Only the center panel content swaps. (Section 4.1)
