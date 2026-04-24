/**
 * E2E viewport tests for chat composer visibility on iPhone 15 Pro.
 *
 * ISC-13: Opening a chat thread shows the composer without manual scroll.
 * ISC-14: After sending a message the composer is still visible.
 *
 * These tests require Pennyworth to be reachable (the server-side loader
 * redirects to the project page when Pennyworth is unavailable). They skip
 * gracefully when PENNYWORTH_BASE_URL is not configured in the test env.
 */

import { test, expect, devices } from '@playwright/test';

const SLUG = 'test-project';
const THREADS_API = `/api/projects/${SLUG}/threads`;

/** Returns true when the Pennyworth proxy API is reachable. */
async function pennyworthReachable(
	req: import('@playwright/test').APIRequestContext
): Promise<boolean> {
	try {
		const res = await req.get(THREADS_API);
		return res.status() !== 503 && res.status() !== 404;
	} catch {
		return false;
	}
}

test.describe('Chat composer viewport (ISC-13, ISC-14)', () => {
	test.use(devices['iPhone 15 Pro']);
	test.describe.configure({ mode: 'serial' });

	let threadId: string | null = null;
	let available = false;

	test.beforeAll(async ({ request }) => {
		available = await pennyworthReachable(request);
		if (!available) return;

		// Create an ephemeral thread for the test run.
		const res = await request.post(THREADS_API, {
			data: { title: `e2e-viewport-${Date.now()}` }
		});
		if (res.ok()) {
			const body = await res.json();
			threadId = (body.thread?.id ?? body.id ?? null) as string | null;
		}
	});

	test.afterAll(async ({ request }) => {
		if (threadId) {
			await request.delete(`${THREADS_API}/${threadId}`).catch(() => {});
			threadId = null;
		}
	});

	// ── ISC-13: composer is visible on open without scrolling ────────────────

	test('ISC-13: composer is visible when the thread opens', async ({ page }) => {
		test.skip(!available, 'Pennyworth not reachable — skipping viewport tests');
		test.skip(!threadId, 'Thread creation failed — skipping');

		await page.goto(`/projects/${SLUG}/chats/${threadId}`);

		// Redirect to /login means auth is active with no test credentials.
		if (page.url().includes('/login')) {
			test.skip(true, 'Auth is active — no test credentials configured');
			return;
		}

		// Redirect back to the project list means Pennyworth rejected the thread.
		if (!page.url().includes('/chats/')) {
			test.skip(true, 'Thread route redirected — Pennyworth rejected the thread ID');
			return;
		}

		const composer = page.locator('[data-testid="composer"]');
		await expect(composer).toBeVisible();

		// Assert the composer is inside the visible viewport without scrolling.
		const viewport = page.viewportSize();
		const box = await composer.boundingBox();

		expect(box, 'Composer must have a bounding box').not.toBeNull();
		expect(box!.y + box!.height, 'Composer bottom must be within viewport height').toBeLessThanOrEqual(
			viewport!.height
		);
	});

	// ── ISC-14: composer remains visible after sending a message ─────────────

	test('ISC-14: composer stays visible after sending a message', async ({ page }) => {
		test.skip(!available, 'Pennyworth not reachable — skipping viewport tests');
		test.skip(!threadId, 'Thread creation failed — skipping');

		await page.goto(`/projects/${SLUG}/chats/${threadId}`);

		if (page.url().includes('/login')) {
			test.skip(true, 'Auth is active — no test credentials configured');
			return;
		}

		if (!page.url().includes('/chats/')) {
			test.skip(true, 'Thread route redirected — Pennyworth rejected the thread ID');
			return;
		}

		const composer = page.locator('[data-testid="composer"]');
		await expect(composer).toBeVisible();

		// Type and send a test message.
		const textarea = composer.locator('textarea');
		await textarea.fill('e2e viewport test message');

		const sendBtn = composer.locator('button[type="submit"], button[aria-label*="Send"]');
		await sendBtn.click();

		// Allow the optimistic message to appear and the compose to reset.
		await page.waitForTimeout(500);

		// Composer must still be visible after the send.
		await expect(composer).toBeVisible();

		const viewport = page.viewportSize();
		const box = await composer.boundingBox();

		expect(box, 'Composer must have a bounding box after send').not.toBeNull();
		expect(
			box!.y + box!.height,
			'Composer bottom must be within viewport height after send'
		).toBeLessThanOrEqual(viewport!.height);
	});
});
