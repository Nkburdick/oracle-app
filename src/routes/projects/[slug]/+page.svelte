<script lang="ts">
	import type { PageData } from './$types.js';
	import { ExternalLink } from 'lucide-svelte';
	import ProjectChats from '$lib/components/ProjectChats.svelte';

	const { data }: { data: PageData } = $props();

	const project = $derived(data.project);
	const fm = $derived(project.frontmatter);
	const chat = $derived(data.chat);

	// Tab state — default to Chats (Loom #32). Phase 2.B Minimal Chat shipped
	// chat as the primary surface; users want to land in chat, not in SOW.
	//
	// SvelteKit reuses this +page.svelte component instance when navigating
	// between /projects/A → /projects/B (same route shape), so $state
	// initializers only run once on first mount. Without an explicit reset,
	// switching projects would carry forward whatever tab the user last
	// clicked (e.g. SOW). The $effect below reads fm.slug so it re-runs
	// whenever the slug changes, resetting the tab to the default.
	// CodeRabbit finding on PR #36 — same root cause as the ProjectChats
	// reactivity fix, applied to the parent page component.
	type Tab = 'chats' | 'artifacts' | 'sow';
	let activeTab: Tab = $state('chats');

	$effect(() => {
		// Read the slug so the effect re-runs on slug navigation
		fm.slug;
		activeTab = 'chats';
	});
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
	<div class="flex border-b border-border px-6 flex-shrink-0">
		<button
			onclick={() => {
				activeTab = 'chats';
			}}
			class="px-4 py-2.5 text-sm transition-colors relative
				{activeTab === 'chats' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}"
			title="Phase 2"
		>
			Chats
			{#if activeTab === 'chats'}
				<span class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t"></span>
			{/if}
		</button>
		<button
			onclick={() => {
				activeTab = 'artifacts';
			}}
			class="px-4 py-2.5 text-sm transition-colors relative
				{activeTab === 'artifacts' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}"
			title="Phase 2"
		>
			Artifacts
			{#if activeTab === 'artifacts'}
				<span class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t"></span>
			{/if}
		</button>
		<button
			onclick={() => {
				activeTab = 'sow';
			}}
			class="px-4 py-2.5 text-sm transition-colors relative
				{activeTab === 'sow' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}"
		>
			SOW
			{#if activeTab === 'sow'}
				<span class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t"></span>
			{/if}
		</button>
	</div>

	<!-- Tab content -->
	<div class="flex-1 overflow-y-auto">
		{#if activeTab === 'chats'}
			<!-- Loom #33 fix: SvelteKit reuses the page component when navigating
			     between same-shape routes (/projects/A → /projects/B), so without
			     a {#key} block here, ProjectChats keeps its mount-time local state
			     (threads, messages, activeThreadId) and renders project A's data
			     while showing project B's page. Keying on fm.slug forces a fresh
			     mount of ProjectChats whenever the project changes, which re-runs
			     the seed initializers against the new loader props. -->
			{#key fm.slug}
				<ProjectChats
					slug={fm.slug}
					initialThreads={chat.threads}
					initialMessages={chat.initialMessages}
					loaderError={chat.error}
				/>
			{/key}
		{:else if activeTab === 'artifacts'}
			<!-- Artifacts tab: Phase 2 placeholder -->
			<div class="p-6 flex items-center justify-center min-h-48">
				<p class="text-xs text-muted-foreground text-center">
					Artifacts — Phase 2<br />
					<span class="opacity-60">File management coming soon</span>
				</p>
			</div>
		{:else}
			<!-- SOW tab — Loom #31: removed redundant metadata card. The same
			     state/owner/dates/platform-IDs information is rendered (better
			     formatted) in the markdown body itself under Status and the
			     Platform IDs table. The leading H1 in the rendered markdown is
			     hidden via the prose modifier below to avoid a duplicate page
			     title (the page header already shows fm.title). -->
			<div class="p-6" data-testid="sow-content">
				<article class="prose [&>h1:first-child]:hidden">
					{@html project.bodyHtml}
				</article>
			</div>
		{/if}
	</div>
</div>
