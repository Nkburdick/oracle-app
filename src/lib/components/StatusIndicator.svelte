<script lang="ts">
	import type { ProjectState } from '$lib/types/oracle.js';

	interface Props {
		state: ProjectState | 'area';
		size?: number;
	}

	const { state, size = 6 }: Props = $props();
</script>

{#if state === 'active'}
	<!-- filled disc, foreground color -->
	<span
		class="inline-block rounded-full bg-foreground flex-shrink-0"
		style="width: {size}px; height: {size}px;"
		aria-label="active"
	></span>
{:else if state === 'planning'}
	<!-- outlined circle, foreground color -->
	<span
		class="inline-block rounded-full border border-foreground flex-shrink-0"
		style="width: {size}px; height: {size}px;"
		aria-label="planning"
	></span>
{:else if state === 'paused'}
	<!-- filled disc, muted color -->
	<span
		class="inline-block rounded-full bg-muted-foreground flex-shrink-0"
		style="width: {size}px; height: {size}px;"
		aria-label="paused"
	></span>
{:else if state === 'complete'}
	<!-- checkmark, muted color -->
	<span
		class="inline-block text-muted-foreground leading-none flex-shrink-0"
		style="font-size: {size + 4}px; line-height: 1;"
		aria-label="complete">✓</span
	>
{:else if state === 'area'}
	<!-- outlined square, muted color -->
	<span
		class="inline-block text-muted-foreground leading-none flex-shrink-0"
		style="font-size: {size + 4}px; line-height: 1;"
		aria-label="area">▢</span
	>
{/if}
