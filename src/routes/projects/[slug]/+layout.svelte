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

	// Tab is driven by the `?view=` search param (or /tasks sub-route). Tasks
	// is the default landing tab — bare /projects/[slug] redirects to /tasks.
	const activeTab = $derived(
		$page.url.pathname.endsWith('/tasks')
			? 'tasks'
			: ((): string => {
					const view = $page.url.searchParams.get('view');
					if (view === 'decisions') return 'decisions';
					if (view === 'sow') return 'sow';
					if (view === 'artifacts') return 'artifacts';
					if (view === 'status') return 'status';
					return 'tasks';
				})()
	);

	// Tab order: Tasks (default) → Status (read-first per 4-tier framework) →
	// SOW (slim plan) → Decisions (history) → Artifacts.
	const tabs = $derived([
		{ id: 'tasks', label: 'Tasks', href: `/projects/${fm.slug}/tasks` },
		{ id: 'status', label: 'Status', href: `/projects/${fm.slug}?view=status` },
		{ id: 'sow', label: 'SOW', href: `/projects/${fm.slug}?view=sow` },
		{ id: 'decisions', label: 'Decisions', href: `/projects/${fm.slug}?view=decisions` },
		{ id: 'artifacts', label: 'Artifacts', href: `/projects/${fm.slug}?view=artifacts` }
	]);
</script>

<div class="project-layout flex flex-col h-full">
	<!-- Page header — extends background into safe-area notch band; cancels main's pt-safe-area to avoid double-padding -->
	<header
		class="project-chrome px-6 pb-4 border-b border-border flex-shrink-0"
		style="padding-top: calc(env(safe-area-inset-top, 0px) + 1rem); margin-top: calc(-1 * env(safe-area-inset-top, 0px));"
	>
		<!-- Title row: back arrow + title. Responsive size to keep the header compact
		     on mobile viewports; line-clamp-2 so long titles don't push the rest of
		     the header off-screen. -->
		<div class="flex items-center gap-3 min-w-0">
			<a
				href="/projects"
				class="md:hidden text-muted-foreground hover:text-foreground flex-shrink-0">←</a
			>
			<h1 class="text-lg md:text-[28px] font-bold leading-tight line-clamp-2 min-w-0">
				{fm.title}
			</h1>
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

	<!--
		Tab bar. 6 tabs overflow the mobile viewport (~327px usable after px-6
		padding) so the row scrolls horizontally on small screens. Active tab
		auto-scrolls into view via `scroll-margin-inline`. iOS gets momentum
		scroll for free.
	-->
	<nav
		class="project-chrome flex border-b border-border px-6 flex-shrink-0 overflow-x-auto scrollbar-none"
		style="scroll-padding-inline: 1.5rem;"
		aria-label="Project sections"
	>
		{#each tabs as tab (tab.id)}
			<a
				href={tab.href}
				class="px-4 py-2.5 text-sm transition-colors relative whitespace-nowrap flex-shrink-0
					{activeTab === tab.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}"
				style="scroll-margin-inline: 1.5rem;"
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

	<!--
		Tab content. `min-h-0` is required so flex-1 children can actually
		shrink — without it, `h-full` on descendants resolves to content
		height (not viewport), which on desktop makes the chat composer
		float mid-page instead of pinning to the viewport bottom.
	-->
	<div class="flex-1 min-h-0 overflow-y-auto">
		{@render children()}
	</div>
</div>
