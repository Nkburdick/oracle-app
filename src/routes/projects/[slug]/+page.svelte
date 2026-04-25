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
	const status = $derived(data.status);
	const decisions = $derived(data.decisions);

	// Tab is driven by the ?view= search param so URLs are shareable and the
	// browser back/forward buttons work. The layout highlights the active tab
	// using the same param. Defaults to 'chats' (Loom #32).
	const view = $derived($page.url.searchParams.get('view') ?? 'chats');

	// GitHub create-new-file URLs for empty-state CTAs. The same /edit/ path
	// works whether the file exists or not — GitHub creates a new file when
	// the path doesn't resolve.
	const createStatusUrl = $derived(
		`https://github.com/Nkburdick/ORACLE/new/main/Projects/${fm.slug}?filename=STATUS.md`
	);
	const createDecisionsUrl = $derived(
		`https://github.com/Nkburdick/ORACLE/new/main/Projects/${fm.slug}?filename=DECISIONS.md`
	);

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
{:else if view === 'status'}
	<!--
		Status tab — renders STATUS.md (Layer 4 of the 4-tier doc framework).
		"Read first when picking up work." Most projects don't have STATUS.md
		yet — fall through to a friendly empty state with a one-tap "Create"
		link that opens GitHub's new-file dialog pre-filled with the path.
	-->
	<PullToRefresh onrefresh={refreshProject}>
		<div class="p-6" data-testid="status-content">
			{#if status}
				<div class="flex justify-end mb-4">
					<a
						href={status.githubEditUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
					>
						Edit in GitHub <ExternalLink size={12} />
					</a>
				</div>
				<article class="prose [&>h1:first-child]:hidden">
					{@html status.bodyHtml}
				</article>
			{:else}
				<div class="flex flex-col items-center justify-center py-12 text-center max-w-md mx-auto">
					<h2 class="text-base font-semibold text-foreground mb-2">No STATUS.md yet</h2>
					<p class="text-sm text-muted-foreground mb-1">
						This project hasn't adopted the 4-tier doc framework.
					</p>
					<p class="text-xs text-muted-foreground mb-6 leading-relaxed">
						<code class="text-foreground">STATUS.md</code> is the live state doc — Right Now,
						Next 3 Actions, Active Sessions, Blocked, Findings, Log. Updated every session.
					</p>
					<a
						href={createStatusUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="flex items-center gap-1.5 text-sm text-primary hover:underline"
					>
						Create STATUS.md on GitHub <ExternalLink size={14} />
					</a>
				</div>
			{/if}
		</div>
	</PullToRefresh>
{:else if view === 'decisions'}
	<!--
		Decisions tab — renders DECISIONS.md (Layer 2 of the 4-tier doc framework).
		Append-only project memory: what we decided and why. Empty state mirrors
		the Status tab's pattern.
	-->
	<PullToRefresh onrefresh={refreshProject}>
		<div class="p-6" data-testid="decisions-content">
			{#if decisions}
				<div class="flex justify-end mb-4">
					<a
						href={decisions.githubEditUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
					>
						Edit in GitHub <ExternalLink size={12} />
					</a>
				</div>
				<article class="prose [&>h1:first-child]:hidden">
					{@html decisions.bodyHtml}
				</article>
			{:else}
				<div class="flex flex-col items-center justify-center py-12 text-center max-w-md mx-auto">
					<h2 class="text-base font-semibold text-foreground mb-2">No DECISIONS.md yet</h2>
					<p class="text-sm text-muted-foreground mb-1">
						This project hasn't adopted the 4-tier doc framework.
					</p>
					<p class="text-xs text-muted-foreground mb-6 leading-relaxed">
						<code class="text-foreground">DECISIONS.md</code> is append-only project memory —
						each entry is Decision / Rationale / What changed.
					</p>
					<a
						href={createDecisionsUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="flex items-center gap-1.5 text-sm text-primary hover:underline"
					>
						Create DECISIONS.md on GitHub <ExternalLink size={14} />
					</a>
				</div>
			{/if}
		</div>
	</PullToRefresh>
{/if}
