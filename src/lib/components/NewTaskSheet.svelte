<script lang="ts">
	import { X, AlertCircle } from 'lucide-svelte';
	import type { Task, TaskAssignee } from '$lib/types/oracle-task.js';

	const ASSIGNEES: TaskAssignee[] = ['nick', 'alfred', 'pennyworth', 'forge'];

	interface Props {
		slug: string;
		onclose: () => void;
		/** Called with the newly created task on success */
		// eslint-disable-next-line no-unused-vars
		oncreate?: (task: Task) => void;
	}

	const { slug, onclose, oncreate }: Props = $props();

	// ── Form state ────────────────────────────────────────────────────────────

	let content = $state('');
	let assignee: TaskAssignee = $state('nick');
	let section = $state('');
	let phase = $state('');

	let submitting = $state(false);
	let error = $state('');

	// ── Submit ────────────────────────────────────────────────────────────────

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		if (!content.trim()) return;
		submitting = true;
		error = '';

		try {
			const res = await fetch(`/api/projects/${slug}/tasks`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					content: content.trim(),
					assignee,
					section: section.trim() || null,
					phase: phase.trim() || null
				})
			});

			if (!res.ok) {
				const body = await res.json().catch(() => ({ message: 'Failed to create task' }));
				error = (body as { message?: string }).message ?? 'Failed to create task';
			} else {
				const { task } = (await res.json()) as { task: Task };
				oncreate?.(task);
				onclose();
			}
		} catch {
			error = 'Network error';
		} finally {
			submitting = false;
		}
	}

	// ── Dismissal ─────────────────────────────────────────────────────────────

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

<!-- Bottom sheet -->
<div
	class="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-border bg-card shadow-xl"
	role="dialog"
	aria-modal="true"
	aria-labelledby="nts-title"
>
	<!-- Drag handle -->
	<div class="flex justify-center pb-1 pt-3" aria-hidden="true">
		<div class="h-1 w-10 rounded-full bg-border"></div>
	</div>

	<!-- Header -->
	<div class="flex items-center justify-between px-4 pb-3">
		<h2 id="nts-title" class="text-sm font-semibold">New task</h2>
		<button
			type="button"
			onclick={onclose}
			class="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
			aria-label="Close"
		>
			<X size={16} />
		</button>
	</div>

	<!-- Form -->
	<form onsubmit={submit} class="flex flex-col gap-4 px-4" novalidate>
		<!-- Content (required) -->
		<div class="flex flex-col gap-1.5">
			<label
				for="nts-content"
				class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
			>
				Content <span class="text-destructive" aria-hidden="true">*</span>
			</label>
			<input
				id="nts-content"
				type="text"
				bind:value={content}
				required
				autofocus
				class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
				placeholder="What needs to be done?"
				aria-required="true"
			/>
		</div>

		<!-- Assignee (required, default nick) -->
		<div class="flex flex-col gap-1.5">
			<label
				for="nts-assignee"
				class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
			>
				Assignee
			</label>
			<select
				id="nts-assignee"
				bind:value={assignee}
				class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
			>
				{#each ASSIGNEES as a (a)}
					<option value={a}>{a}</option>
				{/each}
			</select>
		</div>

		<!-- Section + Phase (optional) -->
		<div class="grid grid-cols-2 gap-3">
			<div class="flex flex-col gap-1.5">
				<label
					for="nts-section"
					class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
				>
					Section
				</label>
				<input
					id="nts-section"
					type="text"
					bind:value={section}
					class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
					placeholder="Optional"
				/>
			</div>

			<div class="flex flex-col gap-1.5">
				<label
					for="nts-phase"
					class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
				>
					Phase
				</label>
				<input
					id="nts-phase"
					type="text"
					bind:value={phase}
					class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
					placeholder="Optional"
				/>
			</div>
		</div>

		{#if error}
			<p class="flex items-center gap-1.5 text-xs text-destructive" role="alert">
				<AlertCircle size={12} />
				{error}
			</p>
		{/if}

		<!-- Submit -->
		<button
			type="submit"
			disabled={submitting || !content.trim()}
			class="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
			style="margin-bottom: max(1rem, env(safe-area-inset-bottom, 1rem))"
		>
			{submitting ? 'Creating…' : 'Create task'}
		</button>
	</form>
</div>
