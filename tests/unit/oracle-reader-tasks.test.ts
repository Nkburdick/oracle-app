import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Task, TasksFile } from '../../src/lib/types/oracle-task.js';

// ─── fs mock ─────────────────────────────────────────────────────────────────

vi.mock('node:fs/promises', () => ({
	readFile: vi.fn(),
	readdir: vi.fn()
}));

// Import AFTER mocking so module picks up the mock
const { readFile } = await import('node:fs/promises');
const { readProjectTasks } = await import('../../src/lib/server/oracle-reader.js');

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeTask(overrides: Partial<Task> = {}): Task {
	return {
		id: 'task-1',
		content: 'Do the thing',
		description: null,
		status: 'backlog',
		assignee: 'nick',
		phase: null,
		section: null,
		sort_order: 10,
		created_at: '2026-01-01T00:00:00.000Z',
		updated_at: '2026-01-02T00:00:00.000Z',
		sync: { todoist_id: null, github_issue: null },
		...overrides
	};
}

function tasksFile(tasks: Task[]): string {
	return JSON.stringify({ version: 1, tasks } satisfies TasksFile);
}

function mockReadFile(content: string) {
	vi.mocked(readFile).mockResolvedValueOnce(content as unknown as Buffer);
}

function mockReadFileError(code = 'ENOENT') {
	const err = Object.assign(new Error('ENOENT'), { code });
	vi.mocked(readFile).mockRejectedValueOnce(err);
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe('readProjectTasks', () => {
	beforeEach(() => {
		process.env.ORACLE_DATA_PATH = '/data';
	});

	afterEach(() => {
		delete process.env.ORACLE_DATA_PATH;
		vi.clearAllMocks();
	});

	test('returns empty array when file does not exist', async () => {
		mockReadFileError('ENOENT');
		expect(await readProjectTasks('my-project')).toEqual([]);
	});

	test('returns empty array for unsafe slug (path traversal)', async () => {
		expect(await readProjectTasks('../etc/passwd')).toEqual([]);
		expect(await readProjectTasks('../../secret')).toEqual([]);
		expect(vi.mocked(readFile)).not.toHaveBeenCalled();
	});

	test('returns empty array for empty slug', async () => {
		expect(await readProjectTasks('')).toEqual([]);
		expect(vi.mocked(readFile)).not.toHaveBeenCalled();
	});

	test('returns empty array for invalid JSON', async () => {
		mockReadFile('not json {{{');
		expect(await readProjectTasks('my-project')).toEqual([]);
	});

	test('returns empty array when tasks array is missing', async () => {
		mockReadFile(JSON.stringify({ version: 1 }));
		expect(await readProjectTasks('my-project')).toEqual([]);
	});

	test('returns valid tasks sorted by sort_order ascending', async () => {
		const t1 = makeTask({ id: 't1', sort_order: 30 });
		const t2 = makeTask({ id: 't2', sort_order: 10 });
		const t3 = makeTask({ id: 't3', sort_order: 20 });
		mockReadFile(tasksFile([t1, t2, t3]));

		const result = await readProjectTasks('my-project');

		expect(result.map((t) => t.id)).toEqual(['t2', 't3', 't1']);
	});

	test('skips malformed records and returns valid subset', async () => {
		const good = makeTask({ id: 'good' });
		const bad = { id: 123, content: 'missing required fields' };
		const alsoGood = makeTask({ id: 'also-good', sort_order: 20 });

		mockReadFile(JSON.stringify({ version: 1, tasks: [good, bad, alsoGood] }));

		const result = await readProjectTasks('my-project');

		expect(result.map((t) => t.id)).toEqual(['good', 'also-good']);
	});

	test('returns empty array when all tasks are malformed', async () => {
		mockReadFile(JSON.stringify({ version: 1, tasks: [{ broken: true }] }));
		expect(await readProjectTasks('my-project')).toEqual([]);
	});

	test('validates all required task fields', async () => {
		const invalidStatus = makeTask({ status: 'invalid' as Task['status'] });
		const invalidAssignee = makeTask({ assignee: 'robot' as Task['assignee'] });
		const missingId = { ...makeTask(), id: undefined };

		mockReadFile(JSON.stringify({ version: 1, tasks: [invalidStatus, invalidAssignee, missingId] }));

		expect(await readProjectTasks('my-project')).toEqual([]);
	});

	test('reads from Projects/<slug>/tasks.json path', async () => {
		mockReadFile(tasksFile([makeTask()]));

		await readProjectTasks('my-project');

		expect(vi.mocked(readFile)).toHaveBeenCalledWith(
			expect.stringContaining('Projects/my-project/tasks.json'),
			'utf-8'
		);
	});

	test('returns tasks with all valid statuses and assignees', async () => {
		const tasks: Task[] = [
			makeTask({ id: 'backlog', status: 'backlog', assignee: 'nick', sort_order: 1 }),
			makeTask({ id: 'ready', status: 'ready', assignee: 'alfred', sort_order: 2 }),
			makeTask({ id: 'in_progress', status: 'in_progress', assignee: 'pennyworth', sort_order: 3 }),
			makeTask({ id: 'review', status: 'review', assignee: 'forge', sort_order: 4 }),
			makeTask({ id: 'done', status: 'done', assignee: 'nick', sort_order: 5 })
		];
		mockReadFile(tasksFile(tasks));

		const result = await readProjectTasks('my-project');

		expect(result).toHaveLength(5);
		expect(result.map((t) => t.id)).toEqual(['backlog', 'ready', 'in_progress', 'review', 'done']);
	});
});
