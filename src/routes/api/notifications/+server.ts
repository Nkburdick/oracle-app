import type { RequestHandler } from '@sveltejs/kit';
import { json, error } from '@sveltejs/kit';
import { getPennyworthBaseUrl, getPennyworthApiToken } from '$lib/server/pennyworth-client.js';

/** GET /api/notifications — proxy to Pennyworth */
export const GET: RequestHandler = async ({ url }) => {
	let baseUrl: string;
	let apiToken: string;
	try {
		baseUrl = getPennyworthBaseUrl();
		apiToken = getPennyworthApiToken();
	} catch (err) {
		error(503, (err as Error).message);
	}

	const unreadOnly = url.searchParams.get('unread_only');
	const query = unreadOnly ? `?unread_only=${unreadOnly}` : '';

	const res = await fetch(`${baseUrl}/api/notifications${query}`, {
		headers: { Authorization: `Bearer ${apiToken}` }
	});

	if (!res.ok) error(res.status, 'Failed to fetch notifications');
	const data = await res.json();
	return json(data);
};
