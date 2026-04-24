<script lang="ts">
	import { page } from '$app/stores';
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
	<!-- Page header — extends background into safe-area notch band; cancels main's pt-safe-area to avoid double-padding -->
	<header
		class="px-6 pb-4 border-b border-border flex-shrink-0"
		style="padding-top: calc(env(safe-area-inset-top, 0px) + 1rem); margin-top: calc(-1 * env(safe-area-inset-top, 0px));"
	>
		<!-- Title row: back arrow + full-width title (no truncation on narrow viewports) -->
		<div class="flex items-center gap-3">
			<a
				href="/projects"
				class="md:hidden text-muted-foreground hover:text-foreground flex-shrink-0">←</a
			>
			<h1 class="text-[28px] font-bold leading-tight">{fm.title}</h1>
		</div>
		<!-- Badge row: right-aligned, stacked below the fixed notification bell -->
		<div class="flex justify-end mt-1">
			<span
				class="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-semibold uppercase"
			>
				{fm.state}
			</span>
		</div>
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
