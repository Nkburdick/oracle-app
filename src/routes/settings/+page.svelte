<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { Sun, Moon, Bell, BellOff } from 'lucide-svelte';

	// Read version from package.json — injected at build time
	const version = __APP_VERSION__;
	const buildSha = import.meta.env.VITE_BUILD_SHA ?? null;

	let isDark = $state(false);

	// ── Push notification state ───────────────────────────────────────────────
	let pushSupported = $state(false);
	let pushEnabled = $state(false);
	let pushSubscribing = $state(false);
	let pushError = $state<string | null>(null);
	let pushDiag = $state('waiting...');

	onMount(() => {
		isDark = document.documentElement.classList.contains('dark');
		pushDiag = 'MOUNTED OK';
		// Direct DOM manipulation — bypasses Svelte entirely
		const el = document.getElementById('push-diag-direct');
		if (el) el.textContent = 'DIRECT DOM: onMount ran';
	});

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

	async function enablePush() {
		pushSubscribing = true;
		pushError = null;
		try {
			// Dynamic import — avoids breaking hydration if push.js has issues
			const { subscribePush } = await import('$lib/push.js');
			await subscribePush();
			pushEnabled = true;
		} catch (err) {
			pushError = (err as Error).message;
		} finally {
			pushSubscribing = false;
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
			{#if pushEnabled}
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm font-medium">Push notifications</p>
						<p class="text-xs text-muted-foreground mt-0.5">Enabled — you'll get alerts when Alfred replies</p>
					</div>
					<Bell size={18} class="text-primary" />
				</div>
			{:else if pushSupported}
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm font-medium">Push notifications</p>
						<p class="text-xs text-muted-foreground mt-0.5">Get notified when Alfred replies</p>
					</div>
					<button
						onclick={enablePush}
						disabled={pushSubscribing}
						class="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium disabled:opacity-50 transition-opacity hover:opacity-90"
					>
						{pushSubscribing ? 'Enabling...' : 'Enable'}
					</button>
				</div>
				{#if pushError}
					<p class="text-xs text-destructive mt-2">{pushError}</p>
				{/if}
			{:else}
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm font-medium">Push notifications</p>
						<p class="text-xs text-muted-foreground mt-0.5">
							Not available — open Oracle as an installed PWA to enable
						</p>
					</div>
					<BellOff size={18} class="text-muted-foreground" />
				</div>
			{/if}
			<button
				type="button"
				onclick={() => {
					const hasSW = 'serviceWorker' in navigator;
					const hasPM = 'PushManager' in window;
					const hasNotif = 'Notification' in window;
					const media = window.matchMedia('(display-mode: standalone)').matches;
					const nav = (navigator as unknown as { standalone?: boolean }).standalone === true;
					pushDiag = `SW:${hasSW} PM:${hasPM} media:${media} nav:${nav} Notif:${hasNotif}`;
				}}
				class="mt-2 w-full px-3 py-2 bg-accent text-foreground rounded-lg text-xs font-medium border border-border"
			>
				Tap to check push support
			</button>
			<p class="text-[10px] text-muted-foreground/60 mt-2 font-mono border-t border-border pt-2">{pushDiag}</p>
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
			<div class="text-[10px] text-muted-foreground font-mono break-all">
				svelte: {pushDiag}
			</div>
			<div id="push-diag-direct" class="text-[10px] text-destructive font-mono break-all">
				DIRECT DOM: not yet
			</div>
			<div id="push-diag-inline" class="text-[10px] text-green-500 font-mono break-all">
				INLINE: not yet
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

<svelte:head>
	{@html `<script>
		setTimeout(function() {
			var el = document.getElementById('push-diag-inline');
			if (el) {
				var hasSW = 'serviceWorker' in navigator;
				var hasPM = 'PushManager' in window;
				var media = window.matchMedia('(display-mode: standalone)').matches;
				var nav = !!(navigator.standalone);
				var notif = 'Notification' in window;
				el.textContent = 'SW:' + hasSW + ' PM:' + hasPM + ' media:' + media + ' nav:' + nav + ' Notif:' + notif;
			}
		}, 1000);
	</script>`}
</svelte:head>
