<script lang="ts">
	import { onMount } from 'svelte';
	import { Sun, Moon } from 'lucide-svelte';

	// Read version from package.json — injected at build time
	const version = __APP_VERSION__;
	const buildSha = import.meta.env.VITE_BUILD_SHA ?? null;

	let isDark = $state(false);

	onMount(() => {
		isDark = document.documentElement.classList.contains('dark');
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
