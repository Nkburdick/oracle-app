import type { RequestHandler } from '@sveltejs/kit';
import { json, error } from '@sveltejs/kit';
import { getPennyworthBaseUrl, getPennyworthApiToken } from '$lib/server/pennyworth-client.js';

/** POST /api/push/unsubscribe — proxy to Pennyworth */
export const POST: RequestHandler = async ({ request }) => {
	let baseUrl: string;
	let apiToken: string;
	try {
		baseUrl = getPennyworthBaseUrl();
		apiToken = getPennyworthApiToken();
	} catch (err) {
		error(503, (err as Error).message);
	}

	const body = await request.text();

	const res = await fetch(`${baseUrl}/api/push/unsubscribe`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiToken}`,
			'Content-Type': 'application/json'
		},
		body
	});

	if (!res.ok) {
		const errText = await res.text().catch(() => 'Unknown error');
		error(res.status, errText);
	}

	const data = await res.json();
	return json(data);
};
