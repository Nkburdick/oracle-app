<script lang="ts">
	import type { PageData } from './$types.js';
	import StatusIndicator from '$lib/components/StatusIndicator.svelte';

	const { data }: { data: PageData } = $props();
</script>

<div class="p-4">
	<h1 class="text-xl font-bold mb-4">Projects</h1>
	<div class="flex flex-col gap-1">
		{#each data.projects as project (project.slug)}
			<a
				href="/projects/{project.slug}"
				class="flex items-center gap-3 px-3 py-2.5 rounded-md border border-border hover:bg-accent transition-colors"
				data-testid="sidebar-project"
			>
				<StatusIndicator state={project.state} size={6} />
				<span class="text-sm">{project.slug}</span>
				{#if project.subtitle}
					<span class="text-xs text-muted-foreground ml-auto truncate max-w-32"
						>{project.subtitle}</span
					>
				{/if}
			</a>
		{/each}
	</div>
</div>
