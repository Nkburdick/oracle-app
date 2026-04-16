<!--
	Pull-to-refresh for PWA. Wraps content and shows a spinner when the user
	pulls down from the top of the scroll container. Calls `onrefresh` which
	should return a Promise that resolves when data is refreshed.

	Only activates when the scroll container is at the top (scrollTop ≤ 0)
	so it doesn't interfere with normal scrolling.
-->
<script lang="ts">
	import { RefreshCw } from 'lucide-svelte';

	interface Props {
		/** Called when the user completes a pull-to-refresh gesture */
		onrefresh: () => Promise<void>;
		children: import('svelte').Snippet;
	}

	const { onrefresh, children }: Props = $props();

	const THRESHOLD = 80;

	let startY = $state(0);
	let pullDistance = $state(0);
	let pulling = $state(false);
	let refreshing = $state(false);
	let containerEl = $state<HTMLElement | null>(null);

	function onTouchStart(e: TouchEvent) {
		if (refreshing) return;
		// Only activate when scrolled to the top
		if (containerEl && containerEl.scrollTop > 0) return;
		startY = e.touches[0].clientY;
		pulling = true;
	}

	function onTouchMove(e: TouchEvent) {
		if (!pulling || refreshing) return;
		const dy = e.touches[0].clientY - startY;
		if (dy > 0) {
			pullDistance = Math.min(dy * 0.5, 120); // dampen
			if (dy > 10) e.preventDefault();
		} else {
			pullDistance = 0;
		}
	}

	async function onTouchEnd() {
		if (!pulling) return;
		pulling = false;
		if (pullDistance >= THRESHOLD) {
			refreshing = true;
			pullDistance = 50; // hold spinner visible
			try {
				await onrefresh();
			} finally {
				refreshing = false;
				pullDistance = 0;
			}
		} else {
			pullDistance = 0;
		}
	}

	const progress = $derived(Math.min(pullDistance / THRESHOLD, 1));
	const spinnerOpacity = $derived(refreshing ? 1 : progress);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	bind:this={containerEl}
	class="relative h-full overflow-y-auto"
	ontouchstart={onTouchStart}
	ontouchmove={onTouchMove}
	ontouchend={onTouchEnd}
>
	<!-- Pull indicator -->
	{#if pullDistance > 0 || refreshing}
		<div
			class="flex items-center justify-center transition-opacity"
			style="height: {pullDistance}px; opacity: {spinnerOpacity}"
		>
			<RefreshCw
				size={18}
				class="text-muted-foreground {refreshing ? 'animate-spin' : ''}"
				style="transform: rotate({progress * 360}deg)"
			/>
		</div>
	{/if}

	{@render children()}
</div>
