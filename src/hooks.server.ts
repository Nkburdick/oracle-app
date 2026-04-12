import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { COOKIE_NAME, validateSessionToken } from '$lib/server/auth';

/** Routes that don't require authentication. */
const PUBLIC_PATHS = ['/login', '/api/health', '/api/auth'];

export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;

	// Allow public paths through without auth
	if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
		return resolve(event);
	}

	// Check session cookie
	const token = event.cookies.get(COOKIE_NAME);
	if (!token) {
		throw redirect(303, '/login');
	}

	const username = validateSessionToken(token);
	if (!username) {
		// Invalid or expired — clear the bad cookie and redirect
		event.cookies.delete(COOKIE_NAME, { path: '/' });
		throw redirect(303, '/login');
	}

	return resolve(event);
};
