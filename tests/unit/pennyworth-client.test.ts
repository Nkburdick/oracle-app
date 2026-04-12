/**
 * Unit tests for $lib/server/pennyworth-client.ts
 *
 * Phase 2.B Minimal Chat — AC-37: ≥1 test per pennyworth-client function with
 * a mocked global.fetch. Same vi.spyOn pattern as Pennyworth's
 * `oracle-writer.test.ts` (PR #33).
 *
 * What's covered (PR 1 = read path build):
 *   - getPennyworthBaseUrl() — env var read + missing-env error
 *   - listThreads — happy path, query params, error propagation
 *   - getMessages — happy path, error propagation
 *   - createThread — POST body shape, returns Thread
 *   - sendMessage — POST body shape, returns SendMessageResponse
 *   - deleteThread — DELETE call, returns deleted ID
 *   - patchThread — PATCH body shape, returns updated Thread
 *
 * Mutation functions (createThread, sendMessage, deleteThread, patchThread)
 * are tested here even though they're not yet wired into the UI in PR 1 — we
 * want full coverage in place when PR 2 wires them up.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	getPennyworthBaseUrl,
	getPennyworthApiToken,
	listThreads,
	getMessages,
	createThread,
	sendMessage,
	deleteThread,
	patchThread
} from '../../src/lib/server/pennyworth-client.js';
import type { Thread, Message, SendMessageResponse } from '../../src/lib/types/chat.js';

// ─── helpers ─────────────────────────────────────────────────────────────────

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

function textResponse(status: number, statusText: string, body = ''): Response {
	return new Response(body, { status, statusText });
}

const SAMPLE_THREAD: Thread = {
	id: 'abc123',
	title: 'push notification research',
	oracleSlug: 'stridemind-ai',
	isEphemeral: false,
	createdAt: '2026-04-05T12:34:56.000Z',
	updatedAt: '2026-04-07T09:11:22.000Z'
};

const SAMPLE_MESSAGE: Message = {
	id: 'm1',
	conversationId: 'abc123',
	role: 'assistant',
	content: 'Hi Nick — what should we tackle today?',
	createdAt: '2026-04-07T10:00:00.000Z'
};

const SAMPLE_BASE_URL = 'http://pennyworth:3000';

// ─── shared setup ────────────────────────────────────────────────────────────

let fetchSpy: ReturnType<typeof vi.spyOn>;
const ORIGINAL_BASE_URL = process.env.PENNYWORTH_BASE_URL;
const ORIGINAL_API_TOKEN = process.env.PENNYWORTH_API_TOKEN;
const SAMPLE_API_TOKEN = 'test-token-xyz';

beforeEach(() => {
	process.env.PENNYWORTH_BASE_URL = SAMPLE_BASE_URL;
	process.env.PENNYWORTH_API_TOKEN = SAMPLE_API_TOKEN;
	fetchSpy = vi.spyOn(global, 'fetch');
});

afterEach(() => {
	fetchSpy.mockRestore();
	if (ORIGINAL_BASE_URL === undefined) {
		delete process.env.PENNYWORTH_BASE_URL;
	} else {
		process.env.PENNYWORTH_BASE_URL = ORIGINAL_BASE_URL;
	}
	if (ORIGINAL_API_TOKEN === undefined) {
		delete process.env.PENNYWORTH_API_TOKEN;
	} else {
		process.env.PENNYWORTH_API_TOKEN = ORIGINAL_API_TOKEN;
	}
});

// ─── getPennyworthBaseUrl ────────────────────────────────────────────────────

describe('getPennyworthBaseUrl', () => {
	test('returns the env var value', () => {
		expect(getPennyworthBaseUrl()).toBe(SAMPLE_BASE_URL);
	});

	test('strips trailing slash', () => {
		process.env.PENNYWORTH_BASE_URL = 'http://pennyworth:3001/';
		expect(getPennyworthBaseUrl()).toBe('http://pennyworth:3001');
	});

	test('throws when env var is missing', () => {
		delete process.env.PENNYWORTH_BASE_URL;
		expect(() => getPennyworthBaseUrl()).toThrow(/PENNYWORTH_BASE_URL is not set/);
	});

	test('throws when env var is empty string', () => {
		process.env.PENNYWORTH_BASE_URL = '   ';
		expect(() => getPennyworthBaseUrl()).toThrow(/PENNYWORTH_BASE_URL is not set/);
	});
});

describe('getPennyworthApiToken', () => {
	test('returns the env var value', () => {
		expect(getPennyworthApiToken()).toBe(SAMPLE_API_TOKEN);
	});

	test('throws when env var is missing', () => {
		delete process.env.PENNYWORTH_API_TOKEN;
		expect(() => getPennyworthApiToken()).toThrow(/PENNYWORTH_API_TOKEN is not set/);
	});
});

describe('Authorization header', () => {
	test('every Pennyworth call sends Bearer token in Authorization header', async () => {
		fetchSpy.mockResolvedValueOnce(jsonResponse(200, { conversations: [] }));

		await listThreads(SAMPLE_BASE_URL, 'stridemind-ai');

		const init = fetchSpy.mock.calls[0][1] as RequestInit;
		const headers = init.headers as Record<string, string>;
		expect(headers.Authorization).toBe(`Bearer ${SAMPLE_API_TOKEN}`);
	});

	test('throws BEFORE making fetch call when token is missing', async () => {
		delete process.env.PENNYWORTH_API_TOKEN;

		await expect(listThreads(SAMPLE_BASE_URL, 'stridemind-ai')).rejects.toThrow(
			/PENNYWORTH_API_TOKEN is not set/
		);
		expect(fetchSpy).not.toHaveBeenCalled();
	});
});

// ─── listThreads ─────────────────────────────────────────────────────────────

describe('listThreads', () => {
	test('returns array of threads on 200', async () => {
		fetchSpy.mockResolvedValueOnce(jsonResponse(200, { conversations: [SAMPLE_THREAD] }));

		const threads = await listThreads(SAMPLE_BASE_URL, 'stridemind-ai');

		expect(threads).toHaveLength(1);
		expect(threads[0]).toEqual(SAMPLE_THREAD);
		expect(fetchSpy).toHaveBeenCalledTimes(1);
	});

	test('passes oracle_slug AND include_ephemeral=true by default (Q2 = b)', async () => {
		fetchSpy.mockResolvedValueOnce(jsonResponse(200, { conversations: [] }));

		await listThreads(SAMPLE_BASE_URL, 'stridemind-ai');

		const url = fetchSpy.mock.calls[0][0] as string;
		expect(url).toContain('oracle_slug=stridemind-ai');
		expect(url).toContain('include_ephemeral=true');
	});

	test('respects includeEphemeral=false override', async () => {
		fetchSpy.mockResolvedValueOnce(jsonResponse(200, { conversations: [] }));

		await listThreads(SAMPLE_BASE_URL, 'stridemind-ai', { includeEphemeral: false });

		const url = fetchSpy.mock.calls[0][0] as string;
		expect(url).toContain('include_ephemeral=false');
	});

	test('throws on non-2xx with descriptive message', async () => {
		fetchSpy.mockResolvedValueOnce(textResponse(500, 'Internal Server Error', '{"error":"oops"}'));

		await expect(listThreads(SAMPLE_BASE_URL, 'stridemind-ai')).rejects.toThrow(/Pennyworth 500/);
	});

	test('returns empty array when Pennyworth has no threads', async () => {
		fetchSpy.mockResolvedValueOnce(jsonResponse(200, { conversations: [] }));

		const threads = await listThreads(SAMPLE_BASE_URL, 'stridemind-ai');
		expect(threads).toEqual([]);
	});
});

// ─── getMessages ─────────────────────────────────────────────────────────────

describe('getMessages', () => {
	test('returns array of messages on 200', async () => {
		fetchSpy.mockResolvedValueOnce(jsonResponse(200, { messages: [SAMPLE_MESSAGE] }));

		const messages = await getMessages(SAMPLE_BASE_URL, 'abc123');

		expect(messages).toHaveLength(1);
		expect(messages[0]).toEqual(SAMPLE_MESSAGE);
	});

	test('URL-encodes the thread ID', async () => {
		fetchSpy.mockResolvedValueOnce(jsonResponse(200, { messages: [] }));

		await getMessages(SAMPLE_BASE_URL, 'abc/123 with spaces');

		const url = fetchSpy.mock.calls[0][0] as string;
		expect(url).toContain('abc%2F123%20with%20spaces');
	});

	test('throws on 404 with Pennyworth error in message', async () => {
		fetchSpy.mockResolvedValueOnce(textResponse(404, 'Not Found', 'Conversation not found'));

		await expect(getMessages(SAMPLE_BASE_URL, 'missing')).rejects.toThrow(/Pennyworth 404/);
	});
});

// ─── createThread ────────────────────────────────────────────────────────────

describe('createThread', () => {
	test('POSTs the body and returns the created thread', async () => {
		fetchSpy.mockResolvedValueOnce(jsonResponse(201, { conversation: SAMPLE_THREAD }));

		const result = await createThread(SAMPLE_BASE_URL, {
			title: 'Quick chat 13:42',
			oracleSlug: 'stridemind-ai',
			isEphemeral: true
		});

		expect(result).toEqual(SAMPLE_THREAD);
		const init = fetchSpy.mock.calls[0][1] as RequestInit;
		expect(init.method).toBe('POST');
		const body = JSON.parse(init.body as string) as Record<string, unknown>;
		expect(body.title).toBe('Quick chat 13:42');
		expect(body.oracleSlug).toBe('stridemind-ai');
		expect(body.isEphemeral).toBe(true);
	});

	test('sets Content-Type: application/json', async () => {
		fetchSpy.mockResolvedValueOnce(jsonResponse(201, { conversation: SAMPLE_THREAD }));

		await createThread(SAMPLE_BASE_URL, { title: 'X', oracleSlug: 'y', isEphemeral: true });

		const init = fetchSpy.mock.calls[0][1] as RequestInit;
		const headers = init.headers as Record<string, string>;
		expect(headers['Content-Type']).toBe('application/json');
	});
});

// ─── sendMessage ─────────────────────────────────────────────────────────────

describe('sendMessage', () => {
	test('POSTs to /api/chat with the body and returns the response', async () => {
		const apiResponse: SendMessageResponse = {
			response: 'Hey Nick!',
			conversationId: 'abc123',
			artifacts: { driveLinks: null }
		};
		fetchSpy.mockResolvedValueOnce(jsonResponse(200, apiResponse));

		const result = await sendMessage(SAMPLE_BASE_URL, {
			message: 'hi',
			conversationId: 'abc123',
			oracleSlug: 'stridemind-ai'
		});

		expect(result).toEqual(apiResponse);
		const url = fetchSpy.mock.calls[0][0] as string;
		expect(url).toBe(`${SAMPLE_BASE_URL}/api/chat`);
		const init = fetchSpy.mock.calls[0][1] as RequestInit;
		expect(init.method).toBe('POST');
		const body = JSON.parse(init.body as string) as Record<string, unknown>;
		expect(body.message).toBe('hi');
		expect(body.conversationId).toBe('abc123');
	});

	test('throws on 429 rate limit', async () => {
		fetchSpy.mockResolvedValueOnce(jsonResponse(429, { error: 'Rate limited' }));

		await expect(
			sendMessage(SAMPLE_BASE_URL, { message: 'hi', conversationId: 'abc' })
		).rejects.toThrow(/Pennyworth 429/);
	});
});

// ─── deleteThread ────────────────────────────────────────────────────────────

describe('deleteThread', () => {
	test('DELETEs the thread and returns the deleted ID', async () => {
		fetchSpy.mockResolvedValueOnce(jsonResponse(200, { deleted: 'abc123' }));

		const id = await deleteThread(SAMPLE_BASE_URL, 'abc123');

		expect(id).toBe('abc123');
		const init = fetchSpy.mock.calls[0][1] as RequestInit;
		expect(init.method).toBe('DELETE');
	});

	test('throws on 404 (thread does not exist)', async () => {
		fetchSpy.mockResolvedValueOnce(textResponse(404, 'Not Found', 'Conversation not found'));

		await expect(deleteThread(SAMPLE_BASE_URL, 'missing')).rejects.toThrow(/Pennyworth 404/);
	});
});

// ─── patchThread ─────────────────────────────────────────────────────────────

describe('patchThread', () => {
	test('PATCHes title + isEphemeral together (rename → auto-promote path)', async () => {
		const updated: Thread = { ...SAMPLE_THREAD, title: 'renamed', isEphemeral: false };
		fetchSpy.mockResolvedValueOnce(jsonResponse(200, { conversation: updated }));

		const result = await patchThread(SAMPLE_BASE_URL, 'abc123', {
			title: 'renamed',
			isEphemeral: false
		});

		expect(result).toEqual(updated);
		const init = fetchSpy.mock.calls[0][1] as RequestInit;
		expect(init.method).toBe('PATCH');
		const body = JSON.parse(init.body as string) as Record<string, unknown>;
		expect(body.title).toBe('renamed');
		expect(body.isEphemeral).toBe(false);
	});

	test('PATCHes isEphemeral only (★ toggle path)', async () => {
		const updated: Thread = { ...SAMPLE_THREAD, isEphemeral: false };
		fetchSpy.mockResolvedValueOnce(jsonResponse(200, { conversation: updated }));

		await patchThread(SAMPLE_BASE_URL, 'abc123', { isEphemeral: false });

		const init = fetchSpy.mock.calls[0][1] as RequestInit;
		const body = JSON.parse(init.body as string) as Record<string, unknown>;
		expect(body.isEphemeral).toBe(false);
		expect(body.title).toBeUndefined();
	});

	test('throws on 400 (no-op patch)', async () => {
		fetchSpy.mockResolvedValueOnce(jsonResponse(400, { error: 'No fields to update' }));

		await expect(patchThread(SAMPLE_BASE_URL, 'abc123', {})).rejects.toThrow(/Pennyworth 400/);
	});
});
