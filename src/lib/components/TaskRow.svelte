<script lang="ts">
	import { GripVertical, GitBranch, CheckCircle2 } from 'lucide-svelte';
	import type { Action } from 'svelte/action';
	import type { Task, TaskStatus, TaskAssignee } from '$lib/types/oracle-task.js';

	interface Props {
		task: Task;
		slug: string;
		/** svelte-dnd-action dragHandle action — restricts drag to the grip icon */
		dragHandle?: Action;
		/** Optimistic-update callback so the parent can track mutations */
		onpatch?: (id: string, patch: Partial<Task>) => void;
		/** Called when the user taps the task content to open the detail sheet */
		onopen?: (task: Task) => void;
	}

	const { task, slug, dragHandle, onpatch, onopen }: Props = $props();

	// ── Status helpers ────────────────────────────────────────────────────────

	const STATUS_ORDER: TaskStatus[] = ['backlog', 'ready', 'in_progress', 'review', 'done'];

	const STATUS_LABELS: Record<TaskStatus, string> = {
		backlog: 'Backlog',
		ready: 'Ready',
		in_progress: 'In progress',
		review: 'Review',
		done: 'Done'
	};

	const STATUS_COLORS: Record<TaskStatus, string> = {
		backlog: 'bg-muted text-muted-foreground',
		ready: 'bg-secondary/20 text-secondary',
		in_progress: 'bg-primary/15 text-primary',
		review: 'bg-accent text-accent-foreground border border-border',
		done: 'bg-muted text-muted-foreground'
	};

	// ── Assignee helpers ──────────────────────────────────────────────────────

	const ASSIGNEES: TaskAssignee[] = ['nick', 'alfred', 'pennyworth', 'forge'];

	const ASSIGNEE_COLORS: Record<TaskAssignee, string> = {
		nick: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
		alfred: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
		pennyworth: 'bg-secondary/15 text-secondary',
		forge: 'bg-primary/15 text-primary'
	};

	// ── Optimistic state ──────────────────────────────────────────────────────
	// Initializers intentionally capture the initial prop value; $effects below
	// resync whenever the parent re-renders with updated server data.

	// svelte-ignore state_referenced_locally
	let optimisticStatus: TaskStatus = $state(task.status);
	// svelte-ignore state_referenced_locally
	let optimisticAssignee: TaskAssignee = $state(task.assignee);

	// Resync when the server reloads the task
	$effect(() => {
		optimisticStatus = task.status;
	});
	$effect(() => {
		optimisticAssignee = task.assignee;
	});

	// ── API call ──────────────────────────────────────────────────────────────

	async function patchField(patch: Partial<Task>, revert: () => void) {
		try {
			const res = await fetch(`/api/projects/${slug}/tasks/${task.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(patch)
			});
			if (!res.ok) revert();
		} catch {
			revert();
		}
	}

	// ── Status cycling ────────────────────────────────────────────────────────

	function cycleStatus(e: MouseEvent) {
		e.stopPropagation();
		const prev = optimisticStatus;
		const next = STATUS_ORDER[(STATUS_ORDER.indexOf(prev) + 1) % STATUS_ORDER.length];
		optimisticStatus = next;
		onpatch?.(task.id, { status: next });
		patchField({ status: next }, () => {
			optimisticStatus = prev;
			onpatch?.(task.id, { status: prev });
		});
	}

	// ── Assignee dropdown ─────────────────────────────────────────────────────

	let showAssigneeDropdown = $state(false);

	function toggleAssigneeDropdown(e: MouseEvent) {
		e.stopPropagation();
		showAssigneeDropdown = !showAssigneeDropdown;
	}

	function selectAssignee(e: MouseEvent, a: TaskAssignee) {
		e.stopPropagation();
		const prev = optimisticAssignee;
		optimisticAssignee = a;
		showAssigneeDropdown = false;
		onpatch?.(task.id, { assignee: a });
		patchField({ assignee: a }, () => {
			optimisticAssignee = prev;
			onpatch?.(task.id, { assignee: prev });
		});
	}

	function closeDropdown() {
		showAssigneeDropdown = false;
	}

	// ── Swipe-right-to-complete ────────────────────────────────────────────────

	const SWIPE_THRESHOLD = 80;

	let swipeStartX = $state(0);
	let swipeOffsetX = $state(0);
	let isSwiping = $state(false);

	// Undo toast state
	let undoVisible = $state(false);
	let previousStatus: TaskStatus | null = null;
	let undoTimer: ReturnType<typeof setTimeout> | null = null;

	function onTouchStart(e: TouchEvent) {
		if (optimisticStatus === 'done') return;
		swipeStartX = e.touches[0].clientX;
		isSwiping = true;
		swipeOffsetX = 0;
	}

	function onTouchMove(e: TouchEvent) {
		if (!isSwiping) return;
		const dx = e.touches[0].clientX - swipeStartX;
		if (dx > 0) {
			swipeOffsetX = Math.min(dx, 120);
			// Prevent vertical scroll when swiping horizontally
			if (dx > 10) e.preventDefault();
		}
	}

	function onTouchEnd() {
		if (!isSwiping) return;
		isSwiping = false;
		if (swipeOffsetX >= SWIPE_THRESHOLD) {
			completeTask();
		}
		swipeOffsetX = 0;
	}

	function completeTask() {
		if (optimisticStatus === 'done') return;
		previousStatus = optimisticStatus;
		const prev = previousStatus;
		optimisticStatus = 'done';
		onpatch?.(task.id, { status: 'done' });
		patchField({ status: 'done' }, () => {
			optimisticStatus = prev;
			onpatch?.(task.id, { status: prev });
		});

		undoVisible = true;
		if (undoTimer) clearTimeout(undoTimer);
		undoTimer = setTimeout(() => {
			undoVisible = false;
			undoTimer = null;
			previousStatus = null;
		}, 5000);
	}

	function undoComplete() {
		if (!previousStatus) return;
		const prev = previousStatus;
		optimisticStatus = prev;
		onpatch?.(task.id, { status: prev });
		patchField({ status: prev }, () => {
			optimisticStatus = 'done';
			onpatch?.(task.id, { status: 'done' });
		});
		previousStatus = null;
		undoVisible = false;
		if (undoTimer) {
			clearTimeout(undoTimer);
			undoTimer = null;
		}
	}

	// ── Swipe reveal opacity ──────────────────────────────────────────────────

	const swipeRevealOpacity = $derived(swipeOffsetX / SWIPE_THRESHOLD);
</script>

<svelte:window onclick={closeDropdown} />

<!-- Undo toast: fixed, one at a time since only one task can be swiped -->
{#if undoVisible}
	<div
		class="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm shadow-lg"
		role="status"
		aria-live="polite"
	>
		<CheckCircle2 size={16} class="flex-shrink-0 text-primary" />
		<span>Marked as done</span>
		<button
			type="button"
			onclick={undoComplete}
			class="ml-1 font-semibold text-primary hover:underline"
		>
			Undo
		</button>
	</div>
{/if}

<!-- Outer wrapper handles swipe gesture -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="relative overflow-hidden"
	ontouchstart={onTouchStart}
	ontouchmove={onTouchMove}
	ontouchend={onTouchEnd}
>
	<!-- Green reveal shown behind the row as it slides right -->
	<div
		class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 bg-green-500/20"
		style="width: {swipeOffsetX + 4}px; opacity: {swipeRevealOpacity}"
		aria-hidden="true"
	>
		<CheckCircle2 size={18} class="text-green-600" />
	</div>

	<!-- Row content -->
	<div
		class="relative flex items-center gap-2 bg-card px-3 py-3 transition-transform"
		style="transform: translateX({swipeOffsetX}px)"
	>
		<!-- Drag handle — only this element initiates drag (dragHandleZone) -->
		{#if dragHandle}
			<span
				use:dragHandle
				class="touch-none flex-shrink-0 cursor-grab p-1 text-muted-foreground/40 transition-colors hover:text-muted-foreground active:cursor-grabbing"
				aria-label="Drag to reorder"
				role="img"
			>
				<GripVertical size={14} />
			</span>
		{:else}
			<span
				class="touch-none flex-shrink-0 cursor-grab p-1 text-muted-foreground/40 transition-colors hover:text-muted-foreground active:cursor-grabbing"
				aria-label="Drag to reorder"
				role="img"
			>
				<GripVertical size={14} />
			</span>
		{/if}

		<!-- Status pill — tap to cycle -->
		<button
			type="button"
			class="flex-shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium transition-opacity hover:opacity-80 {STATUS_COLORS[
				optimisticStatus
			] ?? 'bg-muted text-muted-foreground'}"
			onclick={cycleStatus}
			aria-label="Status: {STATUS_LABELS[optimisticStatus]}. Tap to cycle."
			title="Tap to cycle status"
		>
			{STATUS_LABELS[optimisticStatus]}
		</button>

		<!-- Content, description, phase — tap to open detail sheet -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="min-w-0 flex-1 {onopen ? 'cursor-pointer' : ''}"
			onclick={(e) => {
				e.stopPropagation();
				onopen?.(task);
			}}
		>
			<p
				class="text-sm leading-snug {optimisticStatus === 'done'
					? 'text-muted-foreground line-through'
					: ''}"
			>
				{task.content}
			</p>
			{#if task.description}
				<p class="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{task.description}</p>
			{/if}
			{#if task.phase}
				<span
					class="mt-0.5 inline-block text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
				>
					{task.phase}
				</span>
			{/if}
		</div>

		<!-- Right side: sync badges + assignee pill -->
		<div class="flex flex-shrink-0 items-center gap-1.5">
			<!-- Todoist sync badge -->
			{#if task.sync.todoist_id}
				<span
					class="rounded bg-red-500/10 px-1 py-0.5 text-[10px] font-medium text-red-600 dark:text-red-400"
					title="Synced to Todoist (#{task.sync.todoist_id})"
					aria-label="Synced to Todoist"
				>
					TD
				</span>
			{/if}

			<!-- GitHub issue badge -->
			{#if task.sync.github_issue}
				<span
					class="flex items-center gap-0.5 rounded bg-gray-500/10 px-1 py-0.5 text-[10px] font-medium text-gray-600 dark:text-gray-400"
					title="GitHub issue #{task.sync.github_issue}"
					aria-label="GitHub issue {task.sync.github_issue}"
				>
					<GitBranch size={10} />
					#{task.sync.github_issue}
				</span>
			{/if}

			<!-- Assignee pill + dropdown -->
			<div class="relative">
				<button
					type="button"
					class="rounded px-1.5 py-0.5 text-[11px] font-medium transition-opacity hover:opacity-80 {ASSIGNEE_COLORS[
						optimisticAssignee
					]}"
					onclick={toggleAssigneeDropdown}
					aria-haspopup="listbox"
					aria-expanded={showAssigneeDropdown}
					aria-label="Assignee: {optimisticAssignee}. Tap to change."
				>
					{optimisticAssignee}
				</button>

				{#if showAssigneeDropdown}
					<div
						class="absolute right-0 top-full z-20 mt-1 min-w-[120px] rounded-lg border border-border bg-popover py-1 shadow-md"
						role="listbox"
						aria-label="Select assignee"
					>
						{#each ASSIGNEES as a (a)}
							<button
								type="button"
								role="option"
								aria-selected={a === optimisticAssignee}
								class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent {a ===
								optimisticAssignee
									? 'font-semibold'
									: ''}"
								onclick={(e) => selectAssignee(e, a)}
							>
								<span class="rounded px-1.5 py-0.5 text-[11px] {ASSIGNEE_COLORS[a]}">{a}</span>
							</button>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
