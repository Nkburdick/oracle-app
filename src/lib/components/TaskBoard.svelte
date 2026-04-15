<script lang="ts">
	import { ChevronDown, Plus } from 'lucide-svelte';
	import type { Task } from '$lib/types/oracle-task.js';

	interface Props {
		tasks: Task[];
		slug: string;
	}

	const { tasks, slug }: Props = $props();

	// Group tasks by section. Null/undefined section goes into a sentinel group
	// rendered last as "No section".
	type Section = { name: string | null; tasks: Task[] };

	const sections = $derived.by((): Section[] => {
		const map = new Map<string, Task[]>();
		const unsectioned: Task[] = [];

		for (const task of tasks) {
			if (task.section) {
				const existing = map.get(task.section);
				if (existing) {
					existing.push(task);
				} else {
					map.set(task.section, [task]);
				}
			} else {
				unsectioned.push(task);
			}
		}

		const result: Section[] = [];
		for (const [name, sectionTasks] of map) {
			result.push({ name, tasks: sectionTasks });
		}
		// Unsectioned tasks always appear last
		if (unsectioned.length > 0) {
			result.push({ name: null, tasks: unsectioned });
		}
		return result;
	});

	// Track collapsed state per section name (null key = unsectioned group)
	const collapsed = $state(new Map<string | null, boolean>());

	function toggleSection(name: string | null) {
		collapsed.set(name, !collapsed.get(name));
	}

	function isCollapsed(name: string | null): boolean {
		return collapsed.get(name) ?? false;
	}

	const STATUS_LABELS: Record<string, string> = {
		backlog: 'Backlog',
		ready: 'Ready',
		in_progress: 'In progress',
		review: 'Review',
		done: 'Done'
	};

	const STATUS_COLORS: Record<string, string> = {
		backlog: 'bg-muted text-muted-foreground',
		ready: 'bg-secondary/20 text-secondary',
		in_progress: 'bg-primary/15 text-primary',
		review: 'bg-accent text-accent-foreground border border-border',
		done: 'bg-muted text-muted-foreground line-through'
	};
</script>

<div class="p-6" data-testid="task-board">
	{#if tasks.length === 0}
		<!-- Empty state -->
		<div class="flex flex-col items-center justify-center min-h-64 gap-4 text-center">
			<p class="text-sm text-muted-foreground">
				No tasks yet. Create the first one.
			</p>
			<a
				href="/api/projects/{slug}/tasks"
				class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
				aria-label="Create first task"
			>
				<Plus size={16} />
				New task
			</a>
		</div>
	{:else}
		<div class="flex flex-col gap-6">
			{#each sections as section (section.name)}
				<section aria-label={section.name ?? 'No section'}>
					<!-- Section header -->
					<button
						type="button"
						class="flex items-center gap-2 w-full text-left mb-2 group"
						onclick={() => toggleSection(section.name)}
						aria-expanded={!isCollapsed(section.name)}
					>
						<ChevronDown
							size={14}
							class="text-muted-foreground transition-transform flex-shrink-0
								{isCollapsed(section.name) ? '-rotate-90' : ''}"
						/>
						<span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground group-hover:text-foreground transition-colors">
							{section.name ?? 'No section'}
						</span>
						<span class="text-xs text-muted-foreground">({section.tasks.length})</span>
					</button>

					<!-- Task rows -->
					{#if !isCollapsed(section.name)}
						<ul class="flex flex-col divide-y divide-border border border-border rounded-lg overflow-hidden">
							{#each section.tasks as task (task.id)}
								<li class="flex items-start gap-3 px-4 py-3 bg-card hover:bg-accent/40 transition-colors">
									<!-- Status badge -->
									<span
										class="mt-0.5 flex-shrink-0 px-1.5 py-0.5 rounded text-[11px] font-medium {STATUS_COLORS[task.status] ?? 'bg-muted text-muted-foreground'}"
									>
										{STATUS_LABELS[task.status] ?? task.status}
									</span>

									<!-- Content -->
									<div class="flex-1 min-w-0">
										<p class="text-sm leading-snug {task.status === 'done' ? 'line-through text-muted-foreground' : ''}">
											{task.content}
										</p>
										{#if task.description}
											<p class="mt-0.5 text-xs text-muted-foreground line-clamp-2">
												{task.description}
											</p>
										{/if}
									</div>

									<!-- Assignee -->
									<span class="flex-shrink-0 text-xs text-muted-foreground mt-0.5">
										{task.assignee}
									</span>
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			{/each}
		</div>

		<!-- FAB — create new task -->
		<a
			href="/api/projects/{slug}/tasks"
			class="fixed bottom-20 right-5 lg:bottom-6 lg:right-6 z-10 flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90 transition-opacity"
			aria-label="Create new task"
		>
			<Plus size={20} />
		</a>
	{/if}
</div>
