import type { RequestHandler } from './$types.js';

export const GET: RequestHandler = () => {
	return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
		headers: { 'Content-Type': 'application/json' }
	});
};
