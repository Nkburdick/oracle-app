<script lang="ts">
	import { page } from '$app/stores';
	import { Settings } from 'lucide-svelte';
	import StatusIndicator from './StatusIndicator.svelte';
	import ThemeToggle from './ThemeToggle.svelte';
	import type { SidebarItem } from '$lib/types/oracle.js';

	interface Props {
		projects: SidebarItem[];
		areas: SidebarItem[];
	}

	const { projects, areas }: Props = $props();

	const currentPath = $derived($page.url.pathname);

	function isActiveProject(slug: string) {
		return currentPath === `/projects/${slug}`;
	}

	function isActiveArea(slug: string) {
		return currentPath === `/areas/${slug}`;
	}

	const isDashboard = $derived(currentPath === '/');
</script>

<aside
	class="hidden md:flex flex-col w-[260px] min-h-screen border-r border-border bg-card flex-shrink-0"
	aria-label="Navigation"
>
	<!-- Logo -->
	<div class="px-4 pt-4 pb-3 border-b border-border">
		<a
			href="/"
			class="flex items-center gap-2 text-foreground hover:text-foreground no-underline group"
		>
			<span
				class="text-xs font-semibold text-muted-foreground group-hover:text-primary transition-colors"
				>[O]</span
			>
			<span class="text-sm font-bold tracking-tight">Oracle</span>
		</a>
	</div>

	<!-- Search placeholder (future) -->
	<div class="px-4 py-2 border-b border-border">
		<div class="h-6"></div>
	</div>

	<!-- Navigation content -->
	<nav class="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-0.5">
		<!-- Dashboard link -->
		<a
			href="/"
			class="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors
				{isDashboard
				? 'bg-secondary/20 text-foreground border-l-[3px] border-l-primary pl-[5px]'
				: 'text-muted-foreground hover:text-foreground hover:bg-accent'}"
			data-testid="nav-dashboard"
		>
			<span class="text-xs">◈</span>
			<span>Dashboard</span>
		</a>

		<!-- Projects section -->
		<div class="mt-3 mb-1 px-2">
			<span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
				>[PROJECTS]</span
			>
		</div>

		{#each projects as project (project.slug)}
			<a
				href="/projects/{project.slug}"
				class="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors group
					{isActiveProject(project.slug)
					? 'bg-secondary/20 text-foreground border-l-[3px] border-l-primary pl-[5px]'
					: 'text-muted-foreground hover:text-foreground hover:bg-accent'}"
				data-testid="sidebar-project"
			>
				<StatusIndicator state={project.state} size={6} />
				<span class="truncate">{project.title}</span>
			</a>
		{/each}

		<!-- Areas section -->
		<div class="mt-4 mb-1 px-2">
			<span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
				>[AREAS]</span
			>
		</div>

		{#each areas as area (area.slug)}
			<a
				href="/areas/{area.slug}"
				class="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors
					{isActiveArea(area.slug)
					? 'bg-secondary/20 text-foreground border-l-[3px] border-l-primary pl-[5px]'
					: 'text-muted-foreground hover:text-foreground hover:bg-accent'}"
				data-testid="sidebar-area"
			>
				<StatusIndicator state="area" size={6} />
				<span class="truncate">{area.title}</span>
			</a>
		{/each}

		<!-- Spacer -->
		<div class="flex-1"></div>
	</nav>

	<!-- Footer: Settings + Theme Toggle -->
	<div class="px-2 py-2 border-t border-border flex items-center gap-1">
		<a
			href="/settings"
			class="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex-1"
		>
			<Settings size={14} />
			<span>Settings</span>
		</a>
		<ThemeToggle />
	</div>
</aside>
