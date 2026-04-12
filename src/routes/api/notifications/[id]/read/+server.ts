import type { RequestHandler } from '@sveltejs/kit';
import { json, error } from '@sveltejs/kit';
import { getPennyworthBaseUrl, getPennyworthApiToken } from '$lib/server/pennyworth-client.js';

/** POST /api/notifications/[id]/read — proxy to Pennyworth */
export const POST: RequestHandler = async ({ params }) => {
	let baseUrl: string;
	let apiToken: string;
	try {
		baseUrl = getPennyworthBaseUrl();
		apiToken = getPennyworthApiToken();
	} catch (err) {
		error(503, (err as Error).message);
	}

	const res = await fetch(`${baseUrl}/api/notifications/${params.id}/read`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${apiToken}` }
	});

	if (!res.ok) error(res.status, 'Failed to mark notification read');
	const data = await res.json();
	return json(data);
};
