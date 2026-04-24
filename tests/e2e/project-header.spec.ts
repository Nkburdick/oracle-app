/**
 * E2E tests for project header restructure and SOW link placement.
 *
 * Asserts:
 *   (a) No "Edit in GitHub" link appears in the project layout header.
 *   (b) "Edit in GitHub" link is present inside [data-testid="sow-content"].
 *   (c) The project title <h1> is not truncated on an iPhone 15 Pro viewport (393px wide).
 *
 * Tests skip gracefully when auth or the backend is unavailable, consistent
 * with the pattern used in tests/e2e/tasks.spec.ts.
 */

import { test, expect } from '@playwright/test';

const SLUG = 'test-project';
const PROJECT_URL = `/projects/${SLUG}`;
const TASKS_API = `/api/projects/${SLUG}/tasks`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true when the proxy API responds (backend is up). */
async function checkBackend(req: import('@playwright/test').APIRequestContext): Promise<boolean> {
	try {
		const res = await req.get(TASKS_API);
		return res.status() !== 503;
	} catch {
		return false;
	}
}

/**
 * Navigate to the project page and skip the test if auth redirects to /login.
 * Returns false if the test was skipped, true if the page loaded.
 */
async function gotoProject(page: import('@playwright/test').Page, url: string): Promise<boolean> {
	await page.goto(url);
	if (page.url().includes('/login')) {
		test.skip(true, 'Auth is active – no test credentials configured');
		return false;
	}
	return true;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('Project header restructure', () => {
	test.describe.configure({ mode: 'serial' });

	let backendAvailable = false;

	test.beforeAll(async ({ request }) => {
		backendAvailable = await checkBackend(request);
	});

	// ── (a) No "Edit in GitHub" link in the layout header ───────────────────

	test('header does not contain an "Edit in GitHub" link', async ({ page }) => {
		test.skip(!backendAvailable, 'Backend not reachable – skipping');

		const loaded = await gotoProject(page, `${PROJECT_URL}?view=sow`);
		if (!loaded) return;

		// Scope the check to the <header> element only (layout header).
		const header = page.locator('header').first();
		await expect(header).toBeVisible();

		const editLinkInHeader = header.getByText(/edit in github/i);
		await expect(editLinkInHeader).toHaveCount(0);
	});

	// ── (b) "Edit in GitHub" link inside [data-testid="sow-content"] ────────

	test('"Edit in GitHub" link appears inside the SOW content area', async ({ page }) => {
		test.skip(!backendAvailable, 'Backend not reachable – skipping');

		const loaded = await gotoProject(page, `${PROJECT_URL}?view=sow`);
		if (!loaded) return;

		const sowContent = page.locator('[data-testid="sow-content"]');
		await expect(sowContent).toBeVisible();

		const editLink = sowContent.getByText(/edit in github/i);
		await expect(editLink).toBeVisible();
	});

	// ── (c) Project title not truncated at 393px (iPhone 15 Pro) ────────────

	test('project title is not truncated on an iPhone 15 Pro viewport (393px)', async ({ page }) => {
		test.skip(!backendAvailable, 'Backend not reachable – skipping');

		await page.setViewportSize({ width: 393, height: 852 });

		const loaded = await gotoProject(page, PROJECT_URL);
		if (!loaded) return;

		const title = page.locator('header h1').first();
		await expect(title).toBeVisible();

		// Verify the title text is not clipped: scrollWidth should not exceed clientWidth.
		const isNotTruncated = await title.evaluate((el) => el.scrollWidth <= el.clientWidth);
		expect(isNotTruncated, 'Project title should not overflow / be truncated at 393px').toBe(true);
	});
});
