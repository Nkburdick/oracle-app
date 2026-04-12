<script lang="ts">
	import { Sun, Moon } from 'lucide-svelte';
	import { onMount } from 'svelte';

	let isDark = $state(false);

	onMount(() => {
		isDark = document.documentElement.classList.contains('dark');
	});

	function toggle() {
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

<button
	onclick={toggle}
	class="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
	aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
	data-testid="theme-toggle"
>
	{#if isDark}
		<Sun size={15} />
	{:else}
		<Moon size={15} />
	{/if}
</button>
