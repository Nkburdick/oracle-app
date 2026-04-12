<script lang="ts">
	import type { PageData } from './$types.js';
	import { ExternalLink } from 'lucide-svelte';
	import ProjectChats from '$lib/components/ProjectChats.svelte';

	const { data }: { data: PageData } = $props();

	const area = $derived(data.area);
	const fm = $derived(area.frontmatter);
	const chat = $derived(data.chat);

	// Loom #32: default to Chats tab (matches projects page behavior).
	//
	// SvelteKit reuses this +page.svelte component instance when navigating
	// between /areas/A → /areas/B (same route shape), so $state initializers
	// only run once on first mount. Without an explicit reset, switching
	// areas would carry forward whatever tab the user last clicked.
	// CodeRabbit finding on PR #36.
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
			<a href="/areas" class="md:hidden text-muted-foreground hover:text-foreground mr-1">←</a>
			<h1 class="text-[28px] font-bold truncate">{fm.title}</h1>
			<span
				class="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-semibold uppercase flex-shrink-0"
			>
				AREA
			</span>
		</div>
		<a
			href={area.githubEditUrl}
			target="_blank"
			rel="noopener noreferrer"
			class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground flex-shrink-0 mt-1"
		>
			Edit in GitHub <ExternalLink size={12} />
		</a>
	</header>

	<!-- Tab bar -->
	<div class="flex border-b border-border px-6 flex-shrink-0">
		{#each ['chats', 'artifacts', 'sow'] as const as tab}
			<button
				onclick={() => {
					activeTab = tab;
				}}
				class="px-4 py-2.5 text-sm transition-colors relative capitalize
					{activeTab === tab ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}"
				title={tab !== 'sow' ? 'Phase 2' : undefined}
			>
				{tab}
				{#if activeTab === tab}
					<span class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t"></span>
				{/if}
			</button>
		{/each}
	</div>

	<!-- Tab content -->
	<div class="flex-1 overflow-y-auto">
		{#if activeTab === 'chats'}
			{#key fm.slug}
				<ProjectChats
					slug={fm.slug}
					initialThreads={chat.threads}
					initialMessages={chat.initialMessages}
					loaderError={chat.error}
					apiBasePath="/api/areas"
					routePrefix="areas"
				/>
			{/key}
		{:else if activeTab === 'artifacts'}
			<div class="p-6 flex items-center justify-center min-h-48">
				<p class="text-xs text-muted-foreground">Artifacts — Phase 2</p>
			</div>
		{:else}
			<!-- SOW tab — Loom #31: removed redundant metadata card. Same fix
			     as the projects/[slug] page. -->
			<div class="p-6" data-testid="sow-content">
				<article class="prose [&>h1:first-child]:hidden">
					{@html area.bodyHtml}
				</article>
			</div>
		{/if}
	</div>
</div>
