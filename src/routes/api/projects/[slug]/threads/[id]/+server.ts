import type { RequestHandler } from './$types.js';
import { json, error } from '@sveltejs/kit';
import { getPennyworthBaseUrl, patchThread, deleteThread } from '$lib/server/pennyworth-client.js';
import type { PatchThreadBody } from '$lib/types/chat.js';

/**
 * PATCH /api/projects/[slug]/threads/[id]
 *
 * Server-side proxy to Pennyworth's `PATCH /api/conversations/:id`. Used for
 * the rename → auto-promote path AND the standalone ★ toggle path (PRD §4.4).
 */
export const PATCH: RequestHandler = async ({ params, request }) => {
	let baseUrl: string;
	try {
		baseUrl = getPennyworthBaseUrl();
	} catch (err) {
		error(503, `Chat backend unavailable: ${(err as Error).message}`);
	}

	let body: PatchThreadBody;
	try {
		body = (await request.json()) as PatchThreadBody;
	} catch {
		error(400, 'Invalid JSON body');
	}

	if (body.title === undefined && body.isEphemeral === undefined) {
		error(400, 'PATCH body must include title and/or isEphemeral');
	}

	try {
		const conversation = await patchThread(baseUrl, params.id, body);
		return json({ conversation });
	} catch (err) {
		const message = (err as Error).message;
		if (message.includes('Pennyworth 404')) {
			error(404, `Thread ${params.id} not found`);
		}
		error(502, `Pennyworth fetch failed: ${message}`);
	}
};

/**
 * DELETE /api/projects/[slug]/threads/[id]
 *
 * Server-side proxy to Pennyworth's `DELETE /api/conversations/:id`. Used by
 * ProjectChats.svelte's hover ✕ button.
 */
export const DELETE: RequestHandler = async ({ params }) => {
	let baseUrl: string;
	try {
		baseUrl = getPennyworthBaseUrl();
	} catch (err) {
		error(503, `Chat backend unavailable: ${(err as Error).message}`);
	}

	try {
		const deleted = await deleteThread(baseUrl, params.id);
		return json({ deleted });
	} catch (err) {
		const message = (err as Error).message;
		if (message.includes('Pennyworth 404')) {
			error(404, `Thread ${params.id} not found`);
		}
		error(502, `Pennyworth fetch failed: ${message}`);
	}
};
