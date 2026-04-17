<script lang="ts">
	import { ChevronDown, Plus } from 'lucide-svelte';
	import { dragHandleZone, dragHandle } from 'svelte-dnd-action';
	import type { Task } from '$lib/types/oracle-task.js';
	import TaskRow from './TaskRow.svelte';
	import TaskDetail from './TaskDetail.svelte';
	import NewTaskSheet from './NewTaskSheet.svelte';

	interface Props {
		tasks: Task[];
		slug: string;
		/** platform_ids.github_repo — forwarded to TaskDetail for the promote flow */
		githubRepo?: string;
	}

	const { tasks, slug, githubRepo }: Props = $props();

	// ── Local mutable task list ────────────────────────────────────────────────
	// Maintained separately so DnD reorders and optimistic patches don't
	// get overwritten until the next server reload.

	// localTasks is a mutable copy; $effect re-syncs it whenever the `tasks` prop changes
	// (e.g. after SSE-triggered server reload). The initializer captures the first value, which is fine.
	// svelte-ignore state_referenced_locally
	let localTasks: Task[] = $state([...tasks].sort((a, b) => a.sort_order - b.sort_order));

	$effect(() => {
		// Re-sync from server (SSE-triggered invalidate)
		localTasks = [...tasks].sort((a, b) => a.sort_order - b.sort_order);
	});

	// ── Section grouping ───────────────────────────────────────────────────────

	type Section = { name: string | null; tasks: Task[] };

	function buildSections(taskList: Task[]): Section[] {
		const map = new Map<string | null, Task[]>();

		for (const task of taskList) {
			const key = task.section ?? null;
			if (!map.has(key)) map.set(key, []);
			map.get(key)!.push(task);
		}

		// Sort sections deterministically by name (numeric-aware so
		// "Phase 0" < "Phase 1" < "Phase 2" etc.). Null/unsectioned last.
		return [...map.entries()]
			.map(([name, tasks]) => ({ name, tasks }))
			.sort((a, b) => {
				if (a.name === null) return 1;
				if (b.name === null) return -1;
				return a.name.localeCompare(b.name, undefined, { numeric: true });
			});
	}

	const sections = $derived(buildSections(localTasks));

	// ── Collapsible sections ───────────────────────────────────────────────────
	// Plain object instead of Map — Svelte 5's proxy-based reactivity
	// reliably tracks property access/mutation on plain objects.

	let collapsed: Record<string, boolean> = $state({});

	function collapseKey(name: string | null): string {
		return name ?? '__unsectioned__';
	}

	function toggleSection(name: string | null) {
		const key = collapseKey(name);
		collapsed[key] = !collapsed[key];
	}

	function isCollapsed(name: string | null): boolean {
		return collapsed[collapseKey(name)] ?? false;
	}

	// ── Optimistic patch from TaskRow ──────────────────────────────────────────

	function handleTaskPatch(taskId: string, patch: Partial<Task>) {
		localTasks = localTasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t));
	}

	// ── Drag-and-drop (svelte-dnd-action, within-section only) ────────────────

	const FLIP_MS = 200;

	// Each section uses a unique `type` so items cannot be dragged cross-section.
	function sectionType(name: string | null): string {
		return `task-section:${name ?? '__unsectioned__'}`;
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	function handleConsider(sectionName: string | null, e: any) {
		const items = e.detail.items as Task[];
		const others = localTasks.filter((t) => (t.section ?? null) !== sectionName);
		localTasks = [...others, ...items];
	}

	// ── Sheet state ───────────────────────────────────────────────────────────

	let selectedTask: Task | null = $state(null);
	let showNewTask = $state(false);

	function openDetail(task: Task) {
		selectedTask = task;
	}

	function closeDetail() {
		selectedTask = null;
	}

	function handleDetailPatch(taskId: string, patch: Partial<Task>) {
		handleTaskPatch(taskId, patch);
		// Keep selectedTask in sync so the sheet reflects the updated state
		if (selectedTask?.id === taskId) {
			selectedTask = { ...selectedTask, ...patch };
		}
	}

	function handleCreated(task: Task) {
		localTasks = [...localTasks, task];
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	async function handleFinalize(sectionName: string | null, e: any) {
		const reorderedItems = e.detail.items as Task[];
		const others = localTasks.filter((t) => (t.section ?? null) !== sectionName);
		localTasks = [...others, ...reorderedItems];

		// Patch sort_order for tasks whose position changed
		await Promise.all(
			reorderedItems.map((task, idx) => {
				if (task.sort_order === idx) return Promise.resolve();
				return fetch(`/api/projects/${slug}/tasks/${task.id}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ sort_order: idx })
				}).catch(() => {
					// Non-fatal: server reload via SSE will eventually correct order
				});
			})
		);
	}
</script>

<div class="p-6" data-testid="task-board">
	{#if localTasks.length === 0}
		<!-- Empty state -->
		<div class="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
			<p class="text-sm text-muted-foreground">No tasks yet. Create the first one.</p>
			<button
				type="button"
				onclick={() => {
					showNewTask = true;
				}}
				class="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
				aria-label="Create first task"
			>
				<Plus size={16} />
				New task
			</button>
		</div>
	{:else}
		<div class="flex flex-col gap-6">
			{#each sections as section (section.name)}
				<section aria-label={section.name ?? 'No section'}>
					<!-- Section header -->
					<button
						type="button"
						class="group mb-2 flex w-full items-center gap-2 text-left"
						onclick={() => toggleSection(section.name)}
						aria-expanded={!isCollapsed(section.name)}
					>
						<ChevronDown
							size={14}
							class="flex-shrink-0 text-muted-foreground transition-transform
								{isCollapsed(section.name) ? '-rotate-90' : ''}"
						/>
						<span
							class="text-xs font-semibold uppercase tracking-wide text-muted-foreground transition-colors group-hover:text-foreground"
						>
							{section.name ?? 'No section'}
						</span>
						<span class="text-xs text-muted-foreground">({section.tasks.length})</span>
					</button>

					<!-- Task rows with per-section DnD (no cross-section dragging) -->
					{#if !isCollapsed(section.name)}
						<ul
							class="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border"
							use:dragHandleZone={{
								items: section.tasks,
								flipDurationMs: FLIP_MS,
								type: sectionType(section.name),
								dropTargetStyle: {}
							}}
							onconsider={(e) => handleConsider(section.name, e)}
							onfinalize={(e) => handleFinalize(section.name, e)}
						>
							{#each section.tasks as task (task.id)}
								<li>
									<TaskRow
										{task}
										{slug}
										{dragHandle}
										onpatch={handleTaskPatch}
										onopen={openDetail}
									/>
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			{/each}
		</div>
	{/if}
</div>

<!-- FAB — always visible, opens NewTaskSheet -->
<button
	type="button"
	onclick={() => {
		showNewTask = true;
	}}
	class="fixed bottom-20 right-5 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-opacity hover:opacity-90 lg:bottom-6 lg:right-6"
	aria-label="Create new task"
>
	<Plus size={20} />
</button>

<!-- TaskDetail sheet (opens when a row is tapped) -->
{#if selectedTask}
	<TaskDetail
		task={selectedTask}
		{slug}
		{githubRepo}
		onclose={closeDetail}
		onpatch={handleDetailPatch}
	/>
{/if}

<!-- NewTaskSheet (opens via FAB) -->
{#if showNewTask}
	<NewTaskSheet
		{slug}
		onclose={() => {
			showNewTask = false;
		}}
		oncreate={handleCreated}
	/>
{/if}
