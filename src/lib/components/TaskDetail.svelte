<script lang="ts">
	import { X, GitBranch, ExternalLink, AlertCircle } from 'lucide-svelte';
	import type { Task, TaskStatus, TaskAssignee } from '$lib/types/oracle-task.js';

	const STATUS_ORDER: TaskStatus[] = ['backlog', 'ready', 'in_progress', 'review', 'done'];

	const STATUS_LABELS: Record<TaskStatus, string> = {
		backlog: 'Backlog',
		ready: 'Ready',
		in_progress: 'In progress',
		review: 'Review',
		done: 'Done'
	};

	const ASSIGNEES: TaskAssignee[] = ['nick', 'alfred', 'pennyworth', 'forge'];

	interface Props {
		task: Task;
		slug: string;
		/** platform_ids.github_repo — used as the default repo label in the promote flow */
		githubRepo?: string;
		onclose: () => void;
		onpatch?: (id: string, patch: Partial<Task>) => void;
	}

	const { task, slug, githubRepo, onclose, onpatch }: Props = $props();

	// ── Editable form state ───────────────────────────────────────────────────
	// svelte-ignore state_referenced_locally
	let content = $state(task.content);
	// svelte-ignore state_referenced_locally
	let description = $state(task.description ?? '');
	// svelte-ignore state_referenced_locally
	let status: TaskStatus = $state(task.status);
	// svelte-ignore state_referenced_locally
	let assignee: TaskAssignee = $state(task.assignee);
	// svelte-ignore state_referenced_locally
	let phase = $state(task.phase ?? '');
	// svelte-ignore state_referenced_locally
	let section = $state(task.section ?? '');

	// Re-sync when parent updates the task (e.g. after SSE reload)
	$effect(() => {
		content = task.content;
		description = task.description ?? '';
		status = task.status;
		assignee = task.assignee;
		phase = task.phase ?? '';
		section = task.section ?? '';
	});

	const isDirty = $derived(
		content !== task.content ||
			description !== (task.description ?? '') ||
			status !== task.status ||
			assignee !== task.assignee ||
			phase !== (task.phase ?? '') ||
			section !== (task.section ?? '')
	);

	// ── Save ──────────────────────────────────────────────────────────────────

	let saving = $state(false);
	let saveError = $state('');

	async function save() {
		if (!content.trim()) return;
		saving = true;
		saveError = '';

		const patch: Partial<Task> = {
			content: content.trim(),
			description: description.trim() || null,
			status,
			assignee,
			phase: phase.trim() || null,
			section: section.trim() || null
		};

		try {
			const res = await fetch(`/api/projects/${slug}/tasks/${task.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(patch)
			});
			if (!res.ok) {
				saveError = 'Failed to save changes';
			} else {
				onpatch?.(task.id, patch);
				onclose();
			}
		} catch {
			saveError = 'Network error';
		} finally {
			saving = false;
		}
	}

	// ── Promote to GitHub Issue ───────────────────────────────────────────────

	let showPromoteConfirm = $state(false);
	let promoting = $state(false);
	let promoteError = $state('');

	const alreadyPromoted = $derived(!!task.sync.github_issue);

	/** Build a full GitHub issue URL from the stored ref (number or full URL). */
	function issueUrl(ref: string): string {
		if (ref.startsWith('http')) return ref;
		if (githubRepo) return `https://github.com/${githubRepo}/issues/${ref}`;
		return '#';
	}

	async function promote() {
		promoting = true;
		promoteError = '';

		try {
			const res = await fetch(`/api/projects/${slug}/tasks/${task.id}/promote`, {
				method: 'POST'
			});
			if (!res.ok) {
				const body = await res.json().catch(() => ({ message: 'Failed to promote' }));
				promoteError = (body as { message?: string }).message ?? 'Failed to promote';
			} else {
				const { task: updated } = (await res.json()) as { task: Task };
				onpatch?.(task.id, { sync: updated.sync });
				showPromoteConfirm = false;
			}
		} catch {
			promoteError = 'Network error';
		} finally {
			promoting = false;
		}
	}

	// ── Keyboard + backdrop dismissal ─────────────────────────────────────────

	function handleBackdrop(e: MouseEvent) {
		if (e.target === e.currentTarget) onclose();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Backdrop -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
	onclick={handleBackdrop}
	aria-hidden="true"
></div>

<!--
  Sheet layout:
  - Mobile  : slides up from bottom, rounded top corners
  - Desktop (md+): fixed right side panel, full height, rounded left corners
-->
<div
	class="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-2xl border-t border-border bg-card shadow-xl
	       md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[440px] md:rounded-none md:rounded-l-2xl md:border-l md:border-t-0"
	role="dialog"
	aria-modal="true"
	aria-label="Task detail"
>
	<!-- Drag handle (mobile only) -->
	<div class="flex justify-center pb-1 pt-3 md:hidden" aria-hidden="true">
		<div class="h-1 w-10 rounded-full bg-border"></div>
	</div>

	<!-- Header -->
	<div class="flex flex-shrink-0 items-center justify-between border-b border-border px-4 py-3">
		<h2 class="text-sm font-semibold">Task detail</h2>
		<button
			type="button"
			onclick={onclose}
			class="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
			aria-label="Close"
		>
			<X size={16} />
		</button>
	</div>

	<!-- Scrollable form body -->
	<div class="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
		<!-- Content (title) -->
		<div class="flex flex-col gap-1.5">
			<label
				for="td-content"
				class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
			>
				Content
			</label>
			<input
				id="td-content"
				type="text"
				bind:value={content}
				required
				class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
				placeholder="Task title…"
			/>
		</div>

		<!-- Description (markdown textarea) -->
		<div class="flex flex-col gap-1.5">
			<label
				for="td-description"
				class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
			>
				Description
				<span class="ml-1 font-normal normal-case text-muted-foreground/60">(markdown)</span>
			</label>
			<textarea
				id="td-description"
				bind:value={description}
				rows={5}
				class="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
				placeholder="Optional details — markdown supported…"
			></textarea>
		</div>

		<!-- Status + Assignee row -->
		<div class="grid grid-cols-2 gap-3">
			<div class="flex flex-col gap-1.5">
				<label
					for="td-status"
					class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
				>
					Status
				</label>
				<select
					id="td-status"
					bind:value={status}
					class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
				>
					{#each STATUS_ORDER as s (s)}
						<option value={s}>{STATUS_LABELS[s]}</option>
					{/each}
				</select>
			</div>

			<div class="flex flex-col gap-1.5">
				<label
					for="td-assignee"
					class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
				>
					Assignee
				</label>
				<select
					id="td-assignee"
					bind:value={assignee}
					class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
				>
					{#each ASSIGNEES as a (a)}
						<option value={a}>{a}</option>
					{/each}
				</select>
			</div>
		</div>

		<!-- Phase + Section row -->
		<div class="grid grid-cols-2 gap-3">
			<div class="flex flex-col gap-1.5">
				<label
					for="td-phase"
					class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
				>
					Phase
				</label>
				<input
					id="td-phase"
					type="text"
					bind:value={phase}
					class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
					placeholder="e.g. Phase 3"
				/>
			</div>

			<div class="flex flex-col gap-1.5">
				<label
					for="td-section"
					class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
				>
					Section
				</label>
				<input
					id="td-section"
					type="text"
					bind:value={section}
					class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
					placeholder="e.g. Backend"
				/>
			</div>
		</div>

		<!-- GitHub Issue section -->
		<div class="flex flex-col gap-2 rounded-lg border border-border p-3">
			<div class="flex items-center gap-2">
				<GitBranch size={14} class="text-muted-foreground" />
				<span class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
					>GitHub Issue</span
				>
			</div>

			{#if alreadyPromoted}
				<!-- Already promoted: show badge + disabled button -->
				<a
					href={issueUrl(task.sync.github_issue!)}
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex w-fit items-center gap-1.5 rounded bg-gray-500/10 px-2 py-1 text-xs font-medium text-gray-600 transition-opacity hover:opacity-80 dark:text-gray-400"
					aria-label="View GitHub issue {task.sync.github_issue}"
				>
					<GitBranch size={11} />
					#{task.sync.github_issue}
					<ExternalLink size={10} />
				</a>
				<button
					type="button"
					disabled
					aria-disabled="true"
					title="Already promoted to GitHub issue #{task.sync.github_issue}"
					class="inline-flex w-fit cursor-not-allowed items-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground opacity-50"
				>
					<GitBranch size={12} />
					Promote to GitHub Issue
				</button>
			{:else if showPromoteConfirm}
				<!-- Confirm step with repo label -->
				<div class="flex flex-col gap-2">
					{#if githubRepo}
						<p class="text-xs text-muted-foreground">
							Will create an issue in <span class="font-medium text-foreground">{githubRepo}</span>.
						</p>
					{/if}
					{#if promoteError}
						<p class="flex items-center gap-1 text-xs text-destructive" role="alert">
							<AlertCircle size={12} />
							{promoteError}
						</p>
					{/if}
					<div class="flex items-center gap-2">
						<button
							type="button"
							onclick={promote}
							disabled={promoting}
							class="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
						>
							{promoting ? 'Creating…' : 'Confirm'}
						</button>
						<button
							type="button"
							onclick={() => {
								showPromoteConfirm = false;
								promoteError = '';
							}}
							class="inline-flex items-center rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
						>
							Cancel
						</button>
					</div>
				</div>
			{:else}
				<!-- Idle: show promote button -->
				<button
					type="button"
					onclick={() => {
						showPromoteConfirm = true;
					}}
					class="inline-flex w-fit items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
				>
					<GitBranch size={12} />
					Promote to GitHub Issue
				</button>
			{/if}
		</div>

		<!-- Todoist sync badge -->
		{#if task.sync.todoist_id}
			<div class="flex items-center gap-2 text-xs text-muted-foreground">
				<span
					class="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-600 dark:text-red-400"
					>TD</span
				>
				<span>Synced to Todoist #{task.sync.todoist_id}</span>
			</div>
		{/if}
	</div>

	<!-- Footer: save / cancel -->
	<div
		class="flex flex-shrink-0 items-center justify-between border-t border-border px-4 py-3"
		style="padding-bottom: max(0.75rem, env(safe-area-inset-bottom, 0px))"
	>
		<span class="text-xs text-muted-foreground">
			{#if saveError}
				<span class="flex items-center gap-1 text-destructive" role="alert">
					<AlertCircle size={12} />
					{saveError}
				</span>
			{:else if isDirty}
				Unsaved changes
			{/if}
		</span>

		<div class="flex items-center gap-2">
			<button
				type="button"
				onclick={onclose}
				class="rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-muted"
			>
				Cancel
			</button>
			<button
				type="button"
				onclick={save}
				disabled={saving || !content.trim()}
				class="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
			>
				{saving ? 'Saving…' : 'Save'}
			</button>
		</div>
	</div>
</div>
