import type { RequestHandler } from './$types.js';
import { json, error } from '@sveltejs/kit';
import { getPennyworthBaseUrl, getMessages } from '$lib/server/pennyworth-client.js';

/**
 * GET /api/projects/[slug]/threads/[id]/messages
 *
 * Server-side proxy to Pennyworth's `GET /api/conversations/{id}/messages`.
 * The browser never talks to Pennyworth directly (PRD §7.2, AC-34). The
 * `[slug]` segment is currently unused for filtering — Pennyworth scopes
 * messages by `conversationId` only — but it's preserved in the route shape
 * so future RBAC can use it.
 */
export const GET: RequestHandler = async ({ params }) => {
	let baseUrl: string;
	try {
		baseUrl = getPennyworthBaseUrl();
	} catch (err) {
		error(503, `Chat backend unavailable: ${(err as Error).message}`);
	}

	try {
		const messages = await getMessages(baseUrl, params.id);
		return json({ messages });
	} catch (err) {
		const message = (err as Error).message;
		// Pennyworth's 404 surfaces as `Pennyworth 404 Not Found: ...` in our
		// client wrapper — translate to a real 404 for the SvelteKit response.
		if (message.includes('Pennyworth 404')) {
			error(404, `Thread ${params.id} not found`);
		}
		error(502, `Pennyworth fetch failed: ${message}`);
	}
};
