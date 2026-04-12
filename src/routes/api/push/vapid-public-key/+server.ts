import type { RequestHandler } from '@sveltejs/kit';
import { json, error } from '@sveltejs/kit';
import { getPennyworthBaseUrl, getPennyworthApiToken } from '$lib/server/pennyworth-client.js';

/** GET /api/push/vapid-public-key — proxy to Pennyworth */
export const GET: RequestHandler = async () => {
	let baseUrl: string;
	let apiToken: string;
	try {
		baseUrl = getPennyworthBaseUrl();
		apiToken = getPennyworthApiToken();
	} catch (err) {
		error(503, (err as Error).message);
	}

	const res = await fetch(`${baseUrl}/api/push/vapid-public-key`, {
		headers: { Authorization: `Bearer ${apiToken}` }
	});

	if (!res.ok) error(res.status, 'Failed to get VAPID key');
	const data = await res.json();
	return json(data);
};
