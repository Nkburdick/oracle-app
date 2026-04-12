import type { RequestHandler } from './$types.js';
import { json, error } from '@sveltejs/kit';
import { getPennyworthBaseUrl, sendMessage } from '$lib/server/pennyworth-client.js';

/**
 * POST /api/projects/[slug]/threads/[id]/chat
 *
 * Server-side proxy to Pennyworth's `POST /api/chat`. Used by
 * ProjectChats.svelte when the user hits Send (or Cmd+Enter).
 *
 * The conversationId comes from the URL `[id]` segment so the client can't
 * accidentally cross threads. The slug is also pinned to the URL to scope
 * the chat to the right project.
 */
export const POST: RequestHandler = async ({ params, request }) => {
	let baseUrl: string;
	try {
		baseUrl = getPennyworthBaseUrl();
	} catch (err) {
		error(503, `Chat backend unavailable: ${(err as Error).message}`);
	}

	let body: { message?: string };
	try {
		body = (await request.json()) as { message?: string };
	} catch {
		error(400, 'Invalid JSON body');
	}

	if (typeof body.message !== 'string' || body.message.trim() === '') {
		error(400, 'message is required');
	}

	try {
		const result = await sendMessage(baseUrl, {
			message: body.message,
			conversationId: params.id,
			oracleSlug: params.slug
		});
		return json(result);
	} catch (err) {
		const message = (err as Error).message;
		if (message.includes('Pennyworth 429')) {
			error(429, 'Pennyworth rate limited — try again in a moment');
		}
		if (message.includes('Pennyworth 404')) {
			error(404, `Thread ${params.id} not found`);
		}
		error(502, `Pennyworth fetch failed: ${message}`);
	}
};
