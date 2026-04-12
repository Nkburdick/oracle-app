/**
 * Pennyworth HTTP client — server-only.
 *
 * Wraps the 6 Pennyworth endpoints listed in Phase 2.B Minimal Chat PRD §3.
 * Lives under `$lib/server/` so SvelteKit's build pipeline enforces it can
 * never be imported from client code (the secret-free posture is still
 * preserved per PRD §7).
 *
 * All functions take an explicit `baseUrl` so they can be unit-tested with a
 * mocked `fetch`. Production callers read `PENNYWORTH_BASE_URL` from env via
 * `getPennyworthBaseUrl()` below.
 *
 * Error handling: each function throws on non-2xx with a descriptive message.
 * Loaders / API routes catch these and translate to user-facing error states
 * per PRD §6.
 */

import type {
	Thread,
	Message,
	CreateThreadBody,
	PatchThreadBody,
	SendMessageBody,
	SendMessageResponse
} from '$lib/types/chat.js';

// ─── env / base URL ──────────────────────────────────────────────────────────

/**
 * Read `PENNYWORTH_BASE_URL` from process.env. Throws if unset — the loader
 * catches this and returns a `chat.error` so the rest of the project page
 * still renders (PRD §6.7, AC-33).
 */
export function getPennyworthBaseUrl(): string {
	const url = process.env.PENNYWORTH_BASE_URL;
	if (!url || url.trim() === '') {
		throw new Error('PENNYWORTH_BASE_URL is not set — Pennyworth chat backend is unconfigured');
	}
	// Strip trailing slash so callers can do `${baseUrl}/api/...` without
	// worrying about double slashes.
	return url.replace(/\/$/, '');
}

/**
 * Read `PENNYWORTH_API_TOKEN` from process.env. Pennyworth's `/api/*` endpoints
 * are gated by Bearer auth (`AOL_API_TOKEN` on the Pennyworth side — same
 * value, different env var name on the consumer end). Throws if unset.
 *
 * Discovered live during the 2026-04-07 smoke test: cross-container reach to
 * `pennyworth:3001/api/health` works without auth (health is public), but
 * `/api/conversations` returns 401 without a Bearer token. The Oracle App
 * MUST send the token on every Pennyworth call.
 */
export function getPennyworthApiToken(): string {
	const token = process.env.PENNYWORTH_API_TOKEN;
	if (!token || token.trim() === '') {
		throw new Error(
			'PENNYWORTH_API_TOKEN is not set — Pennyworth chat backend rejects unauthenticated requests'
		);
	}
	return token;
}

// ─── shared fetch helper ─────────────────────────────────────────────────────

/**
 * Wrapper around `fetch` that throws on non-2xx with a descriptive message
 * including the response body. Adds the `Authorization: Bearer <token>`
 * header to every request. All 4xx/5xx errors get the same shape so the
 * loader can `catch (e) { ... }` once.
 */
async function pennyworthFetch(url: string, init?: RequestInit): Promise<Response> {
	const token = getPennyworthApiToken();
	const res = await fetch(url, {
		...init,
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`,
			...(init?.headers ?? {})
		},
		// 10s timeout — Pennyworth is local docker network, this is generous
		signal: init?.signal ?? AbortSignal.timeout(10_000)
	});

	if (!res.ok) {
		// Try to get a JSON error body, fall back to text
		// eslint-disable-next-line no-useless-assignment -- used in the error message below
		let bodyText = '';
		try {
			bodyText = await res.text();
		} catch {
			bodyText = '<unreadable response body>';
		}
		throw new Error(`Pennyworth ${res.status} ${res.statusText}: ${bodyText}`);
	}

	return res;
}

// ─── 1. List threads for a project ──────────────────────────────────────────

/**
 * GET /api/conversations?oracle_slug={slug}&include_ephemeral=true
 *
 * Returns ALL threads (persistent + throwaway) for a project, sorted by
 * `updatedAt DESC` server-side. Per Q2 = (b) we always pass
 * `include_ephemeral=true` because the Chats tab shows both types.
 */
export async function listThreads(
	baseUrl: string,
	oracleSlug: string,
	options: { includeEphemeral?: boolean } = {}
): Promise<Thread[]> {
	const includeEphemeral = options.includeEphemeral ?? true;
	const params = new URLSearchParams({
		oracle_slug: oracleSlug,
		include_ephemeral: String(includeEphemeral)
	});
	const res = await pennyworthFetch(`${baseUrl}/api/conversations?${params}`);
	const data = (await res.json()) as { conversations: Thread[] };
	return data.conversations;
}

// ─── 2. Load message history for a thread ───────────────────────────────────

/**
 * GET /api/conversations/{id}/messages
 *
 * Returns all messages for a thread, oldest-first. 404 from Pennyworth
 * surfaces as a thrown Error here.
 */
export async function getMessages(baseUrl: string, threadId: string): Promise<Message[]> {
	const res = await pennyworthFetch(
		`${baseUrl}/api/conversations/${encodeURIComponent(threadId)}/messages`
	);
	const data = (await res.json()) as { messages: Message[] };
	return data.messages;
}

// ─── 3. Create a new thread ─────────────────────────────────────────────────

/**
 * POST /api/conversations
 *
 * Creates a new thread (always throwaway from the Oracle App per Q1 = a).
 * Title is generated client-side as `"Quick chat HH:MM"` and passed in.
 */
export async function createThread(baseUrl: string, body: CreateThreadBody): Promise<Thread> {
	const res = await pennyworthFetch(`${baseUrl}/api/conversations`, {
		method: 'POST',
		body: JSON.stringify(body)
	});
	const data = (await res.json()) as { conversation: Thread };
	return data.conversation;
}

// ─── 4. Send a message ──────────────────────────────────────────────────────

/**
 * POST /api/chat
 *
 * Single round-trip — Pennyworth's response includes the full assistant
 * reply. SSE streaming is deferred to 2.B.1 (PRD §2.2 O1).
 */
export async function sendMessage(
	baseUrl: string,
	body: SendMessageBody
): Promise<SendMessageResponse> {
	const res = await pennyworthFetch(`${baseUrl}/api/chat`, {
		method: 'POST',
		body: JSON.stringify(body),
		// Bumped from 10s — chat involves an LLM round-trip, can take a few seconds
		signal: AbortSignal.timeout(60_000)
	});
	return (await res.json()) as SendMessageResponse;
}

// ─── 5. Delete a thread ─────────────────────────────────────────────────────

/**
 * DELETE /api/conversations/{id}
 *
 * Cascades to messages on Pennyworth via the FK constraint. Returns the
 * deleted thread ID for confirmation.
 */
export async function deleteThread(baseUrl: string, threadId: string): Promise<string> {
	const res = await pennyworthFetch(
		`${baseUrl}/api/conversations/${encodeURIComponent(threadId)}`,
		{ method: 'DELETE' }
	);
	const data = (await res.json()) as { deleted: string };
	return data.deleted;
}

// ─── 6. Patch a thread (rename / promote) ───────────────────────────────────

/**
 * PATCH /api/conversations/{id}
 *
 * Used for two paths per PRD §4.4:
 * - **Rename → auto-promote:** `{ title: <new>, isEphemeral: false }` in one call
 * - **Star toggle (keep auto-name):** `{ isEphemeral: false }` only
 *
 * At least one of `title` / `isEphemeral` must be present (Pennyworth returns
 * 400 on a no-op PATCH).
 */
export async function patchThread(
	baseUrl: string,
	threadId: string,
	body: PatchThreadBody
): Promise<Thread> {
	const res = await pennyworthFetch(
		`${baseUrl}/api/conversations/${encodeURIComponent(threadId)}`,
		{
			method: 'PATCH',
			body: JSON.stringify(body)
		}
	);
	const data = (await res.json()) as { conversation: Thread };
	return data.conversation;
}
