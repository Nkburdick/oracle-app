/**
 * Pennyworth task API client — server-only.
 *
 * Wraps the task CRUD endpoints on the Pennyworth API. Uses the same
 * Bearer-token auth pattern as `pennyworth-client.ts`.
 */

import type { Task, TaskStatus, TaskAssignee } from '$lib/types/oracle-task.js';
import { getPennyworthApiToken } from '$lib/server/pennyworth-client.js';

// ─── shared fetch helper ─────────────────────────────────────────────────────

async function tasksFetch(url: string, init?: RequestInit): Promise<Response> {
	const token = getPennyworthApiToken();
	const res = await fetch(url, {
		...init,
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`,
			...(init?.headers ?? {})
		},
		signal: init?.signal ?? AbortSignal.timeout(10_000)
	});

	if (!res.ok) {
		// eslint-disable-next-line no-useless-assignment
		let bodyText = '';
		try {
			bodyText = await res.text();
		} catch {
			bodyText = '<unreadable response body>';
		}
		throw new Error(`Pennyworth ${res.status} ${res.statusText}: ${bodyText}`);
	}

	return res;
}

// ─── request body types ──────────────────────────────────────────────────────

export interface CreateTaskBody {
	content: string;
	description?: string | null;
	status?: TaskStatus;
	assignee?: TaskAssignee;
	phase?: string | null;
	section?: string | null;
	sort_order?: number;
}

export interface PatchTaskBody {
	content?: string;
	description?: string | null;
	status?: TaskStatus;
	assignee?: TaskAssignee;
	phase?: string | null;
	section?: string | null;
	sort_order?: number;
}

function tasksBasePath(oracleSlug: string): string {
	return `/api/oracle/projects/${encodeURIComponent(oracleSlug)}/tasks`;
}

// ─── 1. List tasks for a project ─────────────────────────────────────────────

export async function listTasks(baseUrl: string, oracleSlug: string): Promise<Task[]> {
	const res = await tasksFetch(`${baseUrl}${tasksBasePath(oracleSlug)}`);
	const data = (await res.json()) as { tasks: Task[] };
	return data.tasks;
}

// ─── 2. Create a task ────────────────────────────────────────────────────────

export async function createTask(
	baseUrl: string,
	oracleSlug: string,
	body: CreateTaskBody
): Promise<Task> {
	const res = await tasksFetch(`${baseUrl}${tasksBasePath(oracleSlug)}`, {
		method: 'POST',
		body: JSON.stringify(body)
	});
	const data = (await res.json()) as { task: Task };
	return data.task;
}

// ─── 3. Patch a task ─────────────────────────────────────────────────────────

export async function patchTask(
	baseUrl: string,
	oracleSlug: string,
	taskId: string,
	body: PatchTaskBody
): Promise<Task> {
	const res = await tasksFetch(
		`${baseUrl}${tasksBasePath(oracleSlug)}/${encodeURIComponent(taskId)}`,
		{
			method: 'PATCH',
			body: JSON.stringify(body)
		}
	);
	const data = (await res.json()) as { task: Task };
	return data.task;
}

// ─── 4. Delete a task ────────────────────────────────────────────────────────

export async function deleteTask(
	baseUrl: string,
	oracleSlug: string,
	taskId: string
): Promise<string> {
	const res = await tasksFetch(
		`${baseUrl}${tasksBasePath(oracleSlug)}/${encodeURIComponent(taskId)}`,
		{
			method: 'DELETE'
		}
	);
	const data = (await res.json()) as { deleted: string };
	return data.deleted;
}

// ─── 5. Promote a task to a GitHub issue ─────────────────────────────────────

export async function promoteTask(
	baseUrl: string,
	oracleSlug: string,
	taskId: string
): Promise<Task> {
	const res = await tasksFetch(
		`${baseUrl}${tasksBasePath(oracleSlug)}/${encodeURIComponent(taskId)}/promote`,
		{
			method: 'POST'
		}
	);
	const data = (await res.json()) as { task: Task };
	return data.task;
}
