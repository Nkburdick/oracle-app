<script lang="ts">
	import { page } from '$app/stores';
	import { Settings } from 'lucide-svelte';
	import StatusIndicator from './StatusIndicator.svelte';
	import ThemeToggle from './ThemeToggle.svelte';
	import type { SidebarItem } from '$lib/types/oracle.js';

	interface Props {
		projects: SidebarItem[];
		deferred?: SidebarItem[];
		areas: SidebarItem[];
		archived?: SidebarItem[];
	}

	const { projects, deferred = [], areas, archived = [] }: Props = $props();

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

		<!-- Projects section (collapsible, default open) -->
		<details open class="group/projects mt-3" data-testid="sidebar-section-projects">
			<summary
				class="flex items-center gap-1 mb-1 px-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden hover:text-foreground"
			>
				<span
					class="text-[10px] text-muted-foreground transition-transform group-open/projects:rotate-90"
					>▸</span
				>
				<span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
					>[ACTIVE PROJECTS]</span
				>
			</summary>
			<div class="flex flex-col gap-0.5">
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
			</div>
		</details>

		<!-- Deferred Projects section (collapsible, default closed). Parked-but-not-lost
		     work, mirrors the Todoist Active/Deferred split. Only shown when non-empty. -->
		{#if deferred.length > 0}
			<details class="group/deferred mt-4" data-testid="sidebar-section-deferred">
				<summary
					class="flex items-center gap-1 mb-1 px-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden hover:text-foreground"
				>
					<span
						class="text-[10px] text-muted-foreground transition-transform group-open/deferred:rotate-90"
						>▸</span
					>
					<span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
						>[DEFERRED PROJECTS] ({deferred.length})</span
					>
				</summary>
				<div class="flex flex-col gap-0.5">
					{#each deferred as project (project.slug)}
						<a
							href="/projects/{project.slug}"
							class="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors opacity-70 hover:opacity-100
								{isActiveProject(project.slug)
								? 'bg-secondary/20 text-foreground border-l-[3px] border-l-primary pl-[5px]'
								: 'text-muted-foreground hover:text-foreground hover:bg-accent'}"
							data-testid="sidebar-deferred-project"
						>
							<StatusIndicator state={project.state} size={6} />
							<span class="truncate">{project.title}</span>
						</a>
					{/each}
				</div>
			</details>
		{/if}

		<!-- Areas section (collapsible, default open) -->
		<details open class="group/areas mt-4" data-testid="sidebar-section-areas">
			<summary
				class="flex items-center gap-1 mb-1 px-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden hover:text-foreground"
			>
				<span
					class="text-[10px] text-muted-foreground transition-transform group-open/areas:rotate-90"
					>▸</span
				>
				<span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
					>[AREAS]</span
				>
			</summary>
			<div class="flex flex-col gap-0.5">
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
			</div>
		</details>

		<!-- Archive section (collapsible, default closed). Only shown when at
		     least one project is in the `completed` state. -->
		{#if archived.length > 0}
			<details class="group/archive mt-4" data-testid="sidebar-section-archive">
				<summary
					class="flex items-center gap-1 mb-1 px-2 cursor-pointer list-none [&::-webkit-details-marker]:hidden hover:text-foreground"
				>
					<span
						class="text-[10px] text-muted-foreground transition-transform group-open/archive:rotate-90"
						>▸</span
					>
					<span class="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
						>[ARCHIVE] ({archived.length})</span
					>
				</summary>
				<div class="flex flex-col gap-0.5">
					{#each archived as project (project.slug)}
						<a
							href="/projects/{project.slug}"
							class="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors opacity-70 hover:opacity-100
								{isActiveProject(project.slug)
								? 'bg-secondary/20 text-foreground border-l-[3px] border-l-primary pl-[5px]'
								: 'text-muted-foreground hover:text-foreground hover:bg-accent'}"
							data-testid="sidebar-archive-project"
						>
							<StatusIndicator state={project.state} size={6} />
							<span class="truncate">{project.title}</span>
						</a>
					{/each}
				</div>
			</details>
		{/if}

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
