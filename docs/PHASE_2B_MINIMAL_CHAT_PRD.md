# Phase 2.B — Minimal Chat PRD

**Status:** READY — open questions resolved 2026-04-07
**Author:** Alfred
**Created:** 2026-04-07
**Decisions locked:** 2026-04-07
**Target branch:** `main` (Oracle App)
**Depends on:** Pennyworth `main` at `2d97f1a` or later (PRs #26-32 merged)
**Supersedes:** the Chats-tab placeholder section of `PRD.md` §4.7 for the parts in scope

---

## 1. Why this PRD exists

The Oracle App MVP Shell shipped on 2026-04-07 with the Chats tab visible but **inert** — `~/Code/ORACLE/app/src/routes/projects/[slug]/+page.svelte` lines 101-147 render a static "Sample thread — Phase 2" placeholder with a disabled input. Pennyworth's chat backend prereqs landed today (PRs #26 schema+CRUD+CORS, #28 throwaway purge, #29 hotfix, #30 oracle-writer, #31 vitest, #32 real-DB tests, 81/81 tests green).

This PRD specs **the smallest possible thing** that takes the Chats tab from "inert placeholder" to "I can have a real conversation with Pennyworth scoped to this project." Everything fancy gets deferred.

If a user can:

1. Open a project's Chats tab and immediately see the most recent thread with its messages already on screen (no spinner)
2. Tap `[+ New]` to start a new throwaway thread instantly (zero clicks, zero modals)
3. Type a message, hit Send, see their message appear immediately and Pennyworth's reply appear ~1-3s later
4. Promote a throwaway thread to persistent by either renaming it OR tapping a `★` toggle
5. Delete any thread with a hover ✕ (long-press on mobile)

…then this PRD is done. That is the entire bar.

---

## 2. Scope

### 2.1 IN SCOPE

| #   | Capability                                                | Notes                                                                                                                |
| --- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| S1  | Thread list scoped to current project (`oracle_slug`)     | Shows BOTH persistent (`★`) and throwaway (`·`) threads, sorted by `updatedAt DESC`                                  |
| S2  | Active thread view with full message history              | SSR'd on first paint via page loader; subsequent thread switches load on demand                                      |
| S3  | Create a new throwaway thread instantly                   | One tap on `[+ New]` — no modal, no name prompt. Auto-named, auto-selected                                           |
| S4  | Send a message and render Pennyworth's reply              | Single round-trip POST `/api/chat`. Hybrid optimistic append + silent background reconcile                           |
| S5  | Promote throwaway → persistent                            | Two paths: (a) rename the thread inline → auto-promotes, OR (b) tap `★` toggle in row hover menu / mobile long-press |
| S6  | Delete a thread                                           | Hover ✕ on row (desktop) / long-press (mobile). Confirm dialog only for persistent threads                           |
| S7  | Loading / error / empty UI states for every async surface | Spec'd in §6                                                                                                         |
| S8  | Project-scoped only — `oracle_slug` is always set         | Global/unscoped chat is the FAB, deferred                                                                            |
| S9  | Auto-select most-recent thread on tab open                | Snap to top thread, render its messages immediately                                                                  |
| S10 | Desktop send keybinding: Cmd/Ctrl+Enter                   | Enter is always a newline. Mobile: Send button only                                                                  |
| S11 | One-shot auto-retry on transient fetch failures           | Silent retry after 1s, then surface error with manual `[Retry]` button                                               |

### 2.2 OUT OF SCOPE — explicitly deferred

These are intentionally NOT in this PRD. They are real features, just not now.

| #   | Deferred capability                                    | Defer to         | Why                                                                                              |
| --- | ------------------------------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------ |
| O1  | **SSE streaming** of assistant tokens                  | 2.B.1            | POST `/api/chat` returns the full response in one shot today; streaming is a polish layer on top |
| O2  | **Global throwaway "help chat" FAB**                   | 2.B.2            | Different surface, different auth scope, different concerns                                      |
| O3  | **Artifacts tab wiring**                               | 2.B.3            | Drive integration not yet shipped on Pennyworth                                                  |
| O4  | **Mobile two-screen pattern** (PRD §4.7 mobile flow)   | 2.B.4            | Desktop two-panel works on tablet+; phone polish is its own layout pass                          |
| O5  | "Pennyworth suggests spinning off a focused thread"    | 2.B.5            | Requires backend prompt-engineering work                                                         |
| O6  | "↓ new message" auto-scroll-pause pill                 | 2.B.1 (with SSE) | Only matters once streaming exists                                                               |
| O7  | Markdown rendering of message bodies                   | 2.B.1            | Plain text + preserved newlines is fine for v1                                                   |
| O8  | Council debate / multi-agent UI                        | Phase 3+         |                                                                                                  |
| O9  | Optimistic concurrency / multi-tab conflict resolution | Phase 3+         |                                                                                                  |

If anything in §2.1 starts feeling like it needs a §2.2 item to work, push back and re-scope.

---

## 3. Pennyworth API surface (already shipped)

All endpoints below are **live on Pennyworth `main` at commit `2d97f1a`** (verified 2026-04-07). The Oracle App calls them via `fetch` from the SvelteKit server (so the secret/CORS posture is server-to-server, not browser-to-Pennyworth — see §7).

### 3.1 List threads for a project

```
GET {PENNYWORTH_BASE_URL}/api/conversations?oracle_slug={slug}&include_ephemeral=true
```

**Note:** we always pass `include_ephemeral=true` because Q2 = (b) — the Chats tab shows everything (persistent + throwaway), sorted most-recent-first. Pennyworth handles the sort server-side (`updatedAt DESC`).

**Returns 200:**

```json
{
	"conversations": [
		{
			"id": "abc123",
			"title": "push notification research",
			"oracleSlug": "stridemind-ai",
			"isEphemeral": false,
			"createdAt": "2026-04-05T12:34:56.000Z",
			"updatedAt": "2026-04-07T09:11:22.000Z"
		}
	]
}
```

### 3.2 Create a new thread (always throwaway from Oracle App)

```
POST {PENNYWORTH_BASE_URL}/api/conversations
Content-Type: application/json

{ "title": "Quick chat 13:42", "oracleSlug": "stridemind-ai", "isEphemeral": true }
```

**Auto-naming rule:** the Oracle App generates the title client-side as `"Quick chat HH:MM"` using local time. After the user sends the first message, the loader/component MAY (post-MVP) overwrite the title with the first ~40 chars of that message — for v1, we keep the timestamp name until the user explicitly renames.

Always sends `isEphemeral: true`. Promotion to persistent happens via §3.6 (PATCH).

**Returns 201:** `{ "conversation": { id, title, oracleSlug, isEphemeral, createdAt, updatedAt } }`

### 3.3 Load message history

```
GET {PENNYWORTH_BASE_URL}/api/conversations/{id}/messages
```

**Returns 200:**

```json
{
	"messages": [
		{ "id": "m1", "conversationId": "abc123", "role": "user", "content": "hi", "createdAt": "..." },
		{
			"id": "m2",
			"conversationId": "abc123",
			"role": "assistant",
			"content": "hello",
			"createdAt": "..."
		}
	]
}
```

`role` is one of `"user" | "assistant" | "system"`. Messages come back in chronological (oldest-first) order. **Returns 404** if conversation not found.

### 3.4 Send a message (single round-trip)

```
POST {PENNYWORTH_BASE_URL}/api/chat
Content-Type: application/json

{ "message": "Hi Alfred", "conversationId": "abc123", "oracleSlug": "stridemind-ai" }
```

**Returns 200:**

```json
{
  "response": "Hey Nick — I'm here. What's up?",
  "conversationId": "abc123",
  "artifacts": { ... }
}
```

`artifacts` is opaque to this PRD — we ignore it for the minimal version (it powers the future Artifacts tab). `conversationId` is always provided by the client (the Oracle App always creates the thread explicitly via §3.2 first).

**Returns 429** on rate limit (`error: string`). **Returns 500** on internal error.

### 3.5 Delete a thread

```
DELETE {PENNYWORTH_BASE_URL}/api/conversations/{id}
```

**Returns 200:** `{ "deleted": "abc123" }`. Cascades to messages via FK constraint. **Returns 404** if not found.

### 3.6 Rename / promote thread (PATCH — needed by S5)

```
PATCH {PENNYWORTH_BASE_URL}/api/conversations/{id}
Content-Type: application/json

{ "title": "push notification research", "isEphemeral": false }
```

Either field is optional but at least one must be present (Pennyworth returns 400 on a no-op PATCH). The Oracle App uses this for two paths:

- **Rename → auto-promote:** when the user inline-renames a throwaway thread, send `{ title: <new>, isEphemeral: false }` in a single PATCH.
- **Star toggle:** when the user taps the `★` toggle on a throwaway thread, send `{ isEphemeral: false }` only. Title stays the auto-generated `"Quick chat HH:MM"`.

**Returns 200:** `{ "conversation": { ... } }` with the updated row.

### 3.7 Endpoints NOT used in this PRD

- `POST /api/oracle/projects` and `POST /api/oracle/areas` — used by the FAB chat (deferred O2), not by the project Chats tab.

---

## 4. Frontend architecture

### 4.1 Where the code goes

Today the Chats tab UI lives inline in `~/Code/ORACLE/app/src/routes/projects/[slug]/+page.svelte` lines 101-147 as a placeholder. We're going to:

1. **Extract the Chats tab into its own component:** `src/lib/components/ProjectChats.svelte`. The parent page just renders `<ProjectChats slug={fm.slug ?? params.slug} initialThreads={data.threads} initialMessages={data.initialMessages} />` inside the `{#if activeTab === 'chats'}` block. Keeps `+page.svelte` lean and lets us iterate on chat UX without touching the SOW/Artifacts surface.
2. **Add a thin Pennyworth client lib:** `src/lib/server/pennyworth-client.ts` with one function per endpoint listed in §3. **Server-only** — `fetch`-based, lives next to `oracle-reader.ts`. The client takes a `baseUrl` parameter so it's testable.
3. **Add a SvelteKit API route for client-initiated mutations:** `src/routes/api/projects/[slug]/threads/+server.ts` (and a sibling for `/messages`) that proxies create/send/rename/delete to Pennyworth from the SvelteKit server. The browser only ever talks to its own SvelteKit `/api/...` — never directly to Pennyworth.
4. **Extend `+page.server.ts`** to fetch threads + most-recent-thread messages alongside the existing project data, so the Chats tab is SSR'd and instant on first paint (Q4 = a).

### 4.2 State model (component-local)

`ProjectChats.svelte` owns this state with Svelte 5 runes. Initial values are seeded from `initialThreads` / `initialMessages` props from the loader, so there's no first-paint loading skeleton on the SSR path:

```ts
type Thread = { id: string; title: string; updatedAt: string; isEphemeral: boolean };
type Message = {
	id: string;
	role: 'user' | 'assistant' | 'system';
	content: string;
	createdAt: string;
};

let { slug, initialThreads = [], initialMessages = [] } = $props();

let threads = $state<Thread[]>(initialThreads);
let threadsError = $state<string | null>(null);
// no threadsLoading on first paint — SSR has it; only used during refreshes

let activeThreadId = $state<string | null>(initialThreads[0]?.id ?? null);
let messages = $state<Message[]>(initialMessages);
let messagesLoading = $state(false);
let messagesError = $state<string | null>(null);

let draft = $state('');
let sending = $state(false);
let sendError = $state<string | null>(null);
```

### 4.3 Data flow

```
[Page navigation: /projects/{slug}]
   │
   ▼
+page.server.ts loader runs (server-side):
   ├─► oracle-reader.getProject(slug)
   ├─► pennyworth.listThreads(slug, { includeEphemeral: true })
   └─► if threads.length > 0:
         pennyworth.getMessages(threads[0].id)
   │
   ▼
SvelteKit SSRs the page including ProjectChats with initial data
   │
   ▼
[ProjectChats hydrates — already populated, no spinner]
   │
   ▼
[user clicks a different thread in the rail]
   │
   ▼
fetch('/api/projects/{slug}/threads/{id}/messages')   ← SvelteKit API route, server proxies to Pennyworth
   │
   ▼
[user types a message, presses Cmd+Enter or clicks Send]
   │
   │   1. optimistic-append a temporary user message with synthetic ID `tmp-{nanoid}`
   │   2. flip `sending = true`, disable input, keep draft text in case of failure
   │
   ▼
fetch('/api/projects/{slug}/threads/{id}/chat', { body: { message } })
   │
   ├─► on success:
   │     a) append assistant response to messages
   │     b) clear draft, refocus input, set sending = false
   │     c) silently re-fetch /messages in the background to reconcile real IDs
   │        (replaces the synthetic-ID user message with the canonical one)
   │
   └─► on failure:
         a) one silent auto-retry after 1000ms
         b) if retry also fails: roll back optimistic message, restore draft,
            show inline error "Couldn't send. [Retry]" beside the input
   │
   ▼
[user clicks [+ New]]
   │
   ▼
title := `Quick chat ${HH:MM}` (local time)
fetch('/api/projects/{slug}/threads', { body: { title, isEphemeral: true } })
   │
   ▼
prepend new thread to `threads`, set activeThreadId, clear messages, focus input
(no extra round-trip — the POST response gives us the new thread directly)
```

### 4.4 Promote-to-persistent flows (S5)

**Path A — Rename:** user double-clicks the thread title in the rail (or taps it on mobile-edit-mode) → an inline `<input>` replaces the title. On Enter or blur:

```
fetch('/api/projects/{slug}/threads/{id}', { method: 'PATCH', body: { title: <new>, isEphemeral: false } })
```

On 200, update the local thread in place: `title = new`, `isEphemeral = false`. The `★`/`·` glyph swaps automatically.

**Path B — Star toggle:** user hovers a throwaway row → a `☆` button appears alongside the ✕. Tap it:

```
fetch('/api/projects/{slug}/threads/{id}', { method: 'PATCH', body: { isEphemeral: false } })
```

On 200, set `isEphemeral = false` locally. Glyph flips from `·` to `★`. Title is unchanged (still `"Quick chat 13:42"`).

Mobile equivalent of the hover affordances: long-press on a thread row opens a context sheet with `Star` and `Delete` actions.

### 4.5 Where Pennyworth lives

For now: `PENNYWORTH_BASE_URL=http://pennyworth:3000` from the Oracle App container's perspective on KVM 2 (both containers on `root_default` network — no public exposure needed). For local dev: `http://localhost:3000`. Server-side fetch only — the browser never talks to Pennyworth directly. See §7.

---

## 5. UX spec

### 5.1 Layout (desktop, ≥768px)

Same two-panel-within-the-tab layout that the placeholder already renders:

- **Left rail:** ~220px. Thread list, scrollable, **shows persistent + throwaway both** (per S1/Q2). Glyphs: `★` for persistent, `·` for throwaway. Each item shows the title (truncate single-line) and a tiny relative timestamp ("3h ago"). Active thread has a subtle accent background. `[+ New]` button pinned at the bottom. Hover over a row reveals two icon buttons on the right: `☆` (only on throwaway rows — promotes to persistent) and `✕` (delete).
- **Right pane:** message history (scrollable, oldest at top, newest at bottom) with a sticky message input row at the bottom. Input has placeholder "Type a message…" and a Send button. Cmd/Ctrl+Enter sends; Enter is always a newline (Q6).

The placeholder already does this layout — we keep its visual structure verbatim and just wire it to data.

### 5.2 New thread interaction (Q1 = a)

Clicking `[+ New]`:

1. Generates `title = "Quick chat HH:MM"` from local time
2. Fires `POST /api/projects/{slug}/threads { title, isEphemeral: true }` immediately
3. On 201, prepends the new thread to the rail, auto-selects it, clears the message pane, focuses the message input
4. **No modal, no naming prompt, no confirmation.** Zero clicks beyond the initial `[+ New]` tap.

If the user wants to give it a real name, they rename inline later (which auto-promotes per §4.4 Path A).

### 5.3 Thread visibility (Q2 = b)

The rail shows **all** threads for the project — persistent and throwaway, mixed, sorted by `updatedAt DESC`. There is no toggle, no filter, no "Show throwaway" link. The two types are visually distinguished only by the glyph (`★` vs `·`).

Untouched throwaways are swept by Pennyworth's existing 7-day purge cron (PR #28). The Oracle App does not need to handle expiry — they just stop appearing in the list.

### 5.4 Auto-select on tab open (Q8 = a)

When the page loader runs and threads exist, the loader pre-fetches the most-recent thread's messages and the component initializes with `activeThreadId = threads[0].id`. The user lands directly in their most recent conversation, no extra clicks.

If there are zero threads, the rail shows the empty state (§6.1) and the right pane shows "Start a thread by tapping `[+ New]`."

### 5.5 Send keybinding (Q6 = b)

- **Desktop:** Cmd+Enter (Mac) or Ctrl+Enter (everywhere else) sends. Enter always inserts a newline. Send button works as a backup at all times.
- **Mobile (touch device, no physical keyboard):** the Send button is the only send path. The OS keyboard's "return"/"enter" key always inserts a newline, never sends.

Detection: use a media query / pointer-coarse heuristic OR just check `navigator.platform` for the Cmd-vs-Ctrl branch — doesn't matter for the keybinding rule itself, only for the tooltip/placeholder hint shown next to Send.

### 5.6 Delete UX (Q7 = a)

- **Desktop:** hovering a thread row reveals a `✕` icon button on the right side. Clicking it:
  - **Persistent thread (`★`):** opens a confirmation dialog "Delete '{title}'? This can't be undone." → Confirm fires DELETE, Cancel closes.
  - **Throwaway thread (`·`):** fires DELETE immediately, no confirmation.
- **Mobile:** long-press a row → context sheet with `Delete` (and `Star` for throwaways). Same confirmation rule based on persistent vs. throwaway.

After successful delete, the row is removed from the rail. If the deleted thread was the active one, fall back to the next-most-recent thread (if any) or the empty state.

### 5.7 Mobile (<768px)

Out of scope (O4). For this PRD, the same desktop two-panel renders compressed and we accept that it's ugly. The proper two-screen pattern from PRD §4.7 mobile flow ships in 2.B.4. Long-press affordances for star/delete still work — they're touch-native and don't require the two-screen layout.

### 5.8 Message rendering

- User messages: right-aligned bubble, primary background.
- Assistant messages: left-aligned bubble, muted background.
- **Plain text only.** No markdown rendering in this PRD (deferred O7). Newlines preserved (`whitespace-pre-wrap`).
- Timestamp format: time-of-day ("13:42") if today, otherwise short date ("Apr 5").

---

## 6. State spec (empty / loading / error / loaded)

**Hard rule:** every async operation has all four states, and they all render _something_. No silent failures, no infinite spinners.

### 6.1 Thread list

| State   | Trigger                                                     | UI                                                                                                      |
| ------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Empty   | `threads.length === 0` after loader ran                     | "No threads yet for this project." + a primary `[+ New thread]` button                                  |
| Loading | Only on client-side refresh (SSR path has no loading state) | 3 skeleton rows in the left rail                                                                        |
| Error   | Loader threw OR client refresh failed                       | Inline error: "Couldn't load threads. [Retry]" — Retry re-runs the fetch (with one auto-retry per §6.6) |
| Loaded  | `threads.length > 0`                                        | Render list, auto-select most recent (per §5.4)                                                         |

### 6.2 Active thread / messages

| State        | Trigger                                                                                  | UI                                                                        |
| ------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| No selection | `activeThreadId === null` AND `threads.length > 0` (rare — only after delete-then-empty) | Right pane: "Pick a thread to keep going."                                |
| Empty list   | `threads.length === 0`                                                                   | Right pane: "Start a thread by tapping [+ New]."                          |
| Loading      | `messagesLoading` (only on thread switch, not on first paint)                            | Subtle spinner above the input row, existing messages stay visible if any |
| Empty thread | `messages.length === 0 && !messagesLoading && activeThreadId !== null`                   | "Say hi to Pennyworth." in the message area; input is enabled             |
| Error        | `messagesError !== null`                                                                 | Inline error: "Couldn't load messages. [Retry]"                           |
| Loaded       | otherwise                                                                                | Render messages                                                           |

### 6.3 Send (hybrid optimistic per Q5 = c)

| State                    | Trigger                                    | UI                                                                                                                                                                                             |
| ------------------------ | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Idle                     | `!sending`                                 | Input enabled, Send button enabled when `draft.trim() !== ''`                                                                                                                                  |
| Optimistic               | `sending && optimisticMessage in messages` | Optimistic user bubble appears immediately with synthetic `tmp-*` ID. Input disabled. Send button shows spinner. Draft retained in case of failure                                             |
| Success                  | response received                          | Append assistant message to list. Clear draft, refocus input. **Then silently re-fetch `/messages` in background to reconcile real IDs.** No user-visible flicker — replacement is by ID match |
| Error (after auto-retry) | POST + 1s retry both failed                | Roll back optimistic user message. Restore draft. Show inline error "Couldn't send. [Retry]" beside the input. Input re-enabled                                                                |

### 6.4 Delete

| State                    | Trigger                    | UI                                                                                   |
| ------------------------ | -------------------------- | ------------------------------------------------------------------------------------ |
| Initiate (persistent)    | user clicks ✕ on a `★` row | Confirmation dialog: "Delete '{title}'? This can't be undone."                       |
| Initiate (throwaway)     | user clicks ✕ on a `·` row | Fires DELETE immediately, no dialog                                                  |
| In flight                | DELETE pending             | Row shows muted/disabled                                                             |
| Success                  | 200                        | Remove row from list. If it was active, fall back to next-most-recent or empty state |
| Error (after auto-retry) | failed                     | Toast: "Couldn't delete. [Retry]"                                                    |

### 6.5 Promote (rename or star)

| State                    | Trigger                                             | UI                                                                                     |
| ------------------------ | --------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Initiate (rename)        | user double-clicks (or taps in edit mode) the title | Inline `<input>` replaces the title text, focused, value pre-filled with current title |
| Initiate (star)          | user clicks `☆` on a throwaway row                  | Fires PATCH immediately, no dialog                                                     |
| In flight                | PATCH pending                                       | Row title shows muted; star button shows spinner                                       |
| Success                  | 200                                                 | Update local thread in place: title and/or `isEphemeral`. Glyph swaps `·` → `★`        |
| Error (after auto-retry) | failed                                              | Inline error in the rail: "Couldn't update thread. [Retry]"                            |

### 6.6 Auto-retry policy (Q10 = c)

For every fetch in §6.1-6.5 EXCEPT Send (which has its own copy of the rule above):

1. Fetch fails (network error, 5xx, timeout)
2. Wait 1000ms
3. Try once more, silently
4. If second attempt also fails → render the error state above with a `[Retry]` button
5. `[Retry]` runs the same one-shot-auto-retry sequence again

4xx responses (404, 400, etc.) are **NOT** retried — they're rendered as errors immediately. Only transport-level / 5xx failures get the auto-retry.

### 6.7 Network down (Pennyworth unreachable)

If the SvelteKit server can't reach Pennyworth at all, the loader returns a structured error and the component renders the error state. **No** generic 500 page — the rest of the project view (SOW, Artifacts placeholder) still renders normally.

---

## 7. Config / environment

### 7.1 New env var on Oracle App

`PENNYWORTH_BASE_URL` (server-side only) — required, no default.

- Local dev: `PENNYWORTH_BASE_URL=http://localhost:3000`
- Production (KVM 2): `PENNYWORTH_BASE_URL=http://pennyworth:3000` — both containers must be on the `root_default` network

Add to `compose.yml` for the `oracle` service. Add to `.env.example`. Document in the deploy README. Missing env var → loader fails fast with a clear server-log message.

### 7.2 CORS

**No browser-to-Pennyworth calls** in this PRD — all `fetch` calls happen from the SvelteKit server to Pennyworth on the internal Docker network. So CORS is **not in scope** for the Oracle App side.

Pennyworth's CORS middleware (PR #26) already permits the Oracle App origin. If we ever switch to direct browser-to-Pennyworth (e.g., for SSE in 2.B.1), revisit then.

### 7.3 Auth

The Oracle App is already gated by Traefik BasicAuth at the edge. Pennyworth on `root_default` is internal-only (`127.0.0.1:3000` bind, no Traefik route). So inside-the-network calls don't need additional auth for this PRD.

### 7.4 Container networking

The `oracle` service in `/opt/oracle-stack/compose.yml` currently attaches to `default` and `root_default` (the Traefik network). It needs no new network for Pennyworth — `pennyworth` is also on `root_default`. **Verify this assumption during BUILD** (`docker network inspect root_default | grep -E 'oracle|pennyworth'`). If wrong, add a shared `pennyworth-internal` network.

---

## 8. Resolved UX decisions (deep-dive 2026-04-07)

| #   | Decision                                                                                      | Where it's spec'd                                     |
| --- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Q1  | New-thread UX = **instant throwaway, zero clicks**                                            | §5.2                                                  |
| Q2  | Default visibility = **show persistent + throwaway both, sorted by recent**                   | §5.3                                                  |
| Q3  | Promote gesture = **rename auto-promotes AND `★` toggle in row hover**                        | §4.4, §5.6                                            |
| Q4  | Initial data source = **`+page.server.ts` loader, SSR'd on first paint**                      | §4.1 (item 4), §4.3                                   |
| Q5  | Send append strategy = **hybrid optimistic + silent background reconcile**                    | §4.3, §6.3                                            |
| Q6  | Send keybinding = **Cmd/Ctrl+Enter sends; Enter always = newline; mobile = Send button only** | §5.5                                                  |
| Q7  | Delete UX = **hover ✕ on row (desktop) / long-press (mobile); confirm only for persistent**   | §5.6, §6.4                                            |
| Q8  | Auto-select most-recent thread on tab open = **yes**                                          | §5.4                                                  |
| Q9  | Empty-project placeholder                                                                     | **Moot — Q1=a means no modal, no placeholder needed** |
| Q10 | Error retry strategy = **one silent auto-retry after 1s, then manual `[Retry]`**              | §6.6                                                  |

---

## 9. Acceptance Criteria

These are the binary, build-against-this-and-it's-done items.

### 9.1 Component / file structure

- **AC-1** — `~/Code/ORACLE/app/src/lib/components/ProjectChats.svelte` exists and renders the two-panel layout from PRD §4.7
- **AC-2** — `+page.svelte` `{#if activeTab === 'chats'}` block renders `<ProjectChats slug={...} initialThreads={...} initialMessages={...} />` and contains no chat-specific markup of its own
- **AC-3** — `~/Code/ORACLE/app/src/lib/server/pennyworth-client.ts` exposes typed functions for: `listThreads`, `createThread`, `getMessages`, `sendMessage`, `deleteThread`, `patchThread`
- **AC-4** — `+page.server.ts` loader returns `{ project, threads, initialMessages }` with `threads` from `listThreads(slug, { includeEphemeral: true })` and `initialMessages` from `getMessages(threads[0].id)` when `threads.length > 0`
- **AC-5** — SvelteKit API routes exist under `src/routes/api/projects/[slug]/threads/` for create/patch/delete and under `src/routes/api/projects/[slug]/threads/[id]/messages/` for getMessages and chat-send

### 9.2 Initial render (SSR path)

- **AC-6** — On a project page navigation, the rendered HTML includes the thread list and (if any thread exists) the most-recent thread's messages — verifiable by `view-source` having no client-side spinner
- **AC-7** — Threads render in the left rail with `★` for `isEphemeral=false` and `·` for `isEphemeral=true`
- **AC-8** — The most-recent thread is auto-selected with a subtle accent background; its messages render in the right pane

### 9.3 New thread (Q1 = a)

- **AC-9** — Tapping `[+ New]` calls `POST /api/projects/{slug}/threads` with body `{ title: "Quick chat HH:MM", isEphemeral: true }` (HH:MM from local time)
- **AC-10** — The new thread appears at the top of the rail, becomes the active selection, message pane clears, message input gains focus — all without any modal or confirmation dialog
- **AC-11** — The new thread has the `·` glyph (throwaway)

### 9.4 Send (Q5 = c, Q6 = b)

- **AC-12** — Cmd+Enter (Mac) or Ctrl+Enter (other) in the message input fires Send. Enter alone inserts a newline
- **AC-13** — On mobile/touch, the Send button fires Send; the keyboard's return key inserts a newline
- **AC-14** — On Send: a user-bubble with synthetic `tmp-*` ID appears immediately in the message list, draft is retained, input is disabled, Send button shows a spinner
- **AC-15** — On 200 from `/api/chat`: the assistant response appears as a new bubble, draft clears, input refocuses
- **AC-16** — After the response renders, a silent background `getMessages` re-fetch reconciles the synthetic-ID user message with the canonical row, with no visible flicker (replacement by ID match)
- **AC-17** — On send failure: one silent auto-retry after 1000ms; if second attempt also fails, the optimistic message is rolled back, draft is restored, and an inline error "Couldn't send. [Retry]" appears beside the input

### 9.5 Promote / rename (S5)

- **AC-18** — Double-clicking a thread title in the rail enters inline-edit mode with the title in a focused `<input>`
- **AC-19** — Confirming an edit (Enter or blur with changes) fires `PATCH /api/projects/{slug}/threads/{id}` with `{ title: <new>, isEphemeral: false }` and updates the row in place; glyph flips `·` → `★` for previously-throwaway threads
- **AC-20** — Hovering a `·` (throwaway) row reveals a `☆` button alongside the `✕` button
- **AC-21** — Tapping `☆` fires `PATCH` with `{ isEphemeral: false }` only; row updates in place, glyph flips `·` → `★`, title unchanged

### 9.6 Delete (Q7 = a)

- **AC-22** — Hovering a thread row reveals a `✕` icon button
- **AC-23** — Clicking `✕` on a `★` row opens a confirm dialog "Delete '{title}'? This can't be undone."
- **AC-24** — Clicking `✕` on a `·` row fires DELETE immediately with no dialog
- **AC-25** — On 200 from DELETE: the row disappears; if it was active, the next-most-recent thread becomes active (or the empty state shows)
- **AC-26** — On mobile, long-pressing a row opens a context sheet with `Delete` (and `Star` for throwaways), with the same persistent-vs-throwaway confirmation rule

### 9.7 State spec

- **AC-27** — Thread list renders all four states distinctly (empty / loading-on-refresh / error / loaded) per §6.1
- **AC-28** — Message pane renders all five states distinctly (no-selection / empty-list / loading-on-switch / empty-thread / error / loaded) per §6.2
- **AC-29** — Send renders all four states distinctly (idle / optimistic / success / error) per §6.3
- **AC-30** — Delete renders all four states distinctly per §6.4
- **AC-31** — Promote renders all four states distinctly per §6.5
- **AC-32** — Auto-retry policy: every fetch except Send retries silently once after 1000ms on transport/5xx failures; 4xx is rendered immediately without retry

### 9.8 Config / safety

- **AC-33** — `PENNYWORTH_BASE_URL` is read from env on the server side; missing env var fails fast with a clear server-log error and the loader returns a structured error so the rest of the project view still renders
- **AC-34** — No browser-side `fetch` calls go directly to Pennyworth — all calls are either server-loader-side or via a SvelteKit API route under `/api/`
- **AC-35** — When Pennyworth is unreachable, the rest of the project view (SOW tab, header, sidebar) still renders normally with the chat error state confined to the Chats tab
- **AC-36** — Mobile (<768px) is allowed to look ugly — no specific layout requirement (deferred to 2.B.4) — but star/delete long-press affordances still work

### 9.9 Tests

- **AC-37** — At least one Vitest unit test per `pennyworth-client.ts` function with a mocked `fetch` (6 functions → ≥6 tests)
- **AC-38** — At least one component test for `ProjectChats.svelte` covering the empty / loaded / error states of the thread rail
- **AC-39** — At least one integration test that exercises the loader → SSR → first-paint path with a mocked Pennyworth client
- **AC-40** — At least one component test for the optimistic send path: send → optimistic bubble → response → reconcile

---

## 10. Out of scope, again, in case anyone forgot

- ❌ SSE streaming
- ❌ Global FAB chat
- ❌ Artifacts tab
- ❌ Mobile two-screen layout (long-press affordances are in scope; the layout pattern itself is not)
- ❌ Markdown rendering of messages
- ❌ Pennyworth-suggested thread spinoff
- ❌ Multi-agent / council UI
- ❌ Optimistic concurrency / multi-tab conflict resolution
- ❌ Auto-renaming a throwaway based on first message content (deferred polish)

If any of these appear in the implementation, the PRD is wrong — push back on whoever added them.

---

## 11. Dependencies

| Dep                                                                           | Status      | Notes                                      |
| ----------------------------------------------------------------------------- | ----------- | ------------------------------------------ |
| Pennyworth thread CRUD endpoints (GET/POST/PATCH/DELETE `/api/conversations`) | ✅ shipped  | PR #26 (`e0b19e3`)                         |
| Pennyworth `oracle_slug` schema field                                         | ✅ shipped  | PR #26 + #29 hotfix                        |
| Pennyworth CORS middleware                                                    | ✅ shipped  | PR #26 — but unused by this PRD (see §7.2) |
| Pennyworth real-DB integration tests                                          | ✅ shipped  | PRs #31 + #32 (81/81 green)                |
| Pennyworth throwaway purge cron                                               | ✅ shipped  | PR #28 — actively relied on in §5.3        |
| Pennyworth PATCH `/api/conversations/:id`                                     | ✅ shipped  | PR #26 — used by §3.6 for promote/rename   |
| `PENNYWORTH_BASE_URL` env var on Oracle App                                   | ⏭ this PRD | Add in §7.1                                |
| `oracle` and `pennyworth` containers on shared network                        | ⏭ verify   | Both should be on `root_default` already   |

---

## 12. Open follow-ups

None — all open questions resolved 2026-04-07. PRD is READY for build (whether by Forge dispatch or direct implementation by Alfred).

---

**End of PRD.**
