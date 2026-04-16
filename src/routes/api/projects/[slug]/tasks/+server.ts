import type { RequestHandler } from './$types.js';
import { json, error } from '@sveltejs/kit';
import { getPennyworthBaseUrl } from '$lib/server/pennyworth-client.js';
import {
	listTasks,
	createTask,
	type CreateTaskBody
} from '$lib/server/pennyworth-tasks-client.js';

const SLUG_RE = /^[a-z0-9-]+$/;

/**
 * GET /api/projects/[slug]/tasks
 *
 * Proxies to Pennyworth's `GET /api/tasks?oracle_slug={slug}`.
 */
export const GET: RequestHandler = async ({ params }) => {
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
		const tasks = await listTasks(baseUrl, params.slug);
		return json({ tasks });
	} catch (err) {
		const message = (err as Error).message;
		if (message.includes('Pennyworth 404')) {
			error(404, `Project ${params.slug} not found`);
		}
		error(502, `Pennyworth fetch failed: ${message}`);
	}
};

/**
 * POST /api/projects/[slug]/tasks
 *
 * Proxies to Pennyworth's `POST /api/tasks`. The oracle_slug is forced
 * from the URL so the client cannot claim a different project.
 */
export const POST: RequestHandler = async ({ params, request }) => {
	if (!SLUG_RE.test(params.slug)) {
		error(400, 'Invalid project slug');
	}

	let baseUrl: string;
	try {
		baseUrl = getPennyworthBaseUrl();
	} catch (err) {
		error(503, `Task backend unavailable: ${(err as Error).message}`);
	}

	let body: Partial<CreateTaskBody>;
	try {
		body = (await request.json()) as Partial<CreateTaskBody>;
	} catch {
		error(400, 'Invalid JSON body');
	}

	if (!body.content || typeof body.content !== 'string' || body.content.trim() === '') {
		error(400, 'content is required');
	}

	try {
		const task = await createTask(baseUrl, params.slug, body as CreateTaskBody);
		return json({ task }, { status: 201 });
	} catch (err) {
		error(502, `Pennyworth fetch failed: ${(err as Error).message}`);
	}
};
