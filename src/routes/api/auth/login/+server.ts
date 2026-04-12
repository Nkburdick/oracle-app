import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	validateCredentials,
	createSessionToken,
	COOKIE_NAME,
	MAX_AGE_SECONDS
} from '$lib/server/auth';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const body = await request.json();
	const { username, password } = body as { username?: string; password?: string };

	if (!username || !password) {
		return json({ error: 'Username and password required' }, { status: 400 });
	}

	if (!validateCredentials(username, password)) {
		return json({ error: 'Invalid credentials' }, { status: 401 });
	}

	const token = createSessionToken(username);
	cookies.set(COOKIE_NAME, token, {
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		maxAge: MAX_AGE_SECONDS
	});

	return json({ ok: true });
};
