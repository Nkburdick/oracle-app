# Phase 2.B.1 — SSE Streaming + Markdown Rendering

## Overview

Upgrade Oracle App chat from atomic POST-and-wait to real-time SSE streaming with rich markdown rendering. This is the #2 item on the Telegram exit critical path (after Phase 2.B.4 mobile chat, which shipped 2026-04-10). Makes chat feel like a professional AI interface — tokens stream in progressively with a typing cursor, and responses render with full markdown formatting including syntax-highlighted code blocks.

**Two PRs, two repos:**

- **PR 1 (Pennyworth):** New `POST /api/chat/stream` SSE endpoint exposing Agent SDK's existing async iterator
- **PR 2 (Oracle App):** Wire frontend to SSE stream, add client-side markdown rendering, auto-scroll on desktop, fix mobile composer layout bug, decouple rename from promote

## Architecture

### Current Flow (Atomic)

```
User types → POST /api/chat → Pennyworth buffers full Agent SDK response → JSON { response } → Frontend appends
```

Wait time: 5-60 seconds of "Alfred is thinking..." with animated dots.

### New Flow (Streaming)

```
User types → POST /api/chat/stream → Pennyworth iterates Agent SDK async → SSE token events → Frontend renders progressively
```

First token visible in ~1-2 seconds. Response builds token-by-token with blinking cursor.

### SSE Event Protocol

**Endpoint:** `POST /api/chat/stream`
**Content-Type:** `text/event-stream`
**Auth:** `Authorization: Bearer {AOL_API_TOKEN}`

**Request body** (same as existing `/api/chat`):

```json
{
	"message": "string",
	"conversationId": "string (optional)",
	"oracleSlug": "string (optional)"
}
```

**Event types:**

```
event: token
data: {"text": "partial text chunk"}

event: metadata
data: {"conversationId": "abc123", "sessionId": "xyz"}

event: done
data: {"fullText": "complete response", "artifacts": {...}}

event: error
data: {"message": "error description", "code": 429}
```

**Sequence:**

1. Client POSTs with message body, receives `text/event-stream` response
2. First event is `metadata` with conversationId (so client can reconcile)
3. `token` events stream as Agent SDK yields content
4. `done` event fires with complete text + artifacts
5. Connection closes

**Error handling:**

- If Agent SDK fails before any tokens: return HTTP 500 (not SSE)
- If Agent SDK fails mid-stream: send `error` event, then close
- Rate limit (429): return HTTP 429 before SSE begins (retry logic stays client-side)

### Oracle App SSE Proxy

Oracle App proxies SSE through its own API routes (browser never talks to Pennyworth directly — existing architectural constraint from Phase 2.B AC-34).

**New route:** `POST /api/projects/[slug]/threads/[id]/chat/stream/+server.ts`

This route:

1. Validates auth + params (same as existing chat route)
2. Opens SSE connection to Pennyworth's `/api/chat/stream`
3. Pipes events through to the browser using SvelteKit's `ReadableStream` response
4. No buffering — each Pennyworth SSE event is forwarded immediately

### Fallback

If the SSE connection fails or Pennyworth returns non-200 before streaming begins, the frontend falls back to the existing atomic `POST /api/chat` endpoint. This ensures chat works even if there's an SSE infrastructure issue.

---

## PR 1: Pennyworth Backend — SSE Streaming Endpoint

### Files to modify

| File                   | Change                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| `src/api/server.ts`    | Add `POST /api/chat/stream` route handler                                                      |
| `src/services/chat.ts` | Extract streaming variant of `handleChat()` that yields events instead of returning atomically |
| `src/agent-sdk.ts`     | No changes needed — async iterator already exists (lines 154-212)                              |
| `src/db/schema.ts`     | No changes                                                                                     |

### Implementation Details

**`POST /api/chat/stream` handler (server.ts):**

```typescript
app.post('/api/chat/stream', authMiddleware, async (c) => {
	const body = await c.req.json();
	// Validate same as /api/chat

	return c.newResponse(
		new ReadableStream({
			async start(controller) {
				const encoder = new TextEncoder();
				const send = (event: string, data: object) => {
					controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
				};

				try {
					for await (const chunk of handleChatStream(body)) {
						send(chunk.event, chunk.data);
					}
				} catch (err) {
					send('error', { message: err.message });
				} finally {
					controller.close();
				}
			}
		}),
		{
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive'
			}
		}
	);
});
```

**`handleChatStream()` generator (chat.ts):**

This is a new `async function*` that reuses the existing `handleChat()` logic but yields events instead of returning:

1. Persist user message to DB (same as now)
2. Build system prompt with ORACLE context (same as now)
3. Yield `metadata` event with conversationId
4. Iterate Agent SDK `for await (const msg of q)`:
   - On `msg.type === "assistant"`: extract text, yield `token` events
   - On `msg.type === "result"`: yield `done` event with full text + artifacts
5. Persist assistant message to DB (same as now, after stream completes)
6. Fire-and-forget: memory markers, handoff (same as now)

**Key detail:** The Agent SDK async iterator yields **assistant turn chunks**, not individual tokens. Each `msg.type === "assistant"` contains a text block that may be a sentence or paragraph. The `token` SSE events will contain these chunks — the frontend handles making them feel smooth via progressive rendering.

**Existing `/api/chat` is NOT modified.** It stays as-is for backwards compatibility.

### Acceptance Criteria — PR 1 (Pennyworth)

- AC-B1: `POST /api/chat/stream` returns `Content-Type: text/event-stream`
- AC-B2: First SSE event is `metadata` with `conversationId` field
- AC-B3: Assistant content arrives as one or more `token` events with `text` field
- AC-B4: Final event is `done` with `fullText` and `artifacts` fields
- AC-B5: Connection closes after `done` event
- AC-B6: Rate limit (429) returns HTTP 429 before SSE stream begins
- AC-B7: Agent SDK errors mid-stream emit `error` event before close
- AC-B8: User message persisted to DB before streaming starts
- AC-B9: Assistant message persisted to DB after stream completes (not during)
- AC-B10: Existing `POST /api/chat` endpoint unchanged and still working
- AC-B11: Bearer token auth required (same as `/api/chat`)
- AC-B12: Request body schema identical to `/api/chat` (message, conversationId, oracleSlug)

---

## PR 2: Oracle App Frontend — Streaming UI + Markdown + Fixes

### Files to modify

| File                                                                         | Change                                                        | Lines               |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------- |
| **NEW** `src/routes/api/projects/[slug]/threads/[id]/chat/stream/+server.ts` | SSE proxy route                                               | ~60 lines           |
| **NEW** `src/lib/chat-markdown.ts`                                           | Client-side markdown renderer (Marked, no Shiki)              | ~40 lines           |
| `src/lib/components/ProjectChats.svelte`                                     | SSE streaming, markdown rendering, auto-scroll, typing cursor | Significant changes |
| `src/routes/projects/[slug]/chats/[threadId]/+page.svelte`                   | SSE streaming, markdown rendering, composer fix               | Significant changes |
| `src/routes/+layout.svelte`                                                  | Conditional `pb-16` removal for chat thread route             | ~3 lines            |
| `src/routes/api/projects/[slug]/threads/[id]/+server.ts`                     | Rename decoupled from promote                                 | ~5 lines            |
| `src/lib/server/pennyworth-client.ts`                                        | Add `sendMessageStream()` method                              | ~30 lines           |
| `src/lib/types/chat.ts`                                                      | Add streaming event types                                     | ~15 lines           |
| `src/app.css`                                                                | Markdown chat styles (prose, code blocks, cursor)             | ~60 lines           |

### 1. SSE Proxy Route

**File:** `src/routes/api/projects/[slug]/threads/[id]/chat/stream/+server.ts`

SvelteKit `POST` handler that:

1. Reads `message` from request body
2. Calls `pennyworth.sendMessageStream(message, threadId, slug)`
3. Returns the Pennyworth SSE stream as a `Response` with `text/event-stream`
4. On non-200 from Pennyworth: return error JSON (not SSE)

### 2. Client-Side Markdown Renderer

**File:** `src/lib/chat-markdown.ts`

```typescript
import { Marked } from 'marked';

const chatMarked = new Marked();
chatMarked.setOptions({ gfm: true, breaks: true });

// Custom renderer for code blocks — CSS-only styling (no Shiki on client)
chatMarked.use({
	renderer: {
		code({ text, lang }) {
			const langClass = lang ? ` data-lang="${lang}"` : '';
			const escapedText = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
			return `<pre class="chat-code-block"${langClass}><code>${escapedText}</code></pre>`;
		}
	}
});

export function renderChatMarkdown(content: string): string {
	return chatMarked.parse(content) as string;
}
```

**Why no Shiki on client:** Shiki loads ~2MB of WASM + grammars. For chat messages, CSS-only code block styling (monospace, background, border) is sufficient. Syntax highlighting can be added later as a progressive enhancement.

**Rendering strategy during streaming:** The full accumulated text is re-parsed through `renderChatMarkdown()` on each token event. Marked is fast enough for this (<1ms for typical message sizes). The HTML is set via `{@html}` with a `chat-markdown` wrapper class.

### 3. Streaming Integration (Both Chat Components)

**Pattern (shared between desktop ProjectChats.svelte and mobile +page.svelte):**

Replace the current `fetch('/api/.../chat', { method: 'POST' })` with:

```typescript
async function sendCurrentMessage() {
	// ... existing optimistic user message append ...

	// Create placeholder assistant message with empty content
	const assistantMsg: Message = {
		id: `tmp-assistant-${Date.now()}`,
		conversationId: threadId,
		role: 'assistant',
		content: '',
		createdAt: new Date().toISOString()
	};
	messages = [...messages, assistantMsg];
	streamingMessageId = assistantMsg.id;

	try {
		const response = await fetch(`/api/projects/${slug}/threads/${threadId}/chat/stream`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ message: draft })
		});

		if (!response.ok) {
			// Fallback to atomic endpoint
			return await sendCurrentMessageAtomic();
		}

		const reader = response.body!.getReader();
		const decoder = new TextDecoder();
		let buffer = '';
		let fullText = '';

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });

			// Parse SSE events from buffer
			const events = parseSSEEvents(buffer);
			buffer = events.remainder;

			for (const evt of events.parsed) {
				if (evt.event === 'token') {
					fullText += evt.data.text;
					// Update the streaming message's content reactively
					updateStreamingMessage(fullText);
				} else if (evt.event === 'done') {
					fullText = evt.data.fullText;
					updateStreamingMessage(fullText);
					// Reconcile with real message ID
				} else if (evt.event === 'error') {
					throw new Error(evt.data.message);
				}
			}
		}
	} catch (err) {
		// ... existing error handling ...
	} finally {
		streamingMessageId = null;
	}
}
```

### 4. Message Rendering (Markdown)

Replace plain text rendering in both components:

**Before:**

```svelte
<p class="text-sm whitespace-pre-wrap break-words">{message.content}</p>
```

**After:**

```svelte
{#if message.role === 'assistant'}
	<div class="chat-markdown prose prose-sm prose-invert max-w-none">
		{@html renderChatMarkdown(message.content)}
		{#if streamingMessageId === message.id}
			<span class="typing-cursor">|</span>
		{/if}
	</div>
{:else}
	<p class="text-sm whitespace-pre-wrap break-words">{message.content}</p>
{/if}
```

User messages stay plain text (they don't contain markdown). Assistant messages get full markdown rendering. The typing cursor appears only on the actively streaming message.

### 5. Auto-Scroll (Desktop)

Add the same auto-scroll logic that mobile already has to ProjectChats.svelte:

- Track `isScrolledToBottom` (within 150px of bottom)
- On new content (token events): if scrolled to bottom, auto-scroll
- If scrolled up: show "New messages" pill
- Pill click: smooth scroll to bottom

The mobile implementation (lines 121-155 of +page.svelte) is the reference. Port it to the desktop chat rail in ProjectChats.svelte.

### 6. Mobile Composer Fix — Layout Bug

**Problem:** The mobile chat page sets `h-[100dvh]` but is nested inside the layout's `<main class="flex-1 overflow-y-auto pb-16">`. The composer renders below the visible viewport — user must scroll to see it.

**Fix in `+layout.svelte`:**

Add a conditional class to remove the scrollable + padded layout when on a chat thread page:

```svelte
<script>
	import { page } from '$app/stores';
	// Detect if we're on a mobile chat thread page
	$: isChatThread = $page.url.pathname.match(/\/projects\/[^/]+\/chats\/[^/]+$/);
</script>

<main class={isChatThread ? 'flex-1' : 'flex-1 overflow-y-auto pb-16 lg:pb-0'}>
	{@render children()}
</main>
```

When on a chat thread, the `<main>` becomes a plain flex child with no overflow or padding. The chat page's own `h-[100dvh]` flex column handles all scrolling internally. The tab bar is still fixed at the bottom (positioned by MobileTabBar's own `fixed bottom-0` class).

**Alternative approach** (if the above causes issues with desktop):

```svelte
<main class="flex-1 overflow-y-auto pb-16 lg:pb-0 [&:has([data-chat-thread])]:overflow-visible [&:has([data-chat-thread])]:pb-0">
```

Uses CSS `:has()` selector to conditionally remove overflow when a chat thread element is present. Supported in all modern browsers (Safari 15.4+, Chrome 105+).

### 7. Rename Decoupled from Promote

**Current behavior (threads PATCH route):**

```typescript
// Renaming auto-sets isEphemeral to false
body: { title: newTitle, isEphemeral: false }
```

**New behavior:**
The PATCH endpoint accepts `title` and `isEphemeral` independently. Frontend only sends what changed:

- Rename: `{ title: newTitle }` — ephemeral status unchanged
- Promote: `{ isEphemeral: false }` — title unchanged
- Both: `{ title: newTitle, isEphemeral: false }` — explicit user action

**Files:**

- `src/routes/api/projects/[slug]/threads/[id]/+server.ts` — PATCH handler only sends fields that were in the request body
- `src/lib/components/ProjectChats.svelte` — `commitRename()` sends only `{ title }`
- `src/routes/projects/[slug]/chats/[threadId]/+page.svelte` — same rename change

### CSS: Chat Markdown Styles

Add to `src/app.css`:

```css
/* Chat markdown rendering */
.chat-markdown {
	font-size: 0.875rem;
	line-height: 1.625;
}

.chat-markdown p {
	margin-bottom: 0.5em;
}

.chat-markdown p:last-child {
	margin-bottom: 0;
}

.chat-markdown ul,
.chat-markdown ol {
	padding-left: 1.25em;
	margin-bottom: 0.5em;
}

.chat-markdown code:not(pre code) {
	background: hsl(var(--muted));
	padding: 0.125em 0.375em;
	border-radius: 0.25rem;
	font-size: 0.8125rem;
	font-family: var(--font-mono);
}

.chat-code-block {
	background: hsl(var(--muted));
	border: 1px solid hsl(var(--border));
	border-radius: 0.5rem;
	padding: 0.75rem 1rem;
	overflow-x: auto;
	margin: 0.5em 0;
	font-size: 0.8125rem;
	line-height: 1.5;
	font-family: var(--font-mono);
}

.chat-code-block code {
	background: none;
	padding: 0;
}

/* Typing cursor */
.typing-cursor {
	display: inline;
	animation: blink 1s step-end infinite;
	color: hsl(var(--primary));
	font-weight: bold;
}

@keyframes blink {
	0%,
	100% {
		opacity: 1;
	}
	50% {
		opacity: 0;
	}
}

@media (prefers-reduced-motion: reduce) {
	.typing-cursor {
		animation: none;
		opacity: 0.7;
	}
}
```

---

## Acceptance Criteria — PR 2 (Oracle App)

### Streaming

- AC-F1: Chat messages stream token-by-token via SSE (not atomic wait)
- AC-F2: Blinking typing cursor visible at end of streaming message
- AC-F3: Cursor disappears when streaming completes
- AC-F4: If SSE connection fails, falls back to atomic POST /api/chat
- AC-F5: User message appears immediately (optimistic, same as now)
- AC-F6: Streaming works on both desktop and mobile chat views

### Markdown

- AC-F7: Assistant messages render with markdown (bold, italic, lists, headers, links)
- AC-F8: Code blocks render with monospace font, background, and border
- AC-F9: Inline code renders with background highlight
- AC-F10: User messages remain plain text (no markdown rendering)
- AC-F11: Markdown renders progressively during streaming (not only after complete)

### Auto-Scroll

- AC-F12: Desktop chat auto-scrolls on new content when user is near bottom (150px threshold)
- AC-F13: Desktop chat shows "New messages" pill when user is scrolled up and new content arrives
- AC-F14: Pill click smooth-scrolls to bottom
- AC-F15: Mobile auto-scroll behavior unchanged (already working)

### Mobile Composer Fix

- AC-F16: Mobile chat composer is pinned to bottom of visible viewport on load
- AC-F17: Composer stays visible without scrolling on any mobile viewport (375px+)
- AC-F18: Tab bar remains visible below composer

### Rename Decoupled from Promote

- AC-F19: Renaming a thread does NOT change its ephemeral status
- AC-F20: Promoting a thread is a separate action from renaming
- AC-F21: Existing promote button/action still works (sets isEphemeral: false)

### Non-Regression

- AC-F22: Desktop two-panel layout unchanged
- AC-F23: Thread create/delete/list still works
- AC-F24: Optimistic UI + background reconciliation still works
- AC-F25: Retry logic for transient errors still works
- AC-F26: iOS keyboard handling (visualViewport) unchanged

---

## UX Decisions Locked

| #   | Decision                                                       | Rationale                                                     |
| --- | -------------------------------------------------------------- | ------------------------------------------------------------- |
| Q1  | New `POST /api/chat/stream` endpoint (not modify existing)     | Clean separation, atomic stays for backwards compat           |
| Q2  | Full markdown + syntax highlighting (CSS-only for code blocks) | Marked on client, no Shiki WASM. Shiki as future enhancement. |
| Q3  | Desktop gets same auto-scroll + pill as mobile                 | Consistency, essential for streaming UX                       |
| Q4  | Rename decoupled from promote                                  | Prevents accidental persistence of throwaway threads          |
| Q5  | Token-by-token with typing cursor                              | Professional AI chat feel, like Claude.ai                     |
| Q6  | Two PRs: backend first, then frontend                          | Independent testing, clear blame if issues                    |
| Q7  | Mobile composer pinned via layout conditional                  | Fix the `overflow-y-auto pb-16` nesting bug                   |

## Testing

### Unit Tests (Vitest)

- SSE event parser function
- Chat markdown renderer (input → expected HTML)
- Auto-scroll threshold logic

### Integration Tests

- SSE proxy route returns event-stream content type
- Fallback to atomic on SSE failure
- Rename sends only title (not isEphemeral)

### Manual Verification

- Stream a response on mobile Safari — tokens appear progressively
- Stream a response on desktop Chrome — same behavior
- Send a message with code block — renders with monospace styling
- Scroll up during stream — pill appears, auto-scroll stops
- Rename an ephemeral thread — confirm it stays ephemeral
- Open mobile chat fresh — composer visible without scrolling
