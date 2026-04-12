<script lang="ts">
	import { page } from '$app/stores';
	import { Home } from 'lucide-svelte';
</script>

<div class="flex flex-col items-center justify-center min-h-[60vh] px-6 py-12 text-center">
	<div class="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
		[ERROR {$page.status}]
	</div>
	<h1 class="text-[28px] font-bold mb-3">
		{#if $page.status === 404}
			Not found
		{:else}
			Something went wrong
		{/if}
	</h1>
	<p class="text-sm text-muted-foreground max-w-md mb-8">
		{#if $page.status === 404}
			The page you're looking for doesn't exist. It may have been moved, renamed, or you may have
			followed an outdated link.
		{:else}
			{$page.error?.message ?? 'An unexpected error occurred.'}
		{/if}
	</p>
	<a
		href="/"
		class="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
		data-testid="error-back-to-dashboard"
	>
		<Home size={14} />
		<span>Back to dashboard</span>
	</a>
</div>
