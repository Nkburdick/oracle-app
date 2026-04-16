import type { RequestHandler } from './$types.js';
import { json, error } from '@sveltejs/kit';
import { getPennyworthBaseUrl } from '$lib/server/pennyworth-client.js';
import { promoteTask } from '$lib/server/pennyworth-tasks-client.js';

const SLUG_RE = /^[a-z0-9-]+$/;

/**
 * POST /api/projects/[slug]/tasks/[id]/promote
 *
 * Proxies to Pennyworth's `POST /api/tasks/:id/promote` which creates a
 * GitHub issue for the task and stores the issue URL in `sync.github_issue`.
 */
export const POST: RequestHandler = async ({ params }) => {
	if (!SLUG_RE.test(params.slug)) {
		error(400, 'Invalid project slug');
	}

	let baseUrl: string;
	try {
		baseUrl = getPennyworthBaseUrl();
	} catch (err) {
		error(503, `Task backend unavailable: ${(err as Error).message}`);
	}

	try {
		const task = await promoteTask(baseUrl, params.id);
		return json({ task });
	} catch (err) {
		const message = (err as Error).message;
		if (message.includes('Pennyworth 404')) {
			error(404, `Task ${params.id} not found`);
		}
		if (message.includes('Pennyworth 429')) {
			error(429, 'GitHub rate limit reached — try again later');
		}
		error(502, `Pennyworth fetch failed: ${message}`);
	}
};
