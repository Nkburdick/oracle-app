/**
 * E2E test suite for the Task Board (ISC-38).
 *
 * Covers the full lifecycle:
 *   1. Create two tasks via the Pennyworth proxy API (setup)
 *   2. Navigate to /projects/:slug/tasks and verify tasks appear
 *   3. Drag-reorder tasks and verify new order persists after reload
 *   4. Tap the status pill to mark a task done
 *   5. Verify sync.todoist_id is non-null for the nick-assigned task
 *   6. Delete a task via the proxy and verify it vanishes from the UI
 *
 * All mutation steps require a running Pennyworth backend.  When
 * PENNYWORTH_BASE_URL is not set (local dev without backend), each test
 * skips gracefully with an explanatory message.
 */

import { test, expect } from '@playwright/test';

const SLUG = 'test-project';
const TASKS_API = `/api/projects/${SLUG}/tasks`;

// Unique prefix so parallel CI runs don't collide.
const RUN_ID = `e2e-${Date.now()}`;
const content = (n: number) => `${RUN_ID} task ${n}`;

// Shared state – safe because tests run serially inside this describe block.
let pennyworthAvailable = false;
const createdIds: string[] = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true when the proxy API responds with something other than 503. */
async function checkPennyworth(
	req: import('@playwright/test').APIRequestContext
): Promise<boolean> {
	try {
		const res = await req.get(TASKS_API);
		return res.status() !== 503;
	} catch {
		return false;
	}
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('Task board (ISC-38)', () => {
	test.describe.configure({ mode: 'serial' });

	test.beforeAll(async ({ request }) => {
		pennyworthAvailable = await checkPennyworth(request);
	});

	test.afterAll(async ({ request }) => {
		// Best-effort cleanup of any tasks the delete test didn't handle.
		for (const id of [...createdIds]) {
			await request.delete(`${TASKS_API}/${id}`).catch(() => {});
		}
		createdIds.length = 0;
	});

	// ── 1. Setup via Pennyworth API ────────────────────────────────────────────

	test('creates two tasks via the Pennyworth proxy API', async ({ request }) => {
		test.skip(!pennyworthAvailable, 'Pennyworth not reachable – skipping mutation tests');

		const fixtures = [
			{ content: content(1), status: 'backlog', assignee: 'nick' },
			{ content: content(2), status: 'backlog', assignee: 'alfred' }
		] as const;

		for (const data of fixtures) {
			const res = await request.post(TASKS_API, { data });
			expect(res.status(), `POST ${TASKS_API} should return 201`).toBe(201);
			const body = await res.json();
			expect(body.task?.id, 'Response body should include task.id').toBeTruthy();
			createdIds.push(body.task.id as string);
		}
	});

	// ── 2. Navigate to tasks tab and verify tasks appear ──────────────────────

	test('tasks tab shows the created tasks', async ({ page }) => {
		test.skip(!pennyworthAvailable, 'Pennyworth not reachable');

		await page.goto(`/projects/${SLUG}/tasks`);

		// Bail out if auth wall is in the way.
		if (page.url().includes('/login')) {
			test.skip(true, 'Auth is active – no test credentials configured');
			return;
		}

		await expect(page.locator('[data-testid="task-board"]')).toBeVisible();

		// Both tasks should appear by content.
		for (let i = 1; i <= 2; i++) {
			await expect(page.getByText(content(i))).toBeVisible();
		}
	});

	// ── 3. Drag-reorder and verify persistence after reload ───────────────────

	test('drag-reorder persists after page reload', async ({ page }) => {
		test.skip(!pennyworthAvailable, 'Pennyworth not reachable');

		await page.goto(`/projects/${SLUG}/tasks`);
		if (page.url().includes('/login')) {
			test.skip(true, 'Auth is active');
			return;
		}

		const board = page.locator('[data-testid="task-board"]');
		await expect(board).toBeVisible();

		// Locate the two task rows by their text content.
		const row1 = page.locator('li').filter({ hasText: content(1) });
		const row2 = page.locator('li').filter({ hasText: content(2) });
		await expect(row1).toBeVisible();
		await expect(row2).toBeVisible();

		// Use the drag handle inside the first row as the drag source.
		const handle1 = row1.locator('[aria-label="Drag to reorder"]');
		const box1 = await handle1.boundingBox();
		const box2 = await row2.boundingBox();
		if (!box1 || !box2) throw new Error('Cannot get bounding boxes for DnD');

		// Drag task-1 below task-2.
		await page.mouse.move(box1.x + box1.width / 2, box1.y + box1.height / 2);
		await page.mouse.down();
		await page.mouse.move(
			box2.x + box2.width / 2,
			box2.y + box2.height + 5,
			{ steps: 15 }
		);
		await page.mouse.up();

		// Allow PATCH requests to complete.
		await page.waitForTimeout(600);

		// Reload and verify the new order was persisted.
		await page.reload();
		await expect(board).toBeVisible();

		const rows = page.locator('[data-testid="task-board"] li');
		const texts = await rows.allTextContents();
		const idx1 = texts.findIndex((t) => t.includes(content(1)));
		const idx2 = texts.findIndex((t) => t.includes(content(2)));

		expect(idx1, 'Task 1 should appear after task 2 after reorder').toBeGreaterThan(idx2);
	});

	// ── 4. Status pill tap marks task done ────────────────────────────────────

	test('tapping the status pill cycles to done', async ({ page }) => {
		test.skip(!pennyworthAvailable, 'Pennyworth not reachable');

		await page.goto(`/projects/${SLUG}/tasks`);
		if (page.url().includes('/login')) {
			test.skip(true, 'Auth is active');
			return;
		}

		const row = page.locator('li').filter({ hasText: content(1) });
		await expect(row).toBeVisible();

		const pill = row.locator('button[aria-label^="Status:"]');
		await expect(pill).toBeVisible();

		// Cycle through all statuses until we land on Done (max 5 clicks).
		const STATUS_CYCLE_MAX = 5;
		for (let i = 0; i < STATUS_CYCLE_MAX; i++) {
			const ariaLabel = await pill.getAttribute('aria-label');
			if (ariaLabel?.includes('Done')) break;
			await pill.click();
			await page.waitForTimeout(150);
		}

		await expect(pill).toHaveAttribute('aria-label', /Done/);
	});

	// ── 5. Nick-assigned task has todoist_id synced ───────────────────────────

	test('nick-assigned task has non-null sync.todoist_id via GET tasks API', async ({
		request
	}) => {
		test.skip(!pennyworthAvailable, 'Pennyworth not reachable');

		const res = await request.get(TASKS_API);
		expect(res.ok(), 'GET tasks should succeed').toBe(true);

		const { tasks } = (await res.json()) as {
			tasks: Array<{
				id: string;
				assignee: string;
				sync: { todoist_id: string | null; github_issue: string | null };
			}>;
		};

		const nickTask = tasks.find(
			(t) => createdIds.includes(t.id) && t.assignee === 'nick'
		);
		expect(nickTask, 'Nick-assigned task should exist in GET response').toBeDefined();
		expect(
			nickTask!.sync.todoist_id,
			'sync.todoist_id must be non-null for nick-assigned tasks'
		).not.toBeNull();
	});

	// ── 6. Delete via proxy and verify UI removal ─────────────────────────────

	test('deletes a task via the proxy and it disappears from the UI', async ({
		page,
		request
	}) => {
		test.skip(!pennyworthAvailable, 'Pennyworth not reachable');
		test.skip(createdIds.length === 0, 'No tasks were created – nothing to delete');

		const targetId = createdIds[0];

		const delRes = await request.delete(`${TASKS_API}/${targetId}`);
		expect(delRes.ok(), `DELETE /tasks/${targetId} should succeed`).toBe(true);

		// Remove from cleanup list – already gone.
		createdIds.splice(createdIds.indexOf(targetId), 1);

		// Navigate to the board and confirm the deleted task is not rendered.
		await page.goto(`/projects/${SLUG}/tasks`);
		if (page.url().includes('/login')) {
			test.skip(true, 'Auth is active');
			return;
		}

		await expect(page.locator('[data-testid="task-board"]')).toBeVisible();
		await expect(page.getByText(content(1))).not.toBeVisible();
	});
});
