<!--
	NotificationBell — header bell icon with unread badge + dropdown panel.

	Shows a bell icon with an unread count badge. Clicking opens a dropdown
	with the last 10 notifications. Tapping a notification navigates to its
	context URL and marks it read.

	Receives new notification events via SSE (piggybacked on the existing
	/api/events connection in the layout).
-->
<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { Bell } from 'lucide-svelte';

	interface Notification {
		id: string;
		title: string;
		body: string;
		url: string | null;
		severity: string;
		category: string;
		read: boolean;
		oracleSlug: string | null;
		createdAt: string;
	}

	let open = $state(false);
	let notifications = $state<Notification[]>([]);
	let unreadCount = $state(0);
	let loading = $state(false);
	let dropdownEl = $state<HTMLElement | null>(null);

	/** Fetch notifications from the API */
	async function fetchNotifications(): Promise<void> {
		if (!browser) return;
		loading = true;
		try {
			const res = await fetch('/api/notifications');
			if (!res.ok) return;
			const data = (await res.json()) as {
				notifications: Notification[];
				unreadCount: number;
			};
			notifications = data.notifications.slice(0, 10);
			unreadCount = data.unreadCount;
		} catch {
			// Silent — bell degrades gracefully
		} finally {
			loading = false;
		}
	}

	/** Increment unread count when SSE notification event arrives */
	export function onNotificationEvent(data: { unreadCount?: number }): void {
		if (typeof data.unreadCount === 'number') {
			unreadCount = data.unreadCount;
		} else {
			unreadCount++;
		}
		// If dropdown is open, refresh the list
		if (open) {
			fetchNotifications();
		}
	}

	function toggleDropdown(): void {
		open = !open;
		if (open) {
			fetchNotifications();
		}
	}

	async function handleNotificationClick(notif: Notification): Promise<void> {
		open = false;

		// Mark as read
		if (!notif.read) {
			fetch(`/api/notifications/${notif.id}/read`, { method: 'POST' }).catch(() => {});
			unreadCount = Math.max(0, unreadCount - 1);
			notifications = notifications.map((n) => (n.id === notif.id ? { ...n, read: true } : n));
		}

		// Navigate to context
		if (notif.url) {
			await goto(notif.url);
		}
	}

	async function markAllRead(): Promise<void> {
		try {
			await fetch('/api/notifications/read-all', { method: 'POST' });
			unreadCount = 0;
			notifications = notifications.map((n) => ({ ...n, read: true }));
		} catch {
			// Silent
		}
	}

	function formatTime(dateStr: string): string {
		const d = new Date(dateStr);
		const now = Date.now();
		const diffMs = now - d.getTime();
		const diffMin = Math.floor(diffMs / 60000);
		if (diffMin < 1) return 'just now';
		if (diffMin < 60) return `${diffMin}m ago`;
		const diffHr = Math.floor(diffMin / 60);
		if (diffHr < 24) return `${diffHr}h ago`;
		const diffDay = Math.floor(diffHr / 24);
		return `${diffDay}d ago`;
	}

	function severityClass(severity: string): string {
		if (severity === 'critical') return 'text-destructive';
		if (severity === 'warn') return 'text-yellow-500';
		return '';
	}

	// Close dropdown on click outside
	function handleClickOutside(event: MouseEvent): void {
		if (dropdownEl && !dropdownEl.contains(event.target as Node)) {
			open = false;
		}
	}

	onMount(() => {
		// Fetch initial unread count
		fetchNotifications();

		document.addEventListener('click', handleClickOutside, true);
		return () => document.removeEventListener('click', handleClickOutside, true);
	});
</script>

<div class="relative" bind:this={dropdownEl}>
	<!-- Bell button -->
	<button
		type="button"
		onclick={toggleDropdown}
		class="relative flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
		aria-label="Notifications"
	>
		<Bell size={18} />
		{#if unreadCount > 0}
			<span
				class="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full"
			>
				{unreadCount > 99 ? '99+' : unreadCount}
			</span>
		{/if}
	</button>

	<!-- Dropdown panel -->
	{#if open}
		<div
			class="absolute right-0 top-full mt-1 w-80 max-h-[28rem] bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50 flex flex-col"
		>
			<!-- Header -->
			<div class="px-3 py-2 border-b border-border flex items-center justify-between">
				<span class="text-xs font-semibold">Notifications</span>
				{#if unreadCount > 0}
					<button
						type="button"
						onclick={markAllRead}
						class="text-[10px] text-muted-foreground hover:text-foreground"
					>
						Mark all read
					</button>
				{/if}
			</div>

			<!-- List -->
			<div class="flex-1 overflow-y-auto">
				{#if loading && notifications.length === 0}
					<div class="p-4 text-center text-xs text-muted-foreground">Loading...</div>
				{:else if notifications.length === 0}
					<div class="p-4 text-center text-xs text-muted-foreground">No notifications</div>
				{:else}
					{#each notifications as notif (notif.id)}
						<button
							type="button"
							class="w-full text-left px-3 py-2.5 hover:bg-accent transition-colors border-b border-border last:border-b-0 flex gap-2 items-start"
							onclick={() => handleNotificationClick(notif)}
						>
							<!-- Read indicator -->
							<span
								class="mt-1 flex-shrink-0 text-[10px] {notif.read
									? 'text-muted-foreground'
									: 'text-primary'}"
							>
								{notif.read ? '○' : '●'}
							</span>
							<div class="flex-1 min-w-0">
								<div class="text-xs font-medium truncate {severityClass(notif.severity)}">
									{notif.title}
								</div>
								{#if notif.body}
									<div class="text-[11px] text-muted-foreground truncate mt-0.5">
										{notif.body}
									</div>
								{/if}
								<div class="text-[10px] text-muted-foreground mt-1 flex items-center gap-2">
									<span>{formatTime(notif.createdAt)}</span>
									{#if notif.severity !== 'info'}
										<span
											class="uppercase text-[9px] font-semibold {severityClass(notif.severity)}"
										>
											{notif.severity}
										</span>
									{/if}
								</div>
							</div>
						</button>
					{/each}
				{/if}
			</div>
		</div>
	{/if}
</div>
