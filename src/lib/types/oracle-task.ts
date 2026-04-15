/**
 * Oracle Task types — the canonical schema for per-project `tasks.json` files
 * stored at `Projects/<slug>/tasks.json` in the ORACLE repo.
 *
 * Field naming rules: all Task fields are snake_case. Do NOT rename `content`
 * to `title`, `description` to `notes`, or introduce camelCase aliases.
 *
 * Verbatim mirror of Pennyworth `src/types/oracle-task.ts`.
 */

export type TaskStatus = 'backlog' | 'ready' | 'in_progress' | 'review' | 'done';

export type TaskAssignee = 'nick' | 'alfred' | 'pennyworth' | 'forge';

export interface TaskSync {
	todoist_id: string | null;
	github_issue: string | null;
}

export interface Task {
	id: string;
	content: string;
	description: string | null;
	status: TaskStatus;
	assignee: TaskAssignee;
	phase: string | null;
	section: string | null;
	sort_order: number;
	created_at: string;
	updated_at: string;
	sync: TaskSync;
}

export interface TasksFile {
	version: 1;
	tasks: Task[];
}
