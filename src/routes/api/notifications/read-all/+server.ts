import type { RequestHandler } from '@sveltejs/kit';
import { json, error } from '@sveltejs/kit';
import { getPennyworthBaseUrl, getPennyworthApiToken } from '$lib/server/pennyworth-client.js';

/** POST /api/notifications/read-all — proxy to Pennyworth */
export const POST: RequestHandler = async () => {
	let baseUrl: string;
	let apiToken: string;
	try {
		baseUrl = getPennyworthBaseUrl();
		apiToken = getPennyworthApiToken();
	} catch (err) {
		error(503, (err as Error).message);
	}

	const res = await fetch(`${baseUrl}/api/notifications/read-all`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${apiToken}` }
	});

	if (!res.ok) error(res.status, 'Failed to mark all read');
	const data = await res.json();
	return json(data);
};
