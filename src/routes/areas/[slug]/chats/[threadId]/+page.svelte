<!--
	Mobile Active Thread — /projects/[slug]/chats/[threadId]

	Phase 2.B.4: Mobile-First Chat Redesign.

	This is a full-screen chat view, mobile-only. Desktop viewports (md+) are
	redirected to /projects/[slug] on client mount (AC-43).

	Layout (bottom-up, inside main's pb-16 safe zone above tab bar):
	  ┌─────────────────────────────────┐
	  │ ← Thread title               ⋯ │  ← chat header
	  ├─────────────────────────────────┤
	  │           messages              │  ← flex-1 scroll area
	  ├─────────────────────────────────┤
	  │ [ Message...        ] [▶]       │  ← composer
	  └─────────────────────────────────┘
	  │ 🏠  📁  📖  ⚙️               │  ← MobileTabBar (fixed, handled by layout)

	Spec: .forge-prompt-Foreman.md §4
-->
<script lang="ts">
	import { tick, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { ChevronLeft, MoreHorizontal, ChevronDown } from 'lucide-svelte';
	import type { PageData } from './$types.js';
	import type { Thread, Message } from '$lib/types/chat.js';
	import { renderChatMarkdown } from '$lib/chat-markdown.js';

	const { data }: { data: PageData } = $props();

	const slug = $derived(data.area.frontmatter.slug);

	// Function-wrapped initializers avoid the `state_referenced_locally`
	// warning that Svelte emits when $state() directly captures a prop. This
	// mirrors the pattern in ProjectChats.svelte. The parent route will
	// invalidate and re-fetch via the loader when needed; these are the
	// mount-time snapshots that we then mutate locally.
	function seedThread(): Thread {
		return data.thread!;
	}
	function seedMessages(): Message[] {
		return data.messages ?? [];
	}

	// Thread state — local copy so we can apply mutations (rename, promote)
	// without waiting for a full page reload.
	let localThread = $state<Thread>(seedThread());

	// Messages — seeded from SSR, grown optimistically on send.
	// Initialise prevMessageCount to the SSR count so the auto-scroll $effect
	// doesn't fire for messages that are already present on first render.
	let messages = $state<Message[]>(seedMessages());
	let prevMessageCount = $state(seedMessages().length);

	// Send state
	let draft = $state('');
	let sending = $state(false);
	let sendError = $state<string | null>(null);
	let streamingMessageId = $state<string | null>(null);

	// Scroll state
	let messagesContainerEl = $state<HTMLElement | null>(null);
	let isScrolledToBottom = $state(true);
	let hasNewMessages = $state(false);

	// Overflow menu (⋯) bottom sheet
	let overflowMenuOpen = $state(false);

	// Inline rename state (AC-20)
	let isRenaming = $state(false);
	let renameDraft = $state('');
	let renameInputEl = $state<HTMLInputElement | null>(null);

	// Composer element — used for iOS visualViewport keyboard adjustment
	let composerEl = $state<HTMLElement | null>(null);
	let textareaEl = $state<HTMLTextAreaElement | null>(null);

	// ─── desktop redirect (AC-43) ────────────────────────────────────────────
	//
	// This route is mobile-only. On desktops, bounce to the project page where
	// the two-panel layout takes over. Use replaceState so the back button in
	// the desktop browser doesn't loop back here. Runs once on mount — not on
	// every render — to avoid firing on window resize.

	onMount(() => {
		if (window.matchMedia('(min-width: 768px)').matches) {
			goto(`/areas/${slug}`, { replaceState: true });
		}
	});

	// ─── iOS keyboard handling (§7.3, §5.4) ─────────────────────────────────
	//
	// When the iOS virtual keyboard opens, visualViewport shrinks while
	// window.innerHeight stays the same. We translate the composer up by the
	// difference so it stays visible above the keyboard. The layout returns to
	// normal when the keyboard closes.

	onMount(() => {
		// Scroll to the bottom of the message list on initial load.
		if (messagesContainerEl) {
			messagesContainerEl.scrollTop = messagesContainerEl.scrollHeight;
		}

		if (!browser || !window.visualViewport) return;

		const handleViewportResize = () => {
			if (!composerEl || !window.visualViewport) return;
			const offset = window.innerHeight - window.visualViewport.height;
			// Only translate when the keyboard is meaningfully open (>50px offset)
			// to avoid jitter from the Safari URL bar collapsing/expanding.
			composerEl.style.transform = offset > 50 ? `translateY(-${offset}px)` : '';
		};

		window.visualViewport.addEventListener('resize', handleViewportResize);
		return () => {
			if (window.visualViewport) {
				window.visualViewport.removeEventListener('resize', handleViewportResize);
			}
		};
	});

	// ─── auto-scroll on new messages (AC-15, AC-16, AC-17) ──────────────────
	//
	// When new messages arrive:
	//   - If the user is scrolled to the bottom → scroll down automatically.
	//   - If the user has scrolled up → show the "↓ New messages" pill.

	$effect(() => {
		const count = messages.length;
		if (count > prevMessageCount) {
			prevMessageCount = count;
			tick().then(() => {
				if (!messagesContainerEl) return;
				if (isScrolledToBottom) {
					messagesContainerEl.scrollTop = messagesContainerEl.scrollHeight;
					hasNewMessages = false;
				} else {
					hasNewMessages = true;
				}
			});
		}
	});

	function handleMessagesScroll(): void {
		if (!messagesContainerEl) return;
		const { scrollTop, scrollHeight, clientHeight } = messagesContainerEl;
		// 150px tolerance — prevents the pill flashing at every tiny scroll
		isScrolledToBottom = scrollHeight - scrollTop - clientHeight < 150;
		if (isScrolledToBottom) hasNewMessages = false;
	}

	function scrollToBottom(): void {
		messagesContainerEl?.scrollTo({ top: messagesContainerEl.scrollHeight, behavior: 'smooth' });
		hasNewMessages = false;
		isScrolledToBottom = true;
	}

	// ─── auto-retry helper (mirrors ProjectChats pattern) ───────────────────

	const RETRY_DELAY_MS = 1000;

	function isRetryable(err: unknown): boolean {
		if (!(err instanceof Error)) return false;
		const msg = err.message;
		if (msg.startsWith('TypeError') || msg.includes('Failed to fetch')) return true;
		const m = msg.match(/(\d{3})/);
		if (!m) return true;
		return parseInt(m[1], 10) >= 500;
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

	// ─── send message (AC-29, §4.5 Optimistic Send) ─────────────────────────

	function makeOptimisticId(): string {
		return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	}

	async function sendCurrentMessage(): Promise<void> {
		const text = draft.trim();
		if (text === '' || sending || !localThread) return;

		const threadId = localThread.id;
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
		if (textareaEl) {
			textareaEl.style.height = 'auto';
		}
		sending = true;
		sendError = null;

		// Create placeholder assistant message for streaming
		const assistantId = `tmp-assistant-${Date.now()}`;
		const assistantMessage: Message = {
			id: assistantId,
			conversationId: threadId,
			role: 'assistant',
			content: '',
			createdAt: new Date().toISOString()
		};
		messages = [...messages, assistantMessage];
		streamingMessageId = assistantId;

		try {
			// Try SSE streaming first
			const res = await fetch(`/api/areas/${slug}/threads/${threadId}/chat/stream`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: text })
			});

			if (!res.ok || !res.body) {
				// Fallback to atomic endpoint
				messages = messages.filter((m) => m.id !== assistantId);
				streamingMessageId = null;
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

				// Parse SSE events from buffer
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
						messages = messages.map((m) =>
							m.id === assistantId ? { ...m, content: fullText } : m
						);
					} else if (eventType === 'done') {
						fullText = data.fullText;
						messages = messages.map((m) =>
							m.id === assistantId ? { ...m, content: fullText } : m
						);
					} else if (eventType === 'error') {
						throw new Error(data.message);
					}
				}
			}

			streamingMessageId = null;
			await tick();
			textareaEl?.focus();
			reconcileMessages(threadId);
		} catch (err) {
			streamingMessageId = null;
			messages = messages.filter((m) => m.id !== optimisticId && m.id !== assistantId);
			draft = previousDraft;
			sendError = (err as Error).message;
		} finally {
			sending = false;
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
			const result = await withRetry(async () => {
				const res = await fetch(`/api/areas/${slug}/threads/${threadId}/chat`, {
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

			const assistantMessage: Message = {
				id: `tmp-assistant-${Date.now()}`,
				conversationId: threadId,
				role: 'assistant',
				content: result.response,
				createdAt: new Date().toISOString()
			};
			messages = [...messages, assistantMessage];
			await tick();
			textareaEl?.focus();
			reconcileMessages(threadId);
		} catch (err) {
			messages = messages.filter((m) => m.id !== optimisticId);
			draft = previousDraft;
			sendError = (err as Error).message;
		} finally {
			sending = false;
		}
	}

	async function reconcileMessages(threadId: string): Promise<void> {
		try {
			const res = await fetch(`/api/areas/${slug}/threads/${threadId}/messages`);
			if (!res.ok) return;
			const data = (await res.json()) as { messages: Message[] };
			if (data.messages.length >= messages.length) {
				messages = data.messages;
			}
		} catch {
			// Silent — reconcile is best-effort
		}
	}

	// AC-30: Enter inserts newline. Cmd/Ctrl+Enter sends (desktop convenience).
	function handleInputKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
			event.preventDefault();
			void sendCurrentMessage();
		}
	}

	// Auto-grow textarea from 1 to 4 lines (AC-26)
	function handleTextareaInput(event: Event): void {
		const el = event.target as HTMLTextAreaElement;
		el.style.height = 'auto';
		// 4 lines × ~24px line-height + 16px vertical padding
		const maxHeight = 4 * 24 + 16;
		el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
	}

	// ─── back navigation (AC-11, AC-32) ─────────────────────────────────────

	function goBack(): void {
		if (browser && window.history.length > 1) {
			window.history.back();
		} else {
			goto(`/areas/${slug}`);
		}
	}

	// ─── rename (AC-20) ──────────────────────────────────────────────────────

	function startRename(): void {
		overflowMenuOpen = false;
		isRenaming = true;
		renameDraft = localThread.title;
		tick().then(() => renameInputEl?.focus());
	}

	async function commitRename(): Promise<void> {
		const newTitle = renameDraft.trim();
		isRenaming = false;
		if (newTitle === '' || newTitle === localThread.title) return;

		try {
			const result = await withRetry(async () => {
				const res = await fetch(`/api/areas/${slug}/threads/${localThread.id}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ title: newTitle })
				});
				if (!res.ok) throw new Error(`Rename failed: ${res.status} ${res.statusText}`);
				return (await res.json()) as { conversation: Thread };
			});
			localThread = result.conversation;
		} catch (err) {
			window.alert(`Couldn't rename: ${(err as Error).message}`);
		}
	}

	function handleRenameKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			event.preventDefault();
			void commitRename();
		} else if (event.key === 'Escape') {
			event.preventDefault();
			isRenaming = false;
		}
	}

	// ─── promote (AC-21, AC-23) ───────────────────────────────────────────────

	async function promoteThread(): Promise<void> {
		overflowMenuOpen = false;
		try {
			const result = await withRetry(async () => {
				const res = await fetch(`/api/areas/${slug}/threads/${localThread.id}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ isEphemeral: false })
				});
				if (!res.ok) throw new Error(`Promote failed: ${res.status} ${res.statusText}`);
				return (await res.json()) as { conversation: Thread };
			});
			localThread = result.conversation;
		} catch (err) {
			window.alert(`Couldn't promote: ${(err as Error).message}`);
		}
	}

	// ─── delete (AC-21, AC-22) ────────────────────────────────────────────────

	async function deleteThread(): Promise<void> {
		overflowMenuOpen = false;
		// Persistent threads require confirmation (AC-21)
		if (!localThread.isEphemeral) {
			const ok = window.confirm(`Delete '${localThread.title}'? This can't be undone.`);
			if (!ok) return;
		}

		try {
			await withRetry(async () => {
				const res = await fetch(`/api/areas/${slug}/threads/${localThread.id}`, {
					method: 'DELETE'
				});
				if (!res.ok) throw new Error(`Delete failed: ${res.status} ${res.statusText}`);
			});
			// AC-22: navigate back to thread list after delete
			goto(`/areas/${slug}`);
		} catch (err) {
			window.alert(`Couldn't delete: ${(err as Error).message}`);
		}
	}

	// ─── presentation helpers ────────────────────────────────────────────────

	function messageTime(iso: string): string {
		const d = new Date(iso);
		const today = new Date();
		const sameDay =
			d.getFullYear() === today.getFullYear() &&
			d.getMonth() === today.getMonth() &&
			d.getDate() === today.getDate();
		if (sameDay) return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
		return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
	}
</script>

<div class="flex flex-col h-[100dvh] md:h-full" data-testid="mobile-chat-page" data-chat-thread>
	<!-- ── Chat Header (AC-18) — safe-area-inset-top for standalone PWA ── -->
	<header
		class="flex items-center gap-1 px-1 py-1 border-b border-border flex-shrink-0 bg-card min-h-[52px]"
		style="padding-top: env(safe-area-inset-top, 0px);"
		data-testid="chat-header"
	>
		<!-- Back button (AC-11) — 44×44 touch target -->
		<button
			type="button"
			onclick={goBack}
			class="flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
			aria-label="Back to thread list"
			data-testid="back-button"
		>
			<ChevronLeft size={22} />
		</button>

		<!-- Thread title — center-aligned, truncated (AC-12) -->
		<div class="flex-1 min-w-0 text-center px-1">
			{#if isRenaming}
				<input
					bind:this={renameInputEl}
					bind:value={renameDraft}
					onkeydown={handleRenameKeydown}
					onblur={() => void commitRename()}
					class="w-full bg-background border border-border rounded-md px-2 py-1 text-sm text-center"
					style="font-size: 16px;"
					data-testid="thread-title-input"
				/>
			{:else}
				<h1 class="text-sm font-semibold truncate" data-testid="thread-title">
					{localThread.title}
				</h1>
				{#if !localThread.isEphemeral}
					<span class="sr-only">Persistent thread</span>
				{/if}
			{/if}
		</div>

		<!-- Overflow menu button (AC-19) — 44×44 touch target -->
		<button
			type="button"
			onclick={() => (overflowMenuOpen = !overflowMenuOpen)}
			class="flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
			aria-label="Thread options"
			aria-expanded={overflowMenuOpen}
			data-testid="overflow-button"
		>
			<MoreHorizontal size={18} />
		</button>
	</header>

	<!-- ── Messages Container (AC-14, AC-15, AC-16) ─────────────────────── -->
	<div
		bind:this={messagesContainerEl}
		onscroll={handleMessagesScroll}
		class="flex-1 overflow-y-auto overscroll-contain p-4 relative"
		style="-webkit-overflow-scrolling: touch;"
		data-testid="messages-container"
	>
		{#if messages.length === 0 && !sending}
			<!-- Empty messages state -->
			<div class="h-full flex items-center justify-center">
				<p class="text-xs text-muted-foreground" data-testid="messages-empty">Say hi to Alfred.</p>
			</div>
		{:else}
			<ul class="flex flex-col gap-4" data-testid="messages-list">
				{#each messages as message (message.id)}
					<li
						class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'}"
						data-testid="message"
						data-role={message.role}
						data-optimistic={message.id.startsWith('tmp-')}
					>
						{#if message.role === 'assistant'}
							<!-- Assistant: left-aligned, card/muted background (AC-13) -->
							<div class="flex flex-col gap-1 max-w-[85%]">
								<span class="text-[10px] text-muted-foreground pl-1">Alfred</span>
								<div class="rounded-2xl rounded-tl-sm px-3 py-2 bg-muted text-foreground">
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
									<div class="text-[10px] opacity-60 mt-1.5">{messageTime(message.createdAt)}</div>
								</div>
							</div>
						{:else}
							<!-- User: right-aligned, primary/copper background (AC-13) -->
							<div
								class="max-w-[80%] rounded-2xl rounded-tr-sm px-3 py-2 text-sm bg-primary text-primary-foreground whitespace-pre-wrap break-words"
							>
								{message.content}
								<div class="text-[10px] opacity-60 mt-1.5">{messageTime(message.createdAt)}</div>
							</div>
						{/if}
					</li>
				{/each}

				<!-- Typing indicator — only show when sending but NOT streaming (streaming has its own cursor) -->
				{#if sending && !streamingMessageId}
					<li
						class="flex justify-start"
						data-testid="typing-indicator"
						aria-live="polite"
						aria-label="Alfred is thinking"
					>
						<div
							class="max-w-[80%] rounded-2xl rounded-tl-sm px-3 py-2 text-sm bg-muted text-muted-foreground italic flex items-center gap-1.5"
						>
							<span>Alfred is thinking</span>
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

		<!-- "↓ New messages" pill (AC-17) -->
		{#if hasNewMessages && !isScrolledToBottom}
			<button
				type="button"
				onclick={scrollToBottom}
				class="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-full text-xs shadow-lg"
				data-testid="scroll-to-bottom-pill"
			>
				<ChevronDown size={14} />
				New messages
			</button>
		{/if}
	</div>

	<!-- ── Composer (AC-24, AC-25) ───────────────────────────────────────── -->
	<!--
		Sits at the bottom of the flex column, above the tab bar.
		The root layout's `pb-16` on <main> creates the 64px gap above
		the fixed MobileTabBar, so this composer naturally clears the tab bar.
		The iOS visualViewport handler in onMount translates this element up
		when the virtual keyboard opens.
	-->
	<div
		bind:this={composerEl}
		class="border-t border-border p-3 flex flex-col gap-2 flex-shrink-0 bg-background"
		style="padding-bottom: max(0.75rem, env(safe-area-inset-bottom, 0px));"
		data-testid="composer"
	>
		<!-- Send error with retry (AC-54) -->
		{#if sendError}
			<div
				class="text-[11px] text-destructive bg-destructive/10 rounded px-2 py-1 flex items-center justify-between"
				data-testid="send-error"
			>
				<span>Couldn't send. {sendError}</span>
				<button
					type="button"
					class="underline ml-2 flex-shrink-0"
					onclick={() => {
						sendError = null;
						void sendCurrentMessage();
					}}
				>
					Retry
				</button>
			</div>
		{/if}

		<div class="flex items-end gap-2">
			<!-- Textarea: auto-grows 1→4 lines (AC-26), 16px prevents iOS auto-zoom (AC-48) -->
			<textarea
				bind:this={textareaEl}
				bind:value={draft}
				onkeydown={handleInputKeydown}
				oninput={handleTextareaInput}
				placeholder="Message..."
				rows={1}
				disabled={sending}
				class="flex-1 bg-background border border-border rounded-2xl px-3 py-2 resize-none overflow-hidden disabled:bg-muted disabled:text-muted-foreground font-mono leading-6"
				style="min-height: 40px; max-height: 112px; font-size: 16px;"
				data-testid="message-input"
			></textarea>

			<!-- Send button: 44×44 minimum touch target (AC-27, AC-28) -->
			<button
				type="button"
				onclick={() => void sendCurrentMessage()}
				disabled={sending || draft.trim() === ''}
				class="flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] bg-primary text-primary-foreground rounded-2xl disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed transition-colors flex-shrink-0"
				aria-label="Send message"
				data-testid="send-button"
			>
				{#if sending}
					<span class="text-xs" data-testid="send-spinner">…</span>
				{:else}
					<span class="text-base leading-none">▶</span>
				{/if}
			</button>
		</div>
	</div>
</div>

<!-- ── Overflow Menu Bottom Sheet (AC-19, AC-20, AC-21, AC-23) ────────── -->
<!--
	Rendered outside the flex column so it can overlay the entire screen.
	Follows the existing long-press sheet pattern in ProjectChats.svelte.
-->
{#if overflowMenuOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-40 bg-background/40 backdrop-blur-sm flex items-end justify-center"
		onclick={() => (overflowMenuOpen = false)}
		data-testid="overflow-overlay"
	>
		<div
			class="bg-card border border-border rounded-t-2xl w-full max-w-sm p-4 flex flex-col gap-2 shadow-xl"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			tabindex="-1"
			data-testid="overflow-sheet"
		>
			<div class="text-xs text-muted-foreground truncate px-2 pb-2 border-b border-border">
				{localThread.title}
			</div>

			<!-- Rename (AC-20) -->
			<button
				type="button"
				onclick={startRename}
				class="w-full text-left px-3 py-3 text-sm rounded hover:bg-accent transition-colors"
				data-testid="overflow-rename"
			>
				Rename thread
			</button>

			<!-- Promote — only for ephemeral threads (AC-23) -->
			{#if localThread.isEphemeral}
				<button
					type="button"
					onclick={() => void promoteThread()}
					class="w-full text-left px-3 py-3 text-sm rounded hover:bg-accent transition-colors flex items-center gap-3"
					data-testid="overflow-promote"
				>
					<span class="text-primary">★</span>
					<span>Keep this thread</span>
				</button>
			{/if}

			<!-- Delete (AC-21, AC-22) -->
			<button
				type="button"
				onclick={() => void deleteThread()}
				class="w-full text-left px-3 py-3 text-sm rounded hover:bg-destructive/10 text-destructive transition-colors"
				data-testid="overflow-delete"
			>
				Delete thread
			</button>

			<!-- Cancel -->
			<button
				type="button"
				onclick={() => (overflowMenuOpen = false)}
				class="w-full text-center px-3 py-2 text-xs text-muted-foreground rounded hover:bg-accent transition-colors mt-1"
			>
				Cancel
			</button>
		</div>
	</div>
{/if}

<style>
	/* Typing indicator — staggered fade, same as ProjectChats Loom #34. */
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
