// @vitest-environment jsdom
/**
 * Component tests for ProjectChats.svelte
 *
 * Phase 2.B Minimal Chat — AC-38: ≥1 component test for ProjectChats covering
 * the empty / loaded / error states of the thread rail.
 *
 * Uses @testing-library/svelte. Mocks `global.fetch` for any client-initiated
 * loads (thread switching, mutations) — the SSR-seeded read paths render
 * directly from props.
 *
 * What's covered:
 *   - Empty state: 0 threads, no error → "No threads yet" message
 *   - Error state: loaderError prop set → error UI with details
 *   - Loaded state: ≥1 thread → list renders with glyphs + auto-selects first
 *   - Thread visibility (Q2 = b): persistent and throwaway both render
 *   - Glyph correctness: ★ for persistent, · for throwaway
 *   - First-paint: when initialMessages is non-empty, no spinner shown
 *
 * Out of scope (in this file): mutation flow tests (create / send / delete /
 * promote) — those involve fetch mocking + async state assertions and would
 * roughly double the file. The 21 pennyworth-client unit tests already cover
 * the network surface for those mutations; this file covers the rendering
 * surface for the read path per AC-38.
 */

import { describe, test, expect, afterEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/svelte';
import ProjectChats from './ProjectChats.svelte';
import type { Thread, Message } from '$lib/types/chat.js';

afterEach(() => {
	cleanup();
});

const SAMPLE_PERSISTENT: Thread = {
	id: 'thread-1',
	title: 'push notification research',
	oracleSlug: 'stridemind-ai',
	isEphemeral: false,
	createdAt: '2026-04-05T12:00:00.000Z',
	updatedAt: '2026-04-07T09:00:00.000Z'
};

const SAMPLE_THROWAWAY: Thread = {
	id: 'thread-2',
	title: 'Quick chat 13:42',
	oracleSlug: 'stridemind-ai',
	isEphemeral: true,
	createdAt: '2026-04-07T13:42:00.000Z',
	updatedAt: '2026-04-07T13:42:00.000Z'
};

const SAMPLE_MESSAGE_USER: Message = {
	id: 'msg-1',
	conversationId: 'thread-1',
	role: 'user',
	content: 'How does iOS push subscription expiry work?',
	createdAt: '2026-04-07T13:42:00.000Z'
};

const SAMPLE_MESSAGE_ASSISTANT: Message = {
	id: 'msg-2',
	conversationId: 'thread-1',
	role: 'assistant',
	content: 'iOS 18.4 sets a 30-day expiry on new subscriptions...',
	createdAt: '2026-04-07T13:43:00.000Z'
};

// ─── empty state (PRD §6.1) ──────────────────────────────────────────────────

describe('ProjectChats — empty state', () => {
	test('renders "No threads yet" when initialThreads is empty and no error', () => {
		render(ProjectChats, {
			props: {
				slug: 'stridemind-ai',
				initialThreads: [],
				initialMessages: [],
				loaderError: null
			}
		});

		expect(screen.getByTestId('threads-empty')).toHaveTextContent(/no threads yet/i);
	});

	test('right pane shows the start-a-thread CTA when list is empty', () => {
		render(ProjectChats, {
			props: {
				slug: 'stridemind-ai',
				initialThreads: [],
				initialMessages: [],
				loaderError: null
			}
		});

		const messagesPane = screen.getByTestId('messages-pane');
		expect(messagesPane).toHaveTextContent(/start a thread by tapping/i);
	});

	test('[+ New] button is enabled in empty state', () => {
		render(ProjectChats, {
			props: {
				slug: 'stridemind-ai',
				initialThreads: [],
				initialMessages: [],
				loaderError: null
			}
		});

		const button = screen.getByTestId('new-thread-button');
		expect(button).not.toBeDisabled();
	});
});

// ─── error state (PRD §6.1) ──────────────────────────────────────────────────

describe('ProjectChats — error state', () => {
	test('renders "Couldn\'t load threads" when loaderError is set', () => {
		render(ProjectChats, {
			props: {
				slug: 'stridemind-ai',
				initialThreads: [],
				initialMessages: [],
				loaderError: 'PENNYWORTH_BASE_URL is not set'
			}
		});

		const errorEl = screen.getByTestId('threads-error');
		expect(errorEl).toHaveTextContent(/couldn't load threads/i);
		expect(errorEl).toHaveTextContent(/pennyworth_base_url is not set/i);
	});

	test('error state takes precedence over empty state', () => {
		render(ProjectChats, {
			props: {
				slug: 'stridemind-ai',
				initialThreads: [],
				initialMessages: [],
				loaderError: 'fetch failed'
			}
		});

		expect(screen.getByTestId('threads-error')).toBeInTheDocument();
		expect(screen.queryByTestId('threads-empty')).not.toBeInTheDocument();
	});
});

// ─── loaded state (PRD §6.1) ─────────────────────────────────────────────────

describe('ProjectChats — loaded state', () => {
	test('renders all threads from the loader (Q2 = b: persistent + throwaway both)', () => {
		render(ProjectChats, {
			props: {
				slug: 'stridemind-ai',
				initialThreads: [SAMPLE_PERSISTENT, SAMPLE_THROWAWAY],
				initialMessages: [SAMPLE_MESSAGE_USER, SAMPLE_MESSAGE_ASSISTANT],
				loaderError: null
			}
		});

		const list = screen.getByTestId('threads-list');
		expect(list).toBeInTheDocument();

		const rows = screen.getAllByTestId('thread-row');
		expect(rows).toHaveLength(2);

		// Both titles render
		expect(list).toHaveTextContent('push notification research');
		expect(list).toHaveTextContent('Quick chat 13:42');
	});

	test('persistent thread renders with ★ glyph; throwaway with · glyph', () => {
		render(ProjectChats, {
			props: {
				slug: 'stridemind-ai',
				initialThreads: [SAMPLE_PERSISTENT, SAMPLE_THROWAWAY],
				initialMessages: [],
				loaderError: null
			}
		});

		const rows = screen.getAllByTestId('thread-row');
		// First row = persistent (push notification research)
		expect(rows[0]).toHaveTextContent('★');
		// Second row = throwaway (Quick chat 13:42)
		expect(rows[1]).toHaveTextContent('·');
	});

	test('most-recent thread is auto-selected (Q8 = a) — has data-active=true', () => {
		render(ProjectChats, {
			props: {
				slug: 'stridemind-ai',
				initialThreads: [SAMPLE_PERSISTENT, SAMPLE_THROWAWAY],
				initialMessages: [SAMPLE_MESSAGE_USER],
				loaderError: null
			}
		});

		const rows = screen.getAllByTestId('thread-row');
		expect(rows[0].dataset.active).toBe('true');
		expect(rows[1].dataset.active).toBe('false');
	});

	test('initialMessages render in the right pane on first paint (no spinner)', () => {
		render(ProjectChats, {
			props: {
				slug: 'stridemind-ai',
				initialThreads: [SAMPLE_PERSISTENT],
				initialMessages: [SAMPLE_MESSAGE_USER, SAMPLE_MESSAGE_ASSISTANT],
				loaderError: null
			}
		});

		const messagesList = screen.getByTestId('messages-list');
		expect(messagesList).toBeInTheDocument();
		expect(messagesList).toHaveTextContent(/how does ios push subscription/i);
		expect(messagesList).toHaveTextContent(/30-day expiry/);

		// Critical: no loading spinner on first paint when SSR has data
		expect(screen.queryByTestId('messages-loading')).not.toBeInTheDocument();
	});

	test('user and assistant messages have correct data-role attributes', () => {
		render(ProjectChats, {
			props: {
				slug: 'stridemind-ai',
				initialThreads: [SAMPLE_PERSISTENT],
				initialMessages: [SAMPLE_MESSAGE_USER, SAMPLE_MESSAGE_ASSISTANT],
				loaderError: null
			}
		});

		const messages = screen.getAllByTestId('message');
		expect(messages).toHaveLength(2);
		expect(messages[0].dataset.role).toBe('user');
		expect(messages[1].dataset.role).toBe('assistant');
	});

	test('empty thread (selected but no messages) shows "Say hi to Pennyworth"', () => {
		render(ProjectChats, {
			props: {
				slug: 'stridemind-ai',
				initialThreads: [SAMPLE_PERSISTENT],
				initialMessages: [],
				loaderError: null
			}
		});

		expect(screen.getByTestId('messages-empty')).toHaveTextContent(/say hi to pennyworth/i);
	});

	test('message input is enabled when an active thread exists', () => {
		render(ProjectChats, {
			props: {
				slug: 'stridemind-ai',
				initialThreads: [SAMPLE_PERSISTENT],
				initialMessages: [],
				loaderError: null
			}
		});

		const input = screen.getByTestId('message-input');
		expect(input).not.toBeDisabled();
	});

	test('message input is disabled when no active thread', () => {
		render(ProjectChats, {
			props: {
				slug: 'stridemind-ai',
				initialThreads: [],
				initialMessages: [],
				loaderError: null
			}
		});

		const input = screen.getByTestId('message-input');
		expect(input).toBeDisabled();
	});

	// ─── typing indicator (Loom #34) ────────────────────────────────────────

	test('typing indicator is NOT visible at rest (no in-flight send)', () => {
		render(ProjectChats, {
			props: {
				slug: 'stridemind-ai',
				initialThreads: [SAMPLE_PERSISTENT],
				initialMessages: [SAMPLE_MESSAGE_USER, SAMPLE_MESSAGE_ASSISTANT],
				loaderError: null
			}
		});
		expect(screen.queryByTestId('typing-indicator')).not.toBeInTheDocument();
	});
});

// ─── AC-39: loader → SSR → first-paint integration ────────────────────────
//
// Exercises the full read path: loader data flows through props into the
// component, threads render in the rail, messages render in the pane,
// and the active thread is highlighted — all on first paint with no
// async fetch (SSR-seeded data).

describe('ProjectChats — AC-39: loader integration (SSR first-paint)', () => {
	test('loader data flows through to threads + messages on first render', () => {
		render(ProjectChats, {
			props: {
				slug: 'stridemind-ai',
				initialThreads: [SAMPLE_PERSISTENT, SAMPLE_THROWAWAY],
				initialMessages: [SAMPLE_MESSAGE_USER, SAMPLE_MESSAGE_ASSISTANT],
				loaderError: null
			}
		});

		// Threads rendered from loader
		const rows = screen.getAllByTestId('thread-row');
		expect(rows).toHaveLength(2);

		// Messages rendered from loader (no spinner, no fetch needed)
		const messagesList = screen.getByTestId('messages-list');
		expect(messagesList).toBeInTheDocument();
		expect(screen.queryByTestId('messages-loading')).not.toBeInTheDocument();

		// Both user and assistant messages present
		const messages = screen.getAllByTestId('message');
		expect(messages.length).toBeGreaterThanOrEqual(2);

		// Active thread highlighted
		expect(rows[0].dataset.active).toBe('true');
	});

	test('Pennyworth error degrades gracefully — page still renders', () => {
		render(ProjectChats, {
			props: {
				slug: 'stridemind-ai',
				initialThreads: [],
				initialMessages: [],
				loaderError: 'Connection refused'
			}
		});

		// Error is shown but the page is functional
		expect(screen.getByTestId('threads-error')).toBeInTheDocument();
		// New thread button still exists (user can retry)
		expect(screen.getByTestId('new-thread-button')).toBeInTheDocument();
	});
});

// ─── AC-40: optimistic send path ───────────────────────────────────────────
//
// Tests the optimistic append flow: user types → send → optimistic bubble
// appears immediately with a tmp-* ID before any network response.

describe('ProjectChats — AC-40: optimistic send', () => {
	test('send appends optimistic user message with tmp-* ID before fetch resolves', async () => {
		// Mock fetch to return an SSE stream (simulates the streaming endpoint)
		// The stream never resolves — we just want to verify the optimistic message appears
		const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
			() =>
				new Promise<Response>(() => {
					// Never resolve — we're testing the optimistic append, not the response
				})
		);

		render(ProjectChats, {
			props: {
				slug: 'stridemind-ai',
				initialThreads: [SAMPLE_PERSISTENT],
				initialMessages: [],
				loaderError: null
			}
		});

		// Type a message
		const input = screen.getByTestId('message-input') as HTMLTextAreaElement;
		await fireEvent.input(input, { target: { value: 'Hello Alfred' } });

		// Click send
		const sendButton = screen.getByTestId('send-button');
		await fireEvent.click(sendButton);

		// The optimistic message should appear immediately (before fetch resolves)
		await waitFor(() => {
			const messages = screen.getAllByTestId('message');
			const userMessages = messages.filter((m) => m.dataset.role === 'user');
			expect(userMessages.length).toBeGreaterThanOrEqual(1);

			// Find the optimistic one (has data-optimistic="true")
			const optimistic = messages.find((m) => m.dataset.optimistic === 'true');
			expect(optimistic).toBeTruthy();
			expect(optimistic!.dataset.role).toBe('user');
		});

		fetchSpy.mockRestore();
	});

	test('send clears the input field immediately', async () => {
		const fetchSpy = vi
			.spyOn(globalThis, 'fetch')
			.mockImplementation(() => new Promise<Response>(() => {}));

		render(ProjectChats, {
			props: {
				slug: 'stridemind-ai',
				initialThreads: [SAMPLE_PERSISTENT],
				initialMessages: [],
				loaderError: null
			}
		});

		const input = screen.getByTestId('message-input') as HTMLTextAreaElement;
		await fireEvent.input(input, { target: { value: 'Hello Alfred' } });
		expect(input.value).toBe('Hello Alfred');

		const sendButton = screen.getByTestId('send-button');
		await fireEvent.click(sendButton);

		// Input should be cleared after send
		await waitFor(() => {
			expect(input.value).toBe('');
		});

		fetchSpy.mockRestore();
	});
});
