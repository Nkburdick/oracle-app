<script lang="ts">
	import type { PageData } from './$types.js';
	import { page } from '$app/stores';
	import { invalidate } from '$app/navigation';
	import { ExternalLink } from 'lucide-svelte';
	import ProjectChats from '$lib/components/ProjectChats.svelte';
	import PullToRefresh from '$lib/components/PullToRefresh.svelte';

	const { data }: { data: PageData } = $props();

	const project = $derived(data.project);
	const fm = $derived(project.frontmatter);
	const chat = $derived(data.chat);

	// Tab is driven by the ?view= search param so URLs are shareable and the
	// browser back/forward buttons work. The layout highlights the active tab
	// using the same param. Defaults to 'chats' (Loom #32).
	const view = $derived($page.url.searchParams.get('view') ?? 'chats');

	async function refreshProject() {
		await invalidate(`oracle:project:${fm.slug}`);
	}
</script>

{#if view === 'chats'}
	<!-- Loom #33: keying on slug forces a fresh ProjectChats mount when navigating
	     between same-shape routes (/projects/A → /projects/B). -->
	{#key fm.slug}
		<ProjectChats
			slug={fm.slug}
			initialThreads={chat.threads}
			initialMessages={chat.initialMessages}
			loaderError={chat.error}
		/>
	{/key}
{:else if view === 'artifacts'}
	<!-- Artifacts tab: Phase 2 placeholder -->
	<div class="p-6 flex items-center justify-center min-h-48">
		<p class="text-xs text-muted-foreground text-center">
			Artifacts — Phase 2<br />
			<span class="opacity-60">File management coming soon</span>
		</p>
	</div>
{:else if view === 'sow'}
	<!-- SOW tab — Loom #31: leading H1 hidden via prose modifier to avoid a
	     duplicate page title (the layout header already shows fm.title). -->
	<PullToRefresh onrefresh={refreshProject}>
		<div class="p-6" data-testid="sow-content">
			<div class="flex justify-end mb-4">
				<a
					href={project.githubEditUrl}
					target="_blank"
					rel="noopener noreferrer"
					class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
				>
					Edit in GitHub <ExternalLink size={12} />
				</a>
			</div>
			<article class="prose [&>h1:first-child]:hidden">
				{@html project.bodyHtml}
			</article>
		</div>
	</PullToRefresh>
{/if}
