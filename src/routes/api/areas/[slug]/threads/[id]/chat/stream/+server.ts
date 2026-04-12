import type { RequestHandler } from '@sveltejs/kit';
import { error } from '@sveltejs/kit';
import { getPennyworthBaseUrl, getPennyworthApiToken } from '$lib/server/pennyworth-client.js';

/**
 * POST /api/projects/[slug]/threads/[id]/chat/stream
 *
 * SSE proxy to Pennyworth's `POST /api/chat/stream`. Pipes the event stream
 * through to the browser — Oracle App clients never talk to Pennyworth directly.
 *
 * Returns text/event-stream on success, or a JSON error if the upstream
 * request fails before streaming begins.
 */
export const POST: RequestHandler = async ({ params, request }) => {
	let baseUrl: string;
	let apiToken: string;
	try {
		baseUrl = getPennyworthBaseUrl();
		apiToken = getPennyworthApiToken();
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

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 120_000); // 2 min timeout

	try {
		const upstream = await fetch(`${baseUrl}/api/chat/stream`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${apiToken}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				message: body.message,
				conversationId: params.id,
				oracleSlug: params.slug
			}),
			signal: controller.signal
		});

		clearTimeout(timeout);

		if (!upstream.ok) {
			const errText = await upstream.text().catch(() => 'Unknown error');
			if (upstream.status === 429) error(429, 'Pennyworth rate limited — try again in a moment');
			if (upstream.status === 404) error(404, `Thread ${params.id} not found`);
			error(502, `Pennyworth stream failed (${upstream.status}): ${errText}`);
		}

		if (!upstream.body) {
			error(502, 'Pennyworth returned no response body');
		}

		// Pipe the SSE stream through directly
		return new Response(upstream.body, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive'
			}
		});
	} catch (err) {
		clearTimeout(timeout);
		if ((err as Error).name === 'AbortError') {
			error(504, 'Pennyworth stream timed out');
		}
		throw err;
	}
};
