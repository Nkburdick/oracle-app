<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidate } from '$app/navigation';
	import type { PageData } from './$types.js';
	import TaskBoard from '$lib/components/TaskBoard.svelte';

	const { data }: { data: PageData } = $props();

	const slug = data.project.frontmatter.slug;

	onMount(() => {
		const es = new EventSource('/api/events');

		es.addEventListener('message', (event) => {
			try {
				const evt = JSON.parse(event.data) as { type: string; slug: string };
				if (evt.type === 'tasks-updated' && evt.slug === slug) {
					invalidate(`oracle:tasks:${slug}`);
				}
			} catch {
				// ignore malformed events
			}
		});

		es.onerror = () => {
			// EventSource auto-reconnects
		};

		return () => es.close();
	});
</script>

<TaskBoard
	tasks={data.tasks}
	slug={data.project.frontmatter.slug}
	githubRepo={data.project.frontmatter.platform_ids?.github_repo}
/>
