<script lang="ts">
	import type { PageData } from './$types.js';
	import StatusIndicator from '$lib/components/StatusIndicator.svelte';

	const { data }: { data: PageData } = $props();
</script>

<div class="p-6">
	<h1 class="text-2xl font-bold mb-1">oracle</h1>
	<p class="text-xs text-muted-foreground mb-6">personal operations dashboard</p>

	{#if data.projects.length === 0}
		<div class="text-center py-16 text-muted-foreground">
			<p class="text-sm">No projects found.</p>
			<p class="text-xs mt-2">Create one via Pennyworth.</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
			{#each data.projects as project (project.slug)}
				<a
					href="/projects/{project.slug}"
					class="block p-4 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors group"
					data-testid="project-card"
				>
					<!-- Header row: status + name -->
					<div class="flex items-center gap-2 mb-1">
						<StatusIndicator state={project.state} size={6} />
						<span class="text-sm font-semibold truncate text-foreground">{project.title}</span>
					</div>

					<!-- Phase subtitle -->
					{#if project.phase}
						<p class="text-xs text-muted-foreground mb-3 truncate pl-4">{project.phase}</p>
					{:else}
						<div class="mb-3"></div>
					{/if}

					<!-- Progress bar + % -->
					<div class="flex items-center gap-2">
						<div class="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
							<div
								class="h-full rounded-full bg-primary transition-all"
								style="width: {project.dodStats.percent}%"
							></div>
						</div>
						<span class="text-xs text-muted-foreground w-8 text-right tabular-nums">
							{project.dodStats.percent}%
						</span>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>
