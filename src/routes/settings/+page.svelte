<script lang="ts">
	import { Sun, Moon, Bell, BellOff } from 'lucide-svelte';

	// Read version from package.json — injected at build time
	const version = __APP_VERSION__;
	const buildSha = import.meta.env.VITE_BUILD_SHA ?? null;

	let isDark = $state(false);

	// ── Push notification state ───────────────────────────────────────────────
	// onMount doesn't fire reliably in iOS PWA due to hydration issues.
	// All state is driven by user interaction (button taps) instead.
	let pushState = $state<'unknown' | 'unsupported' | 'ready' | 'enabling' | 'enabled' | 'error'>('unknown');
	let pushError = $state<string | null>(null);

	function toggleTheme() {
		isDark = !isDark;
		if (isDark) {
			document.documentElement.classList.add('dark');
			localStorage.setItem('oracle:theme', 'dark');
		} else {
			document.documentElement.classList.remove('dark');
			localStorage.setItem('oracle:theme', 'light');
		}
	}

	function checkPush() {
		const hasSW = 'serviceWorker' in navigator;
		const hasPM = 'PushManager' in window;
		const hasNotif = 'Notification' in window;

		if (!hasSW || !hasPM || !hasNotif) {
			pushState = 'unsupported';
			return;
		}

		if (Notification.permission === 'granted') {
			pushState = 'enabled';
			return;
		}

		pushState = 'ready';
	}

	async function enablePush() {
		pushState = 'enabling';
		pushError = null;
		try {
			const { subscribePush } = await import('$lib/push.js');
			await subscribePush();
			pushState = 'enabled';
		} catch (err) {
			pushError = (err as Error).message;
			pushState = 'error';
		}
	}
</script>

<div class="p-6 max-w-lg">
	<h1 class="text-2xl font-bold mb-6">Settings</h1>

	<section class="mb-8">
		<h2 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
			[APPEARANCE]
		</h2>
		<div class="flex items-center justify-between p-4 rounded-lg border border-border bg-card">
			<div>
				<p class="text-sm font-medium">Theme</p>
				<p class="text-xs text-muted-foreground mt-0.5">Switch between dark and light mode</p>
			</div>
			<button
				onclick={toggleTheme}
				class="p-2 rounded-md hover:bg-accent transition-colors"
				aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
				data-testid="theme-toggle"
			>
				{#if isDark}
					<Sun size={18} />
				{:else}
					<Moon size={18} />
				{/if}
			</button>
		</div>
	</section>

	<section class="mb-8">
		<h2 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
			[NOTIFICATIONS]
		</h2>
		<div class="p-4 rounded-lg border border-border bg-card">
			{#if pushState === 'enabled'}
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm font-medium">Push notifications</p>
						<p class="text-xs text-muted-foreground mt-0.5">Enabled — you'll get alerts when Alfred replies</p>
					</div>
					<Bell size={18} class="text-primary" />
				</div>
			{:else if pushState === 'ready'}
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm font-medium">Push notifications</p>
						<p class="text-xs text-muted-foreground mt-0.5">Get notified when Alfred replies</p>
					</div>
					<button
						onclick={enablePush}
						class="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium transition-opacity hover:opacity-90"
					>
						Enable
					</button>
				</div>
			{:else if pushState === 'enabling'}
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm font-medium">Push notifications</p>
						<p class="text-xs text-muted-foreground mt-0.5">Enabling...</p>
					</div>
				</div>
			{:else if pushState === 'error'}
				<div>
					<p class="text-sm font-medium">Push notifications</p>
					<p class="text-xs text-destructive mt-0.5">{pushError}</p>
					<button
						onclick={enablePush}
						class="mt-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium"
					>
						Retry
					</button>
				</div>
			{:else if pushState === 'unsupported'}
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm font-medium">Push notifications</p>
						<p class="text-xs text-muted-foreground mt-0.5">Not supported on this device/browser</p>
					</div>
					<BellOff size={18} class="text-muted-foreground" />
				</div>
			{:else}
				<!-- unknown state — show check button -->
				<div>
					<p class="text-sm font-medium">Push notifications</p>
					<p class="text-xs text-muted-foreground mt-0.5">Tap below to check if push is available</p>
					<button
						type="button"
						onclick={checkPush}
						class="mt-2 w-full px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium"
					>
						Check push support
					</button>
				</div>
			{/if}
		</div>
	</section>

	<section>
		<h2 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
			[ABOUT]
		</h2>
		<div class="p-4 rounded-lg border border-border bg-card space-y-2">
			<div class="flex justify-between text-sm">
				<span class="text-muted-foreground">Version</span>
				<span class="font-mono">{version}</span>
			</div>
			{#if buildSha}
				<div class="flex justify-between text-sm">
					<span class="text-muted-foreground">Build</span>
					<span class="font-mono text-xs">{buildSha.slice(0, 8)}</span>
				</div>
			{/if}
		</div>
	</section>
</div>
