<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { invalidate } from '$app/navigation';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import MobileTabBar from '$lib/components/MobileTabBar.svelte';
	import IOSInstallPrompt from '$lib/components/IOSInstallPrompt.svelte';
	import NotificationBell from '$lib/components/NotificationBell.svelte';
	import { ensureSubscription } from '$lib/push.js';

	let notificationBellRef: NotificationBell | null = $state(null);
	import type { LayoutData } from './$types.js';

	interface Props {
		data: LayoutData;
		children: import('svelte').Snippet;
	}

	const { data, children }: Props = $props();

	onMount(() => {
		const es = new EventSource('/api/events');

		es.addEventListener('message', (event) => {
			try {
				const evt = JSON.parse(event.data) as { type: string; slug: string };
				if (
					evt.type === 'project-updated' ||
					evt.type === 'project-created' ||
					evt.type === 'project-deleted'
				) {
					invalidate(`oracle:project:${evt.slug}`);
					invalidate('oracle:projects');
				} else if (
					evt.type === 'area-updated' ||
					evt.type === 'area-created' ||
					evt.type === 'area-deleted'
				) {
					invalidate(`oracle:area:${evt.slug}`);
					invalidate('oracle:areas');
				} else if (evt.type === 'notification') {
					notificationBellRef?.onNotificationEvent(evt as unknown as { unreadCount?: number });
				}
			} catch {
				// ignore malformed events
			}
		});

		es.onerror = () => {
			// EventSource auto-reconnects
		};

		return () => es.close();
	});

	// Re-confirm push subscription on every app launch (iOS subscriptions can silently expire)
	onMount(() => {
		if (browser) {
			ensureSubscription();
		}
	});
</script>

<div class="app-shell flex h-screen overflow-hidden bg-background text-foreground">
	<!-- Desktop sidebar -->
	<Sidebar projects={data.projects} areas={data.areas} />

	<!-- Main content area — safe-area-inset-top for standalone PWA on notch devices -->
	<main
		class="app-main flex-1 overflow-y-auto pt-safe-area pb-16 lg:pb-0"
	>
		{@render children()}
	</main>

	<!-- Notification bell — fixed top-right, offset for safe-area -->
	<div class="app-bell fixed right-3 z-40" style="top: max(0.5rem, env(safe-area-inset-top, 0.5rem));">
		<NotificationBell bind:this={notificationBellRef} />
	</div>

	<!-- Mobile bottom tab bar -->
	<MobileTabBar />
</div>

<!-- iOS install prompt (shown on iOS Safari when not installed) -->
<IOSInstallPrompt />
