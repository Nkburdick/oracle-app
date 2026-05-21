<script lang="ts">
	import type { PageData } from './$types.js';
	import StatusIndicator from '$lib/components/StatusIndicator.svelte';

	const { data }: { data: PageData } = $props();
</script>

<div class="p-4">
	<a
		href="/projects"
		class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3"
		data-testid="archive-back-link"
	>
		<span>←</span>
		<span>Projects</span>
	</a>
	<h1 class="text-xl font-bold mb-4">Archive</h1>
	{#if data.projects.length === 0}
		<p class="text-sm text-muted-foreground">No completed projects yet.</p>
	{:else}
		<div class="flex flex-col gap-1">
			{#each data.projects as project (project.slug)}
				<a
					href="/projects/{project.slug}"
					class="flex items-center gap-3 px-3 py-2.5 rounded-md border border-border hover:bg-accent transition-colors"
					data-testid="archive-project"
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
	{/if}
</div>
