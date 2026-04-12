import { test, expect } from '@playwright/test';

test('Oracle MVP smoke test', async ({ page }) => {
	// 1. Load the home page — should redirect to login if auth is configured
	await page.goto('/');

	// Handle auth: if redirected to /login, the app has cookie auth enabled
	// but no credentials configured in the test environment → skip auth-gated tests.
	// If we land on the dashboard, auth is either disabled or test env has creds.
	const url = page.url();
	if (url.includes('/login')) {
		// Auth is active — verify login page renders
		await expect(page.locator('h1')).toContainText('Oracle');
		await expect(page.locator('input[type="text"]')).toBeVisible();
		await expect(page.locator('input[type="password"]')).toBeVisible();
		await expect(page.locator('button[type="submit"]')).toBeVisible();
		return; // Skip dashboard tests — no test credentials
	}

	// Dashboard loaded — full smoke test
	await expect(page.locator('h1').first()).toBeVisible();
	await expect(page.locator('[data-testid="project-card"]').first()).toBeVisible();

	// 2. Verify the sidebar rendered with projects and areas
	await expect(page.locator('[data-testid="sidebar-project"]').first()).toBeVisible();
	await expect(page.locator('[data-testid="sidebar-area"]').first()).toBeVisible();

	// 3. Click a project in the sidebar
	await page.locator('[data-testid="sidebar-project"]').first().click();
	await expect(page).toHaveURL(/\/projects\//);
	await expect(page.locator('[data-testid="sow-content"]')).toBeVisible();

	// 4. Click an area in the sidebar
	await page.locator('[data-testid="sidebar-area"]').first().click();
	await expect(page).toHaveURL(/\/areas\//);
	await expect(page.locator('[data-testid="sow-content"]')).toBeVisible();

	// 5. Toggle the theme
	const html = page.locator('html');
	const initialClass = await html.getAttribute('class');
	await page.locator('[data-testid="theme-toggle"]').first().click();
	await expect(html).not.toHaveAttribute('class', initialClass ?? '');

	// 6. Navigate back to dashboard
	await page.locator('[data-testid="nav-dashboard"]').click();
	await expect(page).toHaveURL('/');
});
