/**
 * Pennyworth env helpers — server-only.
 *
 * Provides `PENNYWORTH_BASE_URL` and `PENNYWORTH_API_TOKEN` accessors used by
 * notification, push, and task API routes. Chat-side helpers were removed
 * when the in-app chat UI was retired (Discord/Doc replaced it).
 *
 * Lives under `$lib/server/` so SvelteKit's build pipeline enforces it can
 * never be imported from client code.
 */

/**
 * Read `PENNYWORTH_BASE_URL` from process.env. Throws if unset.
 */
export function getPennyworthBaseUrl(): string {
	const url = process.env.PENNYWORTH_BASE_URL;
	if (!url || url.trim() === '') {
		throw new Error('PENNYWORTH_BASE_URL is not set');
	}
	// Strip trailing slash so callers can do `${baseUrl}/api/...` without
	// worrying about double slashes.
	return url.replace(/\/$/, '');
}

/**
 * Read `PENNYWORTH_API_TOKEN` from process.env. Pennyworth's `/api/*` endpoints
 * are gated by Bearer auth (`AOL_API_TOKEN` on the Pennyworth side — same
 * value, different env var name on the consumer end). Throws if unset.
 */
export function getPennyworthApiToken(): string {
	const token = process.env.PENNYWORTH_API_TOKEN;
	if (!token || token.trim() === '') {
		throw new Error('PENNYWORTH_API_TOKEN is not set');
	}
	return token;
}
