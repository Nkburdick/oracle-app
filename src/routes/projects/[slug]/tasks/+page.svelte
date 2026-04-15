<script lang="ts">
	import type { PageData } from './$types.js';
	import TaskBoard from '$lib/components/TaskBoard.svelte';

	const { data }: { data: PageData } = $props();
</script>

<TaskBoard
	tasks={data.tasks}
	slug={data.project.frontmatter.slug}
	githubRepo={data.project.frontmatter.platform_ids?.github_repo}
/>
