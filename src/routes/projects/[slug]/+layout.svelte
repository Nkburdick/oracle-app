<script lang="ts">
	import { page } from '$app/stores';
	import { ExternalLink } from 'lucide-svelte';
	import type { LayoutData } from './$types.js';

	interface Props {
		data: LayoutData;
		children: import('svelte').Snippet;
	}

	const { data, children }: Props = $props();

	const project = $derived(data.project);
	const fm = $derived(project.frontmatter);

	const activeTab = $derived(
		$page.url.pathname.endsWith('/tasks')
			? 'tasks'
			: $page.url.searchParams.get('view') === 'artifacts'
				? 'artifacts'
				: $page.url.searchParams.get('view') === 'sow'
					? 'sow'
					: 'chats'
	);

	const tabs = $derived([
		{ id: 'chats', label: 'Chats', href: `/projects/${fm.slug}` },
		{ id: 'artifacts', label: 'Artifacts', href: `/projects/${fm.slug}?view=artifacts` },
		{ id: 'sow', label: 'SOW', href: `/projects/${fm.slug}?view=sow` },
		{ id: 'tasks', label: 'Tasks', href: `/projects/${fm.slug}/tasks` }
	]);
</script>

<div class="flex flex-col h-full">
	<!-- Page header -->
	<header
		class="px-6 py-4 border-b border-border flex items-start justify-between gap-4 flex-shrink-0"
	>
		<div class="flex items-center gap-3 min-w-0">
			<a href="/projects" class="md:hidden text-muted-foreground hover:text-foreground mr-1">←</a>
			<h1 class="text-[28px] font-bold truncate">{fm.title}</h1>
			<span
				class="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-semibold uppercase flex-shrink-0"
			>
				{fm.state}
			</span>
		</div>
		<a
			href={project.githubEditUrl}
			target="_blank"
			rel="noopener noreferrer"
			class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground flex-shrink-0 mt-1"
		>
			Edit in GitHub <ExternalLink size={12} />
		</a>
	</header>

	<!-- Tab bar -->
	<nav class="flex border-b border-border px-6 flex-shrink-0" aria-label="Project sections">
		{#each tabs as tab (tab.id)}
			<a
				href={tab.href}
				class="px-4 py-2.5 text-sm transition-colors relative
					{activeTab === tab.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}"
				aria-current={activeTab === tab.id ? 'page' : undefined}
			>
				{tab.label}
				{#if activeTab === tab.id}
					<span
						class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t"
						aria-hidden="true"
					></span>
				{/if}
			</a>
		{/each}
	</nav>

	<!-- Tab content -->
	<div class="flex-1 overflow-y-auto">
		{@render children()}
	</div>
</div>
