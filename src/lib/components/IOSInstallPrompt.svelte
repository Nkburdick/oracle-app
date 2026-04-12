<!--
	iOS Install Prompt — bottom sheet guiding users to Add to Home Screen.

	Shown when:
	- Device is iOS (UA + maxTouchPoints detection)
	- App is NOT in standalone mode (not yet installed)
	- User hasn't dismissed in last 7 days
	- Max 3 lifetime shows

	iOS doesn't support the `beforeinstallprompt` event, so we must
	build our own install guidance UI.
-->
<script lang="ts">
	import { browser } from '$app/environment';
	import { X } from 'lucide-svelte';

	let visible = $state(false);

	function isIOS(): boolean {
		if (!browser) return false;
		const ua = navigator.userAgent;
		return (
			/iPad|iPhone|iPod/.test(ua) ||
			(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
		);
	}

	function isStandalone(): boolean {
		if (!browser) return false;
		return (
			window.matchMedia('(display-mode: standalone)').matches ||
			(navigator as unknown as { standalone?: boolean }).standalone === true
		);
	}

	function shouldShow(): boolean {
		if (!browser || !isIOS() || isStandalone()) return false;

		try {
			const dismissedAt = localStorage.getItem('oracle:ios-install-dismissed');
			const showCount = parseInt(localStorage.getItem('oracle:ios-install-count') ?? '0', 10);

			if (showCount >= 3) return false;
			if (dismissedAt) {
				const sevenDays = 7 * 24 * 60 * 60 * 1000;
				if (Date.now() - parseInt(dismissedAt, 10) < sevenDays) return false;
			}

			return true;
		} catch {
			return false;
		}
	}

	function dismiss(): void {
		visible = false;
		try {
			localStorage.setItem('oracle:ios-install-dismissed', String(Date.now()));
			const count = parseInt(localStorage.getItem('oracle:ios-install-count') ?? '0', 10);
			localStorage.setItem('oracle:ios-install-count', String(count + 1));
		} catch {
			// localStorage unavailable
		}
	}

	$effect(() => {
		if (browser) {
			// Delay slightly so it doesn't flash on page load
			const timer = setTimeout(() => {
				visible = shouldShow();
			}, 2000);
			return () => clearTimeout(timer);
		}
	});
</script>

{#if visible}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 bg-background/40 backdrop-blur-sm flex items-end justify-center"
		onclick={dismiss}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="w-full max-w-md bg-card border-t border-border rounded-t-2xl p-5 pb-8 shadow-xl"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="flex items-start justify-between mb-3">
				<h3 class="text-sm font-semibold">Install Oracle</h3>
				<button
					type="button"
					onclick={dismiss}
					class="text-muted-foreground hover:text-foreground p-1"
					aria-label="Dismiss"
				>
					<X size={16} />
				</button>
			</div>

			<p class="text-xs text-muted-foreground mb-4">
				Install Oracle on your home screen for push notifications and a native app experience.
			</p>

			<div class="flex flex-col gap-3 text-xs">
				<div class="flex items-center gap-3">
					<span
						class="flex items-center justify-center w-8 h-8 rounded-lg bg-muted text-foreground font-semibold"
						>1</span
					>
					<span>
						Tap the <strong>Share</strong> button
						<span class="inline-block text-primary" aria-label="share icon">⬆</span>
						in Safari's toolbar
					</span>
				</div>
				<div class="flex items-center gap-3">
					<span
						class="flex items-center justify-center w-8 h-8 rounded-lg bg-muted text-foreground font-semibold"
						>2</span
					>
					<span>Scroll down and tap <strong>"Add to Home Screen"</strong></span>
				</div>
				<div class="flex items-center gap-3">
					<span
						class="flex items-center justify-center w-8 h-8 rounded-lg bg-muted text-foreground font-semibold"
						>3</span
					>
					<span>Tap <strong>"Add"</strong> to install</span>
				</div>
			</div>
		</div>
	</div>
{/if}
