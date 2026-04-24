<!--
	ProjectChats — the project Chats tab.

	Phase 2.B Minimal Chat — full minimal chat (read + mutations).
	Phase 2.B.4 Mobile-First — responsive conditional render:
	  - Mobile (<768px): full-width thread list; thread tap navigates to
	    /projects/[slug]/chats/[threadId] route.
	  - Desktop (768px+): existing two-panel layout unchanged.

	What this component does:
	  - Renders the two-panel layout (thread rail + active thread)
	  - Lists threads from the loader (SSR'd, no first-paint spinner)
	  - Auto-selects the most-recent thread on mount (Q8 = a)
	  - Loads message history when the user clicks a different thread
	  - [+ New] creates an instant throwaway thread (Q1 = a)
	  - Cmd/Ctrl+Enter or Send button posts to /api/chat with hybrid optimistic
	    append + silent background reconcile (Q5 = c, Q6 = b)
	  - Hover ✕ deletes a thread (confirm only for persistent — Q7 = a)
	  - Hover ☆ on a throwaway promotes it to persistent (Q3 = b)
	  - Double-click thread title → inline rename → auto-promotes
	  - All four states render distinctly for every async surface (PRD §6)
	  - One silent auto-retry on transient fetch failures (Q10 = c)

	Spec: ~/Code/ORACLE/app/docs/PHASE_2B_MINIMAL_CHAT_PRD.md
	      .forge-prompt-Foreman.md §3 (Mobile Thread List)
-->
<script module lang="ts">
	// Module-level scroll position store — persists across component remounts
	// (the parent uses {#key fm.slug} which remounts on project change).
	// Keyed by project slug so each project's list position is independent.
	const threadListScrollPositions = new Map<string, number>();
</script>

<script lang="ts">
	import { tick } from 'svelte';
	import { goto, preloadData } from '$app/navigation';
	import { browser } from '$app/environment';
	import { ChevronDown } from 'lucide-svelte';
	import type { Thread, Message } from '$lib/types/chat.js';
	import { renderChatMarkdown } from '$lib/chat-markdown.js';
	import PushPrompt from '$lib/components/PushPrompt.svelte';

	type Props = {
		slug: string;
		initialThreads: Thread[];
		initialMessages: Message[];
		loaderError: string | null;
		/** API base path — defaults to '/api/projects'. Use '/api/areas' for area pages. */
		apiBasePath?: string;
		/** Route prefix for mobile chat navigation — defaults to 'projects'. */
		routePrefix?: string;
	};

	const props: Props = $props();
	const slug = $derived(props.slug);
	const apiBase = $derived(props.apiBasePath ?? '/api/projects');
	const routePrefix = $derived(props.routePrefix ?? 'projects');

	// ─── state ────────────────────────────────────────────────────────────────
	//
	// Seeded from loader props once on mount via function-wrapped initializers
	// to sidestep Svelte's `state_referenced_locally` warning.
	//
	// IMPORTANT: this component does NOT react to props.slug changes. The
	// parent route (`projects/[slug]/+page.svelte`) wraps this component in a
	// {#key fm.slug} block to force a fresh mount whenever the slug changes,
	// which re-runs these seed initializers against the new loader props.
	// Without that {#key} block, SvelteKit reuses this component when
	// navigating between same-shape routes (/projects/A → /projects/B) and
	// the local state below would render project A's threads on project B's
	// page. See Loom #33 fix on PR Phase 2.B.0.1.

	function seedThreads(): Thread[] {
		return props.initialThreads;
	}
	function seedMessages(): Message[] {
		return props.initialMessages;
	}
	function seedActiveId(): string | null {
		return props.initialThreads[0]?.id ?? null;
	}
	function seedThreadsError(): string | null {
		return props.loaderError;
	}

	let threads = $state<Thread[]>(seedThreads());
	let threadsError = $state<string | null>(seedThreadsError());

	let activeThreadId = $state<string | null>(seedActiveId());
	let messages = $state<Message[]>(seedMessages());
	let messagesLoading = $state(false);
	let messagesError = $state<string | null>(null);

	// Send state (PRD §6.3)
	//
	// `sending` is scoped per-thread via `sendingThreadId`. A user can start
	// a send in thread A, switch to thread B mid-request, and we must:
	//   1. NOT show the typing indicator in thread B (it's thread A's send)
	//   2. NOT leave thread B's composer disabled after A's response lands
	//   3. Still clear the `sending` flag eventually, regardless of which
	//      thread was active when the fetch resolved (via `finally`)
	// See CodeRabbit finding on PR #36.
	let draft = $state('');
	let sending = $state(false);
	let sendingThreadId = $state<string | null>(null);
	let sendError = $state<string | null>(null);

	// Derived: is there a send in flight for the currently-active thread?
	// Used to gate the typing indicator + composer disabled state so thread
	// switching doesn't leak state across threads.
	const sendingInThisThread = $derived(sending && sendingThreadId === activeThreadId);

	// Streaming state
	let streamingMessageId = $state<string | null>(null);

	// Desktop auto-scroll state
	let messagesContainerEl = $state<HTMLElement | null>(null);
	let isScrolledToBottom = $state(true);
	let hasNewMessages = $state(false);

	// Push prompt
	let pushPromptRef: PushPrompt | null = $state(null);
	let hasShownPushPrompt = $state(false);

	// Inline rename state
	let renamingThreadId = $state<string | null>(null);
	let renameDraft = $state('');

	// Refs
	let messageInputEl = $state<HTMLTextAreaElement | null>(null);

	// Mobile long-press context menu state (AC-26)
	let longPressThreadId = $state<string | null>(null);
	let longPressTimer: ReturnType<typeof setTimeout> | null = null;
	const LONG_PRESS_MS = 500;

	// ─── mobile breakpoint (Phase 2.B.4) ─────────────────────────────────────
	//
	// Starts false on server and updates after hydration. The parent route wraps
	// this component in {#key fm.slug}, so isMobile re-evaluates on every
	// project mount. matchMedia is cheaper than `hidden md:block` because it
	// controls which component tree is mounted, not just CSS visibility.

	let isMobile = $state(false);

	$effect(() => {
		if (!browser) return;
		const mq = window.matchMedia('(max-width: 767px)');
		isMobile = mq.matches;
		const handler = (e: MediaQueryListEvent) => {
			isMobile = e.matches;
		};
		mq.addEventListener('change', handler);
		return () => mq.removeEventListener('change', handler);
	});

	// Ref for the mobile thread list scroll container
	let mobileThreadListEl = $state<HTMLElement | null>(null);

	// Restore scroll position when the element is first bound (e.g. back-navigation).
	$effect(() => {
		if (!mobileThreadListEl) return;
		const saved = threadListScrollPositions.get(slug);
		if (saved != null) {
			mobileThreadListEl.scrollTop = saved;
		}
	});

	// ─── auto-retry helper (PRD §6.6) ─────────────────────────────────────────
	//
	// One silent auto-retry after 1000ms on transport-level / 5xx failures.
	// 4xx responses are NOT retried — they're surfaced immediately. The retry
	// only kicks in for genuine transients.

	const RETRY_DELAY_MS = 1000;

	function isRetryable(err: unknown): boolean {
		if (!(err instanceof Error)) return false;
		const msg = err.message;
		// Network/transport errors don't have an HTTP status — retry.
		if (msg.startsWith('TypeError') || msg.includes('Failed to fetch')) return true;
		// Match status codes from our fetch wrappers ("Pennyworth 5xx" / "5xx").
		const m = msg.match(/(\d{3})/);
		if (!m) return true; // unknown shape — assume transient
		const code = parseInt(m[1], 10);
		return code >= 500;
	}

	async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
		try {
			return await fn();
		} catch (err) {
			if (!isRetryable(err)) throw err;
			await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
			return await fn();
		}
	}

	// ─── thread selection ─────────────────────────────────────────────────────

	async function selectThread(threadId: string): Promise<void> {
		if (threadId === activeThreadId) return;
		if (renamingThreadId !== null) return; // user is editing — don't navigate
		activeThreadId = threadId;
		messages = [];
		messagesError = null;
		messagesLoading = true;

		try {
			const data = await withRetry(async () => {
				const res = await fetch(`${apiBase}/${slug}/threads/${threadId}/messages`);
				if (!res.ok) {
					throw new Error(`Failed to load messages: ${res.status} ${res.statusText}`);
				}
				return (await res.json()) as { messages: Message[] };
			});
			if (activeThreadId === threadId) {
				messages = data.messages;
				messagesLoading = false;
			}
		} catch (err) {
			if (activeThreadId === threadId) {
				messagesError = (err as Error).message;
				messagesLoading = false;
			}
		}
	}

	// ─── new thread ([+ New], Q1 = a) ─────────────────────────────────────────

	async function createNewThread(): Promise<void> {
		const now = new Date();
		const hh = String(now.getHours()).padStart(2, '0');
		const mm = String(now.getMinutes()).padStart(2, '0');
		const title = `Quick chat ${hh}:${mm}`;

		try {
			const data = await withRetry(async () => {
				const res = await fetch(`${apiBase}/${slug}/threads`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ title, isEphemeral: true })
				});
				if (!res.ok) {
					throw new Error(`Failed to create thread: ${res.status} ${res.statusText}`);
				}
				return (await res.json()) as { conversation: Thread };
			});

			threads = [data.conversation, ...threads];
			activeThreadId = data.conversation.id;
			messages = [];
			messagesError = null;
			threadsError = null;
			await tick();
			messageInputEl?.focus({ preventScroll: true });
			messageInputEl?.scrollIntoView({ block: 'end', behavior: 'instant' });
			if (messagesContainerEl) messagesContainerEl.scrollTop = messagesContainerEl.scrollHeight;
		} catch (err) {
			threadsError = (err as Error).message;
		}
	}

	// ─── mobile navigation (Phase 2.B.4) ────────────────────────────────────

	/** Navigate to a thread on mobile, saving scroll position first. */
	function navigateToThread(threadId: string): void {
		if (mobileThreadListEl) {
			threadListScrollPositions.set(slug, mobileThreadListEl.scrollTop);
		}
		void goto(`/${routePrefix}/${slug}/chats/${threadId}`);
	}

	/** Preload thread data on pointer enter for faster navigation (AC-35). */
	function preloadThread(threadId: string): void {
		void preloadData(`/${routePrefix}/${slug}/chats/${threadId}`);
	}

	/**
	 * Mobile variant of createNewThread: creates a throwaway thread then
	 * navigates to it immediately (AC-37 — zero additional taps).
	 */
	async function mobileCreateNewThread(): Promise<void> {
		const now = new Date();
		const hh = String(now.getHours()).padStart(2, '0');
		const mm = String(now.getMinutes()).padStart(2, '0');
		const title = `Quick chat ${hh}:${mm}`;

		try {
			const data = await withRetry(async () => {
				const res = await fetch(`${apiBase}/${slug}/threads`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ title, isEphemeral: true })
				});
				if (!res.ok) {
					throw new Error(`Failed to create thread: ${res.status} ${res.statusText}`);
				}
				return (await res.json()) as { conversation: Thread };
			});

			void goto(`/${routePrefix}/${slug}/chats/${data.conversation.id}`);
		} catch (err) {
			threadsError = (err as Error).message;
		}
	}

	// ─── send message (Q5 = c, Q6 = b) ────────────────────────────────────────

	function makeOptimisticId(): string {
		return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	}

	async function sendCurrentMessage(): Promise<void> {
		const text = draft.trim();
		if (text === '' || sendingInThisThread || activeThreadId === null) return;

		const threadId = activeThreadId;
		const optimisticId = makeOptimisticId();
		const optimisticMessage: Message = {
			id: optimisticId,
			conversationId: threadId,
			role: 'user',
			content: text,
			createdAt: new Date().toISOString()
		};

		messages = [...messages, optimisticMessage];
		const previousDraft = draft;
		draft = '';
		sending = true;
		sendingThreadId = threadId;
		sendError = null;

		// Create placeholder assistant message for streaming
		const assistantId = `tmp-assistant-${Date.now()}`;
		if (activeThreadId === threadId) {
			const assistantMessage: Message = {
				id: assistantId,
				conversationId: threadId,
				role: 'assistant',
				content: '',
				createdAt: new Date().toISOString()
			};
			messages = [...messages, assistantMessage];
			streamingMessageId = assistantId;
		}

		try {
			const res = await fetch(`${apiBase}/${slug}/threads/${threadId}/chat/stream`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: text })
			});

			if (!res.ok || !res.body) {
				// Fallback to atomic endpoint
				if (activeThreadId === threadId) {
					messages = messages.filter((m) => m.id !== assistantId);
					streamingMessageId = null;
				}
				await sendCurrentMessageAtomic(text, threadId, optimisticId, previousDraft);
				return;
			}

			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let buffer = '';
			let fullText = '';

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const parts = buffer.split('\n\n');
				buffer = parts.pop() ?? '';

				for (const block of parts) {
					if (!block.trim()) continue;
					const eventMatch = block.match(/^event:\s*(.+)$/m);
					const dataMatch = block.match(/^data:\s*(.+)$/m);
					if (!eventMatch || !dataMatch) continue;

					const eventType = eventMatch[1];
					const data = JSON.parse(dataMatch[1]);

					if (eventType === 'token') {
						fullText += data.text;
						if (activeThreadId === threadId) {
							messages = messages.map((m) =>
								m.id === assistantId ? { ...m, content: fullText } : m
							);
						}
					} else if (eventType === 'done') {
						fullText = data.fullText;
						if (activeThreadId === threadId) {
							messages = messages.map((m) =>
								m.id === assistantId ? { ...m, content: fullText } : m
							);
						}
					} else if (eventType === 'error') {
						throw new Error(data.message);
					}
				}
			}

			if (activeThreadId === threadId) {
				streamingMessageId = null;
				await tick();
				messageInputEl?.focus({ preventScroll: true });
				messageInputEl?.scrollIntoView({ block: 'end', behavior: 'instant' });
				if (messagesContainerEl && isScrolledToBottom)
					messagesContainerEl.scrollTop = messagesContainerEl.scrollHeight;
				reconcileMessages(threadId);

				// Show push prompt after first successful chat response
				if (!hasShownPushPrompt) {
					hasShownPushPrompt = true;
					pushPromptRef?.show();
				}
			}
		} catch (err) {
			if (activeThreadId === threadId) {
				streamingMessageId = null;
				messages = messages.filter((m) => m.id !== optimisticId && m.id !== assistantId);
				draft = previousDraft;
				sendError = (err as Error).message;
			}
		} finally {
			if (sendingThreadId === threadId) {
				sending = false;
				sendingThreadId = null;
			}
		}
	}

	/** Fallback: atomic POST when SSE streaming fails */
	async function sendCurrentMessageAtomic(
		text: string,
		threadId: string,
		optimisticId: string,
		previousDraft: string
	): Promise<void> {
		try {
			const data = await withRetry(async () => {
				const res = await fetch(`${apiBase}/${slug}/threads/${threadId}/chat`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ message: text })
				});
				if (!res.ok) throw new Error(`Send failed: ${res.status} ${res.statusText}`);
				return (await res.json()) as {
					response: string;
					conversationId: string;
					artifacts: unknown;
				};
			});

			if (activeThreadId === threadId) {
				const assistantMessage: Message = {
					id: `tmp-assistant-${Date.now()}`,
					conversationId: threadId,
					role: 'assistant',
					content: data.response,
					createdAt: new Date().toISOString()
				};
				messages = [...messages, assistantMessage];
				await tick();
				messageInputEl?.focus({ preventScroll: true });
				messageInputEl?.scrollIntoView({ block: 'end', behavior: 'instant' });
				if (messagesContainerEl && isScrolledToBottom)
					messagesContainerEl.scrollTop = messagesContainerEl.scrollHeight;
				reconcileMessages(threadId);
			}
		} catch (err) {
			if (activeThreadId === threadId) {
				messages = messages.filter((m) => m.id !== optimisticId);
				draft = previousDraft;
				sendError = (err as Error).message;
			}
		} finally {
			if (sendingThreadId === threadId) {
				sending = false;
				sendingThreadId = null;
			}
		}
	}

	/**
	 * Silently re-fetch the canonical message list for the given thread and
	 * replace the local list IF (a) we're still on the same thread and (b) the
	 * canonical list is at least as long as the local one. This reconciles
	 * synthetic `tmp-*` IDs with real Pennyworth message IDs without flicker.
	 */
	async function reconcileMessages(threadId: string): Promise<void> {
		try {
			const res = await fetch(`${apiBase}/${slug}/threads/${threadId}/messages`);
			if (!res.ok) return; // silent failure — keep optimistic state
			const data = (await res.json()) as { messages: Message[] };
			if (activeThreadId === threadId && data.messages.length >= messages.length) {
				messages = data.messages;
			}
		} catch {
			// Silent — reconcile is best-effort
		}
	}

	function handleInputKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
			event.preventDefault();
			void sendCurrentMessage();
		}
	}

	// ─── desktop auto-scroll (Phase 2.B.1) ──────────────────────────────────

	function handleDesktopMessagesScroll(): void {
		if (!messagesContainerEl) return;
		const { scrollTop, scrollHeight, clientHeight } = messagesContainerEl;
		isScrolledToBottom = scrollHeight - scrollTop - clientHeight < 150;
		if (isScrolledToBottom) hasNewMessages = false;
	}

	function scrollToBottom(): void {
		messagesContainerEl?.scrollTo({ top: messagesContainerEl.scrollHeight, behavior: 'smooth' });
		hasNewMessages = false;
		isScrolledToBottom = true;
	}

	// Auto-scroll when streaming content updates
	$effect(() => {
		// Trigger on messages array changes (streaming updates)
		void messages;
		if (!messagesContainerEl || !isScrolledToBottom) {
			if (messagesContainerEl && !isScrolledToBottom && streamingMessageId) {
				hasNewMessages = true;
			}
			return;
		}
		tick().then(() => {
			if (messagesContainerEl && isScrolledToBottom) {
				messagesContainerEl.scrollTop = messagesContainerEl.scrollHeight;
			}
		});
	});

	// ─── delete thread (Q7 = a) ───────────────────────────────────────────────

	async function deleteThreadClick(thread: Thread, event: MouseEvent): Promise<void> {
		event.stopPropagation();
		if (!thread.isEphemeral) {
			const ok = window.confirm(`Delete '${thread.title}'? This can't be undone.`);
			if (!ok) return;
		}

		try {
			await withRetry(async () => {
				const res = await fetch(`${apiBase}/${slug}/threads/${thread.id}`, {
					method: 'DELETE'
				});
				if (!res.ok) {
					throw new Error(`Delete failed: ${res.status} ${res.statusText}`);
				}
			});

			const wasActive = activeThreadId === thread.id;
			threads = threads.filter((t) => t.id !== thread.id);

			if (wasActive) {
				const next = threads[0];
				if (next) {
					activeThreadId = next.id;
					messages = [];
					await selectThread(next.id);
				} else {
					activeThreadId = null;
					messages = [];
				}
			}
		} catch (err) {
			window.alert(`Couldn't delete thread: ${(err as Error).message}`);
		}
	}

	// ─── promote: ★ toggle (Q3 = b) ───────────────────────────────────────────

	async function promoteThread(thread: Thread, event: MouseEvent): Promise<void> {
		event.stopPropagation();
		try {
			const data = await withRetry(async () => {
				const res = await fetch(`${apiBase}/${slug}/threads/${thread.id}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ isEphemeral: false })
				});
				if (!res.ok) {
					throw new Error(`Promote failed: ${res.status} ${res.statusText}`);
				}
				return (await res.json()) as { conversation: Thread };
			});
			threads = threads.map((t) => (t.id === thread.id ? data.conversation : t));
		} catch (err) {
			window.alert(`Couldn't promote thread: ${(err as Error).message}`);
		}
	}

	// ─── promote: rename (Q3 = b path A) ──────────────────────────────────────

	function startRename(thread: Thread, event: MouseEvent): void {
		event.stopPropagation();
		renamingThreadId = thread.id;
		renameDraft = thread.title;
	}

	async function commitRename(thread: Thread): Promise<void> {
		const newTitle = renameDraft.trim();
		const stayingId = renamingThreadId;
		renamingThreadId = null;

		if (newTitle === '' || newTitle === thread.title) {
			return; // no-op
		}

		try {
			const data = await withRetry(async () => {
				const res = await fetch(`${apiBase}/${slug}/threads/${thread.id}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ title: newTitle })
				});
				if (!res.ok) {
					throw new Error(`Rename failed: ${res.status} ${res.statusText}`);
				}
				return (await res.json()) as { conversation: Thread };
			});
			threads = threads.map((t) => (t.id === thread.id ? data.conversation : t));
		} catch (err) {
			window.alert(`Couldn't rename thread: ${(err as Error).message}`);
			renamingThreadId = stayingId; // restore edit state for retry
		}
	}

	function handleRenameKeydown(event: KeyboardEvent, thread: Thread): void {
		if (event.key === 'Enter') {
			event.preventDefault();
			void commitRename(thread);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			renamingThreadId = null;
		}
	}

	// ─── mobile long-press (AC-26) ────────────────────────────────────────────
	//
	// Touch devices don't have hover, so the ✕ delete and ☆ promote buttons
	// are invisible on phones/tablets. Long-press a thread row → opens a small
	// context sheet anchored to the row with the same actions. Cancelled by
	// pointer move (scroll) or pointer up before the timer fires.

	function startLongPress(thread: Thread, event: PointerEvent): void {
		// Skip non-touch pointers — desktop hover already covers mouse users.
		if (event.pointerType !== 'touch') return;
		clearLongPress();
		longPressTimer = setTimeout(() => {
			longPressThreadId = thread.id;
			longPressTimer = null;
		}, LONG_PRESS_MS);
	}

	function clearLongPress(): void {
		if (longPressTimer !== null) {
			clearTimeout(longPressTimer);
			longPressTimer = null;
		}
	}

	function closeLongPressMenu(): void {
		longPressThreadId = null;
	}

	// ─── presentational helpers ───────────────────────────────────────────────

	function relativeTime(iso: string): string {
		const then = new Date(iso).getTime();
		const now = Date.now();
		const diffSec = Math.floor((now - then) / 1000);
		if (diffSec < 60) return 'just now';
		if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
		if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
		return `${Math.floor(diffSec / 86400)}d ago`;
	}

	function messageTime(iso: string): string {
		const d = new Date(iso);
		const today = new Date();
		const sameDay =
			d.getFullYear() === today.getFullYear() &&
			d.getMonth() === today.getMonth() &&
			d.getDate() === today.getDate();
		if (sameDay) {
			return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
		}
		return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}

	function autofocusInput(node: HTMLInputElement): void {
		node.focus();
		node.select();
	}
</script>

{#if isMobile}
	<!-- ══════════════════════════════════════════════════════════════════════
     MOBILE — Full-width thread list (Phase 2.B.4)
     Thread tap navigates to /projects/[slug]/chats/[threadId].
     Desktop (md+) layout is below in the else branch — unchanged.
     ══════════════════════════════════════════════════════════════════════ -->
	<div class="flex flex-col h-full" data-testid="project-chats">
		<!-- ── Header: section label + [+ New] ──────────────────────────────── -->
		<div class="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
			<p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
				[THREADS]
			</p>
			<button
				type="button"
				onclick={mobileCreateNewThread}
				class="text-xs text-muted-foreground border border-border rounded px-2 py-1 hover:bg-accent hover:text-accent-foreground transition-colors"
				data-testid="new-thread-button"
			>
				+ New
			</button>
		</div>

		{#if threadsError}
			<div class="px-4 py-3 text-xs text-destructive bg-destructive/10" data-testid="threads-error">
				Couldn't load threads.
				<div class="mt-1 opacity-70 text-[10px]">{threadsError}</div>
				<button
					type="button"
					class="mt-2 text-[10px] underline"
					onclick={() => {
						threadsError = null;
					}}
				>
					Dismiss
				</button>
			</div>
		{:else if threads.length === 0}
			<!-- ── Empty state (AC-53) ──────────────────────────────────────── -->
			<div
				class="flex-1 flex flex-col items-center justify-center px-8 gap-4 text-center"
				data-testid="threads-empty"
			>
				<p class="text-sm font-medium text-foreground">No conversations yet</p>
				<p class="text-xs text-muted-foreground leading-relaxed">
					Start a conversation with Alfred about this project.
				</p>
				<button
					type="button"
					onclick={mobileCreateNewThread}
					class="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium transition-opacity active:opacity-80"
					data-testid="new-thread-cta"
				>
					+ New Chat
				</button>
			</div>
		{:else}
			<!-- ── Thread list ───────────────────────────────────────────────── -->
			<ul
				bind:this={mobileThreadListEl}
				class="flex-1 overflow-y-auto overscroll-contain divide-y divide-border"
				data-testid="threads-list"
			>
				{#each threads as thread (thread.id)}
					<li class="group relative">
						<button
							type="button"
							onclick={() => navigateToThread(thread.id)}
							onpointerenter={() => preloadThread(thread.id)}
							onpointerdown={(e) => startLongPress(thread, e)}
							onpointerup={clearLongPress}
							onpointercancel={clearLongPress}
							onpointermove={clearLongPress}
							class="w-full flex items-center gap-3 px-4 py-3 min-h-[48px] text-left transition-colors hover:bg-accent/50 active:bg-accent"
							data-testid="thread-row"
							data-thread-id={thread.id}
						>
							<!-- Status indicator: ● persistent, · ephemeral -->
							<span
								class="text-primary flex-shrink-0 text-base leading-none w-3 text-center"
								aria-hidden="true"
							>
								{thread.isEphemeral ? '·' : '●'}
							</span>
							<!-- Title + relative time -->
							<span class="flex-1 min-w-0">
								<span class="block truncate text-sm text-foreground">{thread.title}</span>
								<span class="block text-[11px] text-muted-foreground mt-0.5">
									{relativeTime(thread.updatedAt)}
								</span>
							</span>
							<!-- Drill-in chevron -->
							<span class="text-muted-foreground text-base flex-shrink-0" aria-hidden="true">›</span
							>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
{:else}
	<!-- ══════════════════════════════════════════════════════════════════════
     DESKTOP — Two-panel layout (existing, Phase 2.B unchanged)
     ══════════════════════════════════════════════════════════════════════ -->
	<div class="flex h-full min-h-96" data-testid="project-chats">
		<!-- ── Thread rail ─────────────────────────────────────────────────── -->
		<div class="w-56 border-r border-border flex flex-col p-3 gap-2 flex-shrink-0">
			<p class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
				[THREADS]
			</p>

			{#if threadsError}
				<div
					class="text-xs text-destructive bg-destructive/10 rounded px-2 py-2"
					data-testid="threads-error"
				>
					Couldn't load threads.
					<div class="mt-1 opacity-70 text-[10px]">{threadsError}</div>
					<button
						type="button"
						class="mt-2 text-[10px] underline"
						onclick={() => {
							threadsError = null;
						}}
					>
						Dismiss
					</button>
				</div>
			{:else if threads.length === 0}
				<div class="text-xs text-muted-foreground px-2 py-3" data-testid="threads-empty">
					No threads yet for this project.
				</div>
			{:else}
				<ul class="flex flex-col gap-1 overflow-y-auto" data-testid="threads-list">
					{#each threads as thread (thread.id)}
						<li class="group relative">
							{#if renamingThreadId === thread.id}
								<!-- Inline rename mode -->
								<div
									class="flex items-start gap-2 px-2 py-1.5 rounded text-xs bg-accent text-accent-foreground"
								>
									<span class="text-primary flex-shrink-0 leading-tight">★</span>
									<input
										type="text"
										bind:value={renameDraft}
										onkeydown={(e) => handleRenameKeydown(e, thread)}
										onblur={() => commitRename(thread)}
										use:autofocusInput
										class="flex-1 min-w-0 bg-background border border-border rounded px-1 py-0 text-xs"
										data-testid="thread-rename-input"
									/>
								</div>
							{:else}
								<button
									type="button"
									onclick={() => selectThread(thread.id)}
									ondblclick={(e) => startRename(thread, e)}
									onpointerdown={(e) => startLongPress(thread, e)}
									onpointerup={clearLongPress}
									onpointercancel={clearLongPress}
									onpointermove={clearLongPress}
									class="w-full text-left flex items-start gap-2 px-2 py-1.5 pr-12 rounded text-xs transition-colors
									{activeThreadId === thread.id
										? 'bg-accent text-accent-foreground'
										: 'text-muted-foreground hover:text-foreground hover:bg-accent/50'}"
									data-testid="thread-row"
									data-thread-id={thread.id}
									data-active={activeThreadId === thread.id}
								>
									<span class="text-primary flex-shrink-0 leading-tight" aria-hidden="true">
										{thread.isEphemeral ? '·' : '★'}
									</span>
									<span class="flex-1 min-w-0">
										<span class="block truncate">{thread.title}</span>
										<span class="block text-[10px] opacity-60 mt-0.5">
											{relativeTime(thread.updatedAt)}
										</span>
									</span>
								</button>
								<!-- Hover affordances overlay — absolutely positioned so they're not
								 nested inside the row's <button> (which is illegal HTML). -->
								<div
									class="absolute right-1 top-1.5 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
								>
									{#if thread.isEphemeral}
										<button
											type="button"
											onclick={(e) => promoteThread(thread, e)}
											class="text-[12px] leading-none px-1 hover:text-primary text-muted-foreground"
											title="Keep this thread (promote to persistent)"
											data-testid="promote-button"
										>
											☆
										</button>
									{/if}
									<button
										type="button"
										onclick={(e) => deleteThreadClick(thread, e)}
										class="text-[12px] leading-none px-1 hover:text-destructive text-muted-foreground"
										title="Delete thread"
										data-testid="delete-button"
									>
										✕
									</button>
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}

			<div class="flex-1"></div>

			<button
				type="button"
				onclick={createNewThread}
				class="text-xs text-muted-foreground border border-border rounded px-2 py-1 hover:bg-accent hover:text-accent-foreground transition-colors"
				data-testid="new-thread-button"
			>
				+ New
			</button>
		</div>

		<!-- ── Active thread pane ──────────────────────────────────────────── -->
		<div class="flex-1 flex flex-col min-w-0">
			<div
				bind:this={messagesContainerEl}
				onscroll={handleDesktopMessagesScroll}
				class="flex-1 overflow-y-auto p-4 relative"
				data-testid="messages-pane"
			>
				{#if threads.length === 0 && !threadsError}
					<div class="h-full flex items-center justify-center">
						<p class="text-xs text-muted-foreground text-center">
							Start a thread by tapping <span class="font-semibold">[+ New]</span>
						</p>
					</div>
				{:else if activeThreadId === null}
					<div class="h-full flex items-center justify-center">
						<p class="text-xs text-muted-foreground">Pick a thread to keep going.</p>
					</div>
				{:else if messagesError}
					<div
						class="text-xs text-destructive bg-destructive/10 rounded px-3 py-2"
						data-testid="messages-error"
					>
						Couldn't load messages.
						<div class="mt-1 opacity-70 text-[10px]">{messagesError}</div>
						<button
							type="button"
							class="mt-2 text-[10px] underline"
							onclick={() => {
								const id = activeThreadId;
								if (id) {
									activeThreadId = null;
									void selectThread(id);
								}
							}}
						>
							Retry
						</button>
					</div>
				{:else if messagesLoading}
					<div class="h-full flex items-center justify-center">
						<p class="text-xs text-muted-foreground" data-testid="messages-loading">
							Loading messages…
						</p>
					</div>
				{:else if messages.length === 0}
					<div class="h-full flex items-center justify-center">
						<p class="text-xs text-muted-foreground" data-testid="messages-empty">
							Say hi to Pennyworth.
						</p>
					</div>
				{:else}
					<ul class="flex flex-col gap-3" data-testid="messages-list">
						{#each messages as message (message.id)}
							<li
								class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'}"
								data-testid="message"
								data-role={message.role}
								data-optimistic={message.id.startsWith('tmp-')}
							>
								{#if message.role === 'assistant'}
									<div class="max-w-[85%] rounded-lg px-3 py-2 bg-muted text-foreground">
										{#if message.content}
											<div class="chat-markdown">
												{@html renderChatMarkdown(message.content)}
												{#if streamingMessageId === message.id}
													<span class="typing-cursor">|</span>
												{/if}
											</div>
										{:else if streamingMessageId === message.id}
											<span class="typing-cursor">|</span>
										{/if}
										<div class="text-[10px] opacity-60 mt-1">
											{messageTime(message.createdAt)}
										</div>
									</div>
								{:else}
									<div
										class="max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words bg-primary text-primary-foreground"
									>
										{message.content}
										<div class="text-[10px] opacity-60 mt-1">
											{messageTime(message.createdAt)}
										</div>
									</div>
								{/if}
							</li>
						{/each}
						<!-- Typing indicator — only when sending but NOT streaming -->
						{#if sendingInThisThread && !streamingMessageId}
							<li
								class="flex justify-start"
								data-testid="typing-indicator"
								aria-live="polite"
								aria-label="Pennyworth is thinking"
							>
								<div
									class="max-w-[80%] rounded-lg px-3 py-2 text-sm bg-muted text-muted-foreground italic flex items-center gap-1.5"
								>
									<span>Pennyworth is thinking</span>
									<span class="inline-flex gap-0.5" aria-hidden="true">
										<span class="typing-dot">.</span>
										<span class="typing-dot typing-dot-2">.</span>
										<span class="typing-dot typing-dot-3">.</span>
									</span>
								</div>
							</li>
						{/if}
					</ul>
				{/if}

				<!-- "New messages" pill (Phase 2.B.1 desktop auto-scroll) -->
				{#if hasNewMessages && !isScrolledToBottom}
					<button
						type="button"
						onclick={scrollToBottom}
						class="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-full text-xs shadow-lg z-10"
					>
						<ChevronDown size={14} />
						New messages
					</button>
				{/if}
			</div>

			<!-- Push notification prompt (shown after first chat response) -->
			<PushPrompt bind:this={pushPromptRef} />

			<!-- Sticky message input -->
			<div class="border-t border-border p-3 flex flex-col gap-2 flex-shrink-0">
				{#if sendError}
					<div
						class="text-[11px] text-destructive bg-destructive/10 rounded px-2 py-1 flex items-center justify-between"
						data-testid="send-error"
					>
						<span>Couldn't send. {sendError}</span>
						<button
							type="button"
							class="underline"
							onclick={() => {
								sendError = null;
								void sendCurrentMessage();
							}}
						>
							Retry
						</button>
					</div>
				{/if}
				<!-- Composer disabled state: uses `sendingInThisThread` derived in
			     the script block — only disables when a send is in flight
			     for the currently-active thread. If user switches to a
			     different thread mid-send, the new thread's composer is
			     immediately usable — the send-in-flight stays with its own
			     thread. CodeRabbit finding on PR #36. -->
				<div class="flex gap-2">
					<textarea
						bind:this={messageInputEl}
						bind:value={draft}
						onkeydown={handleInputKeydown}
						placeholder={activeThreadId
							? 'Type a message — Cmd/Ctrl+Enter to send'
							: 'Pick or start a thread to chat'}
						rows="1"
						disabled={activeThreadId === null || sendingInThisThread}
						class="flex-1 bg-background border border-border rounded-md px-3 py-1.5 text-sm resize-none disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed"
						data-testid="message-input"
					></textarea>
					<button
						type="button"
						onclick={() => sendCurrentMessage()}
						disabled={activeThreadId === null || sendingInThisThread || draft.trim() === ''}
						class="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed"
						data-testid="send-button"
					>
						{#if sendingInThisThread}
							<span data-testid="send-spinner">…</span>
						{:else}
							Send
						{/if}
					</button>
				</div>
			</div>
		</div>
	</div>
	<!-- ── closes desktop two-panel ─── -->
{/if}
<!-- ── closes {#if isMobile} block ─── -->

<!-- ── Long-press context sheet (shared: mobile + desktop) ─────────── -->
{#if longPressThreadId !== null}
	{@const target = threads.find((t) => t.id === longPressThreadId)}
	{#if target}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="fixed inset-0 z-40 bg-background/40 backdrop-blur-sm flex items-end justify-center"
			onclick={closeLongPressMenu}
			data-testid="long-press-overlay"
		>
			<div
				class="bg-card border border-border rounded-t-2xl w-full max-w-sm p-4 flex flex-col gap-2 shadow-xl"
				onclick={(e) => e.stopPropagation()}
				role="dialog"
				aria-modal="true"
				tabindex="-1"
				data-testid="long-press-sheet"
			>
				<div class="text-xs text-muted-foreground truncate px-2 pb-2 border-b border-border">
					{target.title}
				</div>
				{#if target.isEphemeral}
					<button
						type="button"
						onclick={(e) => {
							closeLongPressMenu();
							void promoteThread(target, e);
						}}
						class="w-full text-left px-3 py-3 text-sm rounded hover:bg-accent transition-colors flex items-center gap-3"
						data-testid="long-press-promote"
					>
						<span class="text-primary">★</span>
						<span>Keep this thread</span>
					</button>
				{/if}
				<button
					type="button"
					onclick={(e) => {
						closeLongPressMenu();
						void deleteThreadClick(target, e);
					}}
					class="w-full text-left px-3 py-3 text-sm rounded hover:bg-destructive/10 text-destructive transition-colors flex items-center gap-3"
					data-testid="long-press-delete"
				>
					<span>✕</span>
					<span>Delete</span>
				</button>
				<button
					type="button"
					onclick={closeLongPressMenu}
					class="w-full text-center px-3 py-2 text-xs text-muted-foreground rounded hover:bg-accent transition-colors mt-1"
				>
					Cancel
				</button>
			</div>
		</div>
	{/if}
{/if}

<style>
	/* Typing indicator dots — staggered fade animation. Loom #34. */
	.typing-dot {
		animation: typing-dot-fade 1.4s infinite;
		opacity: 0.3;
	}
	.typing-dot-2 {
		animation-delay: 0.2s;
	}
	.typing-dot-3 {
		animation-delay: 0.4s;
	}
	@keyframes typing-dot-fade {
		0%,
		60%,
		100% {
			opacity: 0.3;
		}
		30% {
			opacity: 1;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.typing-dot {
			animation: none;
			opacity: 0.7;
		}
	}
</style>
