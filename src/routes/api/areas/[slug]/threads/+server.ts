import type { RequestHandler } from './$types.js';
import { json, error } from '@sveltejs/kit';
import { getPennyworthBaseUrl, createThread } from '$lib/server/pennyworth-client.js';
import type { CreateThreadBody } from '$lib/types/chat.js';

/**
 * POST /api/projects/[slug]/threads
 *
 * Server-side proxy to Pennyworth's `POST /api/conversations`. Used by
 * ProjectChats.svelte when the user clicks `[+ New]`. The slug from the URL
 * is forced into the body so the client can't claim a different project.
 */
export const POST: RequestHandler = async ({ params, request }) => {
	let baseUrl: string;
	try {
		baseUrl = getPennyworthBaseUrl();
	} catch (err) {
		error(503, `Chat backend unavailable: ${(err as Error).message}`);
	}

	let body: Partial<CreateThreadBody>;
	try {
		body = (await request.json()) as Partial<CreateThreadBody>;
	} catch {
		error(400, 'Invalid JSON body');
	}

	try {
		const conversation = await createThread(baseUrl, {
			title: body.title,
			oracleSlug: params.slug, // forced from URL, ignore client-provided
			isEphemeral: body.isEphemeral ?? true
		});
		return json({ conversation }, { status: 201 });
	} catch (err) {
		error(502, `Pennyworth fetch failed: ${(err as Error).message}`);
	}
};
