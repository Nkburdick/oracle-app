<script lang="ts">
	import type { PageData } from './$types.js';
	import StatusIndicator from '$lib/components/StatusIndicator.svelte';

	const { data }: { data: PageData } = $props();
</script>

<div class="p-4">
	<h1 class="text-xl font-bold mb-4">Areas</h1>
	<div class="flex flex-col gap-1">
		{#each data.areas as area (area.slug)}
			<a
				href="/areas/{area.slug}"
				class="flex items-center gap-3 px-3 py-2.5 rounded-md border border-border hover:bg-accent transition-colors"
				data-testid="sidebar-area"
			>
				<StatusIndicator state="area" size={6} />
				<span class="text-sm">{area.slug}</span>
			</a>
		{/each}
	</div>
</div>
