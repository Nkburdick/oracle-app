import type { RequestHandler } from './$types.js';
import { json, error } from '@sveltejs/kit';
import { getPennyworthBaseUrl } from '$lib/server/pennyworth-client.js';
import { patchTask, deleteTask, type PatchTaskBody } from '$lib/server/pennyworth-tasks-client.js';

const SLUG_RE = /^[a-z0-9-]+$/;

/**
 * PATCH /api/projects/[slug]/tasks/[id]
 *
 * Proxies to Pennyworth's `PATCH /api/oracle/projects/:slug/tasks/:id`.
 */
export const PATCH: RequestHandler = async ({ params, request }) => {
	if (!SLUG_RE.test(params.slug)) {
		error(400, 'Invalid project slug');
	}

	let baseUrl: string;
	try {
		baseUrl = getPennyworthBaseUrl();
	} catch (err) {
		error(503, `Task backend unavailable: ${(err as Error).message}`);
	}

	let body: PatchTaskBody;
	try {
		body = (await request.json()) as PatchTaskBody;
	} catch {
		error(400, 'Invalid JSON body');
	}

	if (Object.keys(body).length === 0) {
		error(400, 'PATCH body must include at least one field');
	}

	try {
		const task = await patchTask(baseUrl, params.slug, params.id, body);
		return json({ task });
	} catch (err) {
		const message = (err as Error).message;
		if (message.includes('Pennyworth 404')) {
			error(404, `Task ${params.id} not found`);
		}
		error(502, `Pennyworth fetch failed: ${message}`);
	}
};

/**
 * DELETE /api/projects/[slug]/tasks/[id]
 *
 * Proxies to Pennyworth's `DELETE /api/oracle/projects/:slug/tasks/:id`.
 */
export const DELETE: RequestHandler = async ({ params }) => {
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
		const deleted = await deleteTask(baseUrl, params.slug, params.id);
		return json({ deleted });
	} catch (err) {
		const message = (err as Error).message;
		if (message.includes('Pennyworth 404')) {
			error(404, `Task ${params.id} not found`);
		}
		error(502, `Pennyworth fetch failed: ${message}`);
	}
};
